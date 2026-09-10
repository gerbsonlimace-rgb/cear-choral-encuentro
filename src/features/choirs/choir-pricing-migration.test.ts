import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  const directory = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(directory).filter((file) =>
    file.endsWith("_create_choir_event_pricing.sql"),
  );
  expect(files).toHaveLength(1);
  return readFileSync(resolve(directory, files[0]), "utf8").toLowerCase().replace(/\s+/g, " ");
}

describe("choir event pricing migration", () => {
  it("creates private settings and choir tables without seeding business data", () => {
    const migration = readMigration();

    expect(migration).toContain("create table public.event_registration_settings");
    expect(migration).toContain("create table public.choirs");
    expect(migration).toContain(
      "alter table public.event_registration_settings enable row level security",
    );
    expect(migration).toContain("alter table public.choirs enable row level security");
    expect(migration).toContain(
      "revoke all on public.event_registration_settings from anon, authenticated",
    );
    expect(migration).toContain("revoke all on public.choirs from anon, authenticated");
    expect(migration).not.toMatch(/insert into public\.choirs/);
  });

  it("enforces singleton settings, normalized unique names, and coherent prices", () => {
    const migration = readMigration();

    expect(migration).toContain("check (id = true)");
    expect(migration).toContain("unique (id)");
    expect(migration).toContain("unique index choirs_normalized_name_uidx");
    expect(migration).toContain("lower(btrim(name))");
    expect(migration).toContain("promotional_price_cents < standard_price_cents");
    expect(migration).toContain("shirt_price_cents integer");
    expect(migration).toContain("registration_price_cents = standard_price_cents");
    expect(migration).toContain("registration_price_cents < standard_price_cents");
  });

  it("renames the historical text and preserves existing registrations", () => {
    const migration = readMigration();

    expect(migration).toContain("add column choir_name text");
    expect(migration).toContain("set choir_name = diocese");
    expect(migration).toContain("sync_registration_choir_names_before_write");
    expect(migration).not.toContain("rename column diocese to choir_name");
    expect(migration).toContain("references public.choirs(id) on delete restrict");
    expect(migration).not.toMatch(/delete from public\.registrations/);
  });
});
