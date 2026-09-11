// Static migration contract only; PostgreSQL behavior must also be verified locally.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directory = resolve(process.cwd(), "supabase/migrations");
const migrations = readdirSync(directory).filter((name) =>
  /^\d{14}_create_participant_portal\.sql$/.test(name),
);
const sql = migrations.length === 1
  ? readFileSync(resolve(directory, migrations[0]), "utf8")
      .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase()
  : "";

describe("private participant migration contract (static)", () => {
  it("ships exactly one CLI-created participant migration", () => {
    expect(migrations).toHaveLength(1);
  });

  it("blocks direct public access and gives service_role only required operations", () => {
    for (const table of ["participant_accounts", "participant_access_events"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from public, anon, authenticated, service_role`);
    }
    expect(sql).toContain("grant select, insert, update on public.participant_accounts to service_role");
    expect(sql).toContain("grant select, insert on public.participant_access_events to service_role");
    const grants = sql.match(/grant\s+[^;]+;/g) ?? [];
    expect(grants).toHaveLength(3);
    expect(grants.every((grant) => / to service_role;/.test(grant))).toBe(true);
  });

  it("enforces one account per registration and per non-null user", () => {
    expect(sql).toContain("create unique index participant_accounts_registration_uidx on public.participant_accounts (registration_id)");
    expect(sql).toContain("create unique index participant_accounts_user_uidx on public.participant_accounts (user_id) where user_id is not null");
    expect(sql).toContain("create index participant_accounts_attention_idx on public.participant_accounts (access_status, updated_at) where access_status in ('pending', 'conflict')");
  });

  it("requires a clean linked user only for active accounts", () => {
    expect(sql).toContain("user_id uuid references auth.users(id) on delete restrict");
    expect(sql).toContain("constraint participant_accounts_active_state_check check ( (access_status = 'active' and user_id is not null and provisioned_at is not null and last_error_code is null and provisioning_claim_id is null and provisioning_started_at is null) or (access_status <> 'active' and user_id is null and provisioned_at is null) )");
  });

  it("serializes paid-registration claims and rejects active or unexpired leases", () => {
    expect(sql).toMatch(/from public\.registrations as registration where registration\.id = p_registration_id and registration\.payment_status = 'paid' for update/);
    expect(sql).toContain("if not found then return false; end if");
    expect(sql).toContain("on conflict (registration_id) do nothing");
    expect(sql).toContain("account.access_status <> 'active'");
    expect(sql).toContain("account.provisioning_claim_id is null or account.provisioning_started_at <= v_claimed_at - interval '10 minutes'");
    expect(sql).toContain("provisioning_claim_id = p_claim_id");
    expect(sql).toContain("v_claimed_at := clock_timestamp()");
    expect(sql).toContain("return found");
  });

  it("keeps the claim RPC invoker-only and callable only by service_role", () => {
    expect(sql).toContain("security invoker set search_path = ''");
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("revoke all on function public.claim_participant_provisioning(uuid, uuid) from public, anon, authenticated, service_role");
    expect(sql).toContain("grant execute on function public.claim_participant_provisioning(uuid, uuid) to service_role");
  });

  it("keeps claim identifiers out of append-only audit events and indexes their references", () => {
    const events = sql.match(/create table public\.participant_access_events \((.*?)\);/)?.[1];
    expect(events).toBeDefined();
    expect(events).not.toContain("provisioning_claim_id");
    expect(events).toContain("error_code text");
    expect(events).toContain("error_code ~ '^[a-z][a-z0-9_]{0,63}$'");
    for (const column of ["registration_id", "participant_account_id", "admin_user_id"]) {
      expect(sql).toMatch(new RegExp(`create index \\w+ on public\\.participant_access_events \\(${column}(?:,|\\))`));
    }
  });
});
