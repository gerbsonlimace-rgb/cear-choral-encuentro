import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("registration CPF migration", () => {
  it("preserves historical registrations and enforces unique normalized CPF values", () => {
    const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
    const fileName = readdirSync(migrationsDirectory).find((name) =>
      name.endsWith("_add_registration_cpf.sql"),
    );

    expect(fileName).toBeDefined();
    const migration = readFileSync(resolve(migrationsDirectory, fileName!), "utf8").toLowerCase();
    expect(migration).toContain("add column cpf text");
    expect(migration).toContain("^[0-9]{11}$");
    expect(migration).not.toMatch(/delete\s+from\s+public\.registrations/i);
    expect(migration).toContain("cpf is null");
    expect(migration).not.toContain("add column cpf text not null");
    expect(migration).toContain("create unique index registrations_cpf_uidx");
    expect(migration).toContain("where cpf is not null");
  });
});
