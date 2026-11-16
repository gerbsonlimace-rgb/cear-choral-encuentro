import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116150000_add_lodging_plan.sql"),
  "utf8",
).toLowerCase();

describe("lodging plan migration", () => {
  it("keeps a single plan row with the whole allocation", () => {
    expect(migration).toContain("create table public.lodging_plan");
    expect(migration).toContain("constraint lodging_plan_singleton_check check (id = true)");
    expect(migration).toContain("assignments jsonb not null");
    expect(migration).toContain("no_lodging_registration_ids uuid[] not null");
    expect(migration).toContain("extra_people jsonb not null");
  });

  it("replaces the plan in one statement so a partial write never lands", () => {
    expect(migration).toContain("create or replace function public.replace_lodging_plan");
    expect(migration).toContain("on conflict (id) do update set");
    expect(migration).toContain("updated_at = now()");
  });

  it("keeps the plan and its photos away from the browser", () => {
    expect(migration).toContain(
      "revoke all on public.lodging_plan from anon, authenticated",
    );
    expect(migration).toContain("grant select, insert, update on public.lodging_plan to service_role");
    expect(migration).toContain("'lodging-photos', 'lodging-photos', false");
    expect(migration).toContain(
      "revoke all on function public.replace_lodging_plan(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer)",
    );
  });
});
