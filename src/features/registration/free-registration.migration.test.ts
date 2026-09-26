import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260926000000_add_free_choir_registrations.sql"),
  "utf8",
).toLowerCase().replace(/\s+/g, " ");

describe("free choir registration migration", () => {
  it("marks only the named Quixadá choir as free and keeps existing registrations", () => {
    expect(migration).toContain("lower(btrim(name)) = lower('coro diocesano de quixadá')");
    expect(migration).toContain("set is_free = true, uses_promotional_price = false");
    expect(migration).not.toContain("delete from public.registrations");
  });

  it("allows zero value submissions to stay pending before the admin audit is recorded", () => {
    expect(migration).toContain("add column if not exists is_free_registration boolean not null default false");
    expect(migration).toContain("payment_status in ('pending', 'paid') and payment_origin = 'exemption'");
    expect(migration).toContain("payment_status = 'pending' and exempted_by is null and exempted_at is null");
    expect(migration).toContain("payment_status = 'paid' and exempted_by is not null and exempted_at is not null");
    expect(migration).toContain("payment_status <> 'pending' or payment_origin <> 'exemption' or is_free_registration");
  });
});
