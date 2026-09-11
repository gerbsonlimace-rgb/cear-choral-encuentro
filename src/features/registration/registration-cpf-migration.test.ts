import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("registration CPF migration", () => {
  it("aborts on duplicate CPFs before adding the non-null unique index", () => {
    const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
    const fileName = readdirSync(migrationsDirectory).find((name) =>
      name.endsWith("_enforce_unique_registration_cpf.sql"),
    );

    expect(fileName).toBeDefined();
    expect(fileName! > "20260911010102_2885439a-5d2b-4444-913a-de1c4ec6fb4e.sql").toBe(true);
    const migration = readFileSync(resolve(migrationsDirectory, fileName!), "utf8").toLowerCase();
    expect(migration).toMatch(/select\s+cpf\s+from\s+public\.registrations/);
    expect(migration).toMatch(/group\s+by\s+cpf/);
    expect(migration).toMatch(/having\s+count\s*\(\s*\*\s*\)\s*>\s*1/);
    expect(migration).toContain("raise exception");
    expect(migration).toContain("create unique index registrations_cpf_uidx");
    expect(migration).toContain("on public.registrations (cpf)");
    expect(migration).toContain("where cpf is not null");
    expect(migration.indexOf("select cpf")).toBeLessThan(
      migration.indexOf("create unique index registrations_cpf_uidx"),
    );
    expect(migration).not.toMatch(/delete\s+from\s+public\.registrations/);
    expect(migration).not.toMatch(/update\s+public\.registrations/);
  });
});
