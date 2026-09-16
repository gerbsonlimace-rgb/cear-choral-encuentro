import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "supabase/migrations");
const generatedTypes = readFileSync(path.resolve(process.cwd(), "src/integrations/supabase/types.ts"), "utf8");
const files = readdirSync(migrations).filter((name) => name.endsWith("_create_regent_portal.sql"));
const passwordProofFiles = readdirSync(migrations).filter((name) =>
  name.endsWith("_add_regent_password_change_proof.sql"),
);
const configuredRemainingFiles = readdirSync(migrations).filter((name) =>
  name.endsWith("_allow_configured_promotional_remaining_price.sql"),
);

describe("regent portal migration contract", () => {
  it("models both tables while retaining participant-specific target columns", () => {
    expect(generatedTypes).toContain("choir_regents: {");
    expect(generatedTypes).toContain("registration_complement_payments: {");
    expect(generatedTypes).toContain("order_nsu: string");
    expect(generatedTypes).toContain("amount_cents: number");
    expect(generatedTypes).toContain("status: string");
    expect(generatedTypes).toContain("photo_path: string | null");
    expect(generatedTypes).toContain("voice_part: string | null");
  });

  it("contains exactly one migration with both private tables", () => {
    expect(files).toHaveLength(1);
    const sql = readFileSync(path.join(migrations, files[0]), "utf8");
    expect(sql).toContain("create table public.choir_regents");
    expect(sql).toContain("create table public.registration_complement_payments");
  });

  const sql = files.length === 1 ? readFileSync(path.join(migrations, files[0]), "utf8") : "";
  const normalized = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

  it("restricts table and function access to the service role", () => {
    for (const table of ["choir_regents", "registration_complement_payments"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(sql).toContain(`revoke all on public.${table} from public, service_role`);
      expect(sql).toContain(`grant select, insert, update on public.${table} to service_role`);
    }
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
    expect(normalized).not.toContain("security definer");
    expect(normalized).toContain("revoke all on function public.validate_registration_complement_payment() from public, anon, authenticated");
  });

  it("enforces concurrent active regent and open checkout uniqueness", () => {
    expect(normalized).toContain("create unique index choir_regents_active_choir_uidx on public.choir_regents (choir_id) where revoked_at is null");
    expect(normalized).toContain("create unique index choir_regents_active_user_uidx on public.choir_regents (user_id) where revoked_at is null");
    expect(normalized).toContain("create unique index registration_complement_payments_open_uidx on public.registration_complement_payments (registration_id) where status in ('creating', 'pending')");
  });

  it("replaces the regent atomically under a choir lock with restricted execution", () => {
    expect(sql).toContain("create or replace function public.replace_active_choir_regent");
    expect(normalized).toContain("security invoker set search_path = ''");
    expect(normalized).toMatch(/from public\.choirs[\s\S]*for update[\s\S]*update public\.choir_regents[\s\S]*insert into public\.choir_regents/);
    expect(normalized).toContain("revoke all on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid) from public, anon, authenticated");
    expect(normalized).toContain("grant execute on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid) to service_role");
  });

  it("preserves references, normalized identity and payment snapshots", () => {
    expect(normalized).toContain("user_id uuid not null references auth.users(id) on delete restrict");
    expect(normalized).toContain("registration_id uuid not null references public.registrations(id) on delete restrict");
    expect(normalized).toContain("choir_id uuid not null references public.choirs(id) on delete restrict");
    expect(normalized).toContain("email = lower(btrim(email))");
    expect(normalized).toContain("name = btrim(name)");
    expect(normalized).toContain("password_change_required boolean not null default true");
    expect(normalized).toContain("order_nsu uuid not null unique");
    expect(normalized).toContain("amount_cents integer not null check (amount_cents > 0)");
    expect(normalized).toContain("initiated_as in ('regent', 'admin')");
  });

  it("indexes all foreign keys including history and actor lookups", () => {
    for (const [table, columns] of [["choir_regents", ["user_id", "choir_id", "granted_by", "revoked_by"]], ["registration_complement_payments", ["registration_id", "choir_id", "initiated_by"]]] as const) {
      for (const column of columns) expect(normalized).toContain(`create index ${table}_${column}_idx on public.${table} (${column})`);
    }
  });

  it("validates eligibility and outstanding principal while locking the registration", () => {
    expect(normalized).toContain("before insert or update on public.registration_complement_payments");
    expect(normalized).toMatch(/from public\.registrations[\s\S]*for update/);
    expect(normalized).toContain("v_registration.choir_id is distinct from new.choir_id");
    expect(normalized).toContain("v_registration.payment_status is distinct from 'paid'");
    expect(normalized).toContain("v_registration.pricing_type is distinct from 'promotional'");
    expect(normalized).toContain("sum(payment.amount_cents)");
    expect(normalized).toContain("payment.status = 'paid'");
    expect(normalized).toContain("new.amount_cents > v_registration.standard_price_cents::bigint - v_registration.registration_price_cents::bigint - v_paid_cents");
  });

  it("rejects identity and amount mutations and protects terminal payment states", () => {
    for (const field of ["id", "registration_id", "choir_id", "order_nsu", "amount_cents", "initiated_by", "initiated_by_name", "initiated_as", "created_at"]) expect(normalized).toContain(`new.${field} is distinct from old.${field}`);
    expect(normalized).toContain("new.status is distinct from 'creating'");
    expect(normalized).toContain("old.status = 'creating' and new.status in ('pending', 'failed')");
    expect(normalized).toContain("old.status = 'pending' and new.status in ('paid', 'failed', 'expired')");
    expect(normalized).toContain("old.status in ('paid', 'failed', 'expired')");
  });

  it("allows configured promotional remaining snapshots above the derived discount", () => {
    expect(configuredRemainingFiles).toHaveLength(1);
    const sql = readFileSync(path.join(migrations, configuredRemainingFiles[0]), "utf8")
      .replace(/--[^\n]*/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
    expect(sql).toContain("remaining_price_cents >= 0");
    expect(sql).not.toContain("between 0 and standard_price_cents - registration_price_cents");
  });
});

describe("regent password change proof migration contract", () => {
  it("adds one nullable SHA-256 retry proof constrained to a required password change", () => {
    expect(passwordProofFiles).toHaveLength(1);
    const sql = readFileSync(path.join(migrations, passwordProofFiles[0]), "utf8")
      .replace(/--[^\n]*/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(sql).toContain(
      "alter table public.choir_regents add column password_change_retry_token_hash text",
    );
    expect(sql).toContain("password_change_retry_token_hash ~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("password_change_required or password_change_retry_token_hash is null");
  });
});
