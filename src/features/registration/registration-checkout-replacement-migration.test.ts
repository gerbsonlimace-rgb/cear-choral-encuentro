import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "supabase/migrations");
const generatedTypes = readFileSync(
  path.resolve(process.cwd(), "src/integrations/supabase/types.ts"),
  "utf8",
);
const files = readdirSync(migrations).filter((name) =>
  name.endsWith("_add_registration_superseded_checkouts.sql"),
);
const sql = files.length === 1 ? readFileSync(path.join(migrations, files[0]), "utf8") : "";
const normalized = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase();
const phoneRotationSql = readFileSync(
  path.join(migrations, "20261020220109_rotate_pending_registration_checkout.sql"),
  "utf8",
).replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

describe("registration checkout replacement migration contract", () => {
  it("creates one private immutable superseded-checkout ledger", () => {
    expect(files).toHaveLength(1);
    expect(normalized).toContain("create table public.registration_superseded_checkouts");
    expect(normalized).toContain("status in ('superseded', 'paid_requires_review')");
    expect(normalized).toContain(
      "alter table public.registration_superseded_checkouts enable row level security",
    );
    expect(normalized).toContain(
      "revoke all on public.registration_superseded_checkouts from public, anon, authenticated",
    );
    expect(normalized).toContain(
      "grant select, insert, update on public.registration_superseded_checkouts to service_role",
    );
    expect(normalized).toContain("paid_amount_cents is not null");
    expect(normalized).not.toContain("security definer");
  });

  it("protects immutable identity and snapshot fields and permits one review transition", () => {
    for (const field of [
      "id",
      "registration_id",
      "order_nsu",
      "checkout_url",
      "amount_cents",
      "pricing_type",
      "standard_price_cents",
      "registration_price_cents",
      "remaining_price_cents",
      "superseded_at",
    ]) {
      expect(normalized).toContain(`new.${field} is distinct from old.${field}`);
    }
    expect(normalized).toContain(
      "old.status = 'superseded' and new.status = 'paid_requires_review'",
    );
    expect(normalized).toContain("before update on public.registration_superseded_checkouts");
  });

  it("archives and rotates one pending registration under a row lock", () => {
    expect(normalized).toContain(
      "create or replace function public.replace_pending_registration_checkout",
    );
    expect(normalized).toMatch(/from public\.registrations[\s\S]*for update/);
    expect(normalized).toMatch(
      /insert into public\.registration_superseded_checkouts[\s\S]*update public\.registrations/,
    );
    expect(normalized).toContain("v_registration.order_nsu is distinct from p_expected_order_nsu");
    expect(normalized).toContain(
      "v_registration.checkout_url is distinct from p_expected_checkout_url",
    );
    expect(normalized).toContain(String.raw`checkout\.infinitepay\.(io|com\.br)`);
    expect(normalized).toContain("https://pending.invalid/creating/");
    expect(normalized).toContain("p_checkout_claim !~ (");
    expect(normalized).toContain("p_new_order_nsu::text || '/[0-9]+$'");
    expect(normalized).toContain("p_new_order_nsu is null");
    expect(normalized).toContain("p_checkout_claim is null");
  });

  it("truthfully archives historical checkouts that predate pricing snapshots", () => {
    expect(normalized).toContain("pricing_type text check");
    expect(normalized).toContain("standard_price_cents integer check");
    expect(normalized).toContain("registration_price_cents integer check");
    expect(normalized).not.toContain("pricing_type text not null");
    expect(normalized).not.toContain("standard_price_cents integer not null");
    expect(normalized).not.toContain("registration_price_cents integer not null");
    expect(normalized).not.toContain("existing checkout snapshots are incomplete");
    expect(generatedTypes).toContain("pricing_type: string | null");
    expect(generatedTypes).toContain("standard_price_cents: number | null");
    expect(generatedTypes).toContain("registration_price_cents: number | null");
  });

  it("restricts replacement execution to the service role", () => {
    expect(normalized).toContain("security invoker set search_path = ''");
    const replacementSignature = String.raw`public\.replace_pending_registration_checkout\(\s*uuid, uuid, text, uuid, text, text, text, text, text, text, text, text,\s*date, uuid, text, text, text, text, text, integer, integer, integer, integer\s*\)`;
    expect(normalized).toMatch(
      new RegExp(`revoke all on function ${replacementSignature} from public, anon, authenticated`),
    );
    expect(normalized).toMatch(
      new RegExp(`grant execute on function ${replacementSignature} to service_role`),
    );
  });

  it("declares generated-style table and RPC types", () => {
    expect(generatedTypes).toContain("registration_superseded_checkouts: {");
    expect(generatedTypes).toContain("replace_pending_registration_checkout: {");
    expect(generatedTypes).toContain("p_expected_order_nsu: string");
    expect(generatedTypes).toContain("p_expected_checkout_url: string");
    expect(generatedTypes).toContain("p_remaining_price_cents: number");
    expect(generatedTypes).toContain("Returns: boolean");
  });
});

describe("pending phone checkout rotation migration contract", () => {
  it("archives uncertain old orders as well as known checkout URLs", () => {
    expect(phoneRotationSql).toContain("alter column checkout_url drop not null");
    expect(phoneRotationSql).toContain("v_archived_checkout_url := null");
    expect(phoneRotationSql).toContain("create trigger archive_unknown_pending_checkout_order_before_update");
    expect(phoneRotationSql).toContain("before update of order_nsu on public.registrations");
    expect(phoneRotationSql).toMatch(
      /insert into public\.registration_superseded_checkouts[\s\S]*v_registration\.order_nsu,[\s\S]*v_archived_checkout_url,[\s\S]*update public\.registrations/,
    );
    expect(phoneRotationSql).toContain("v_registration.cpf is distinct from p_expected_cpf");
    expect(phoneRotationSql).toContain("v_registration.birth_date is distinct from p_expected_birth_date");
  });
});
