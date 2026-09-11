import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260907135058_simplify_registration_fields.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("simplified registration migration", () => {
  it("deletes only registration rows before requiring the new profile fields", () => {
    const deleteStatements = migration.match(/delete from [^;]+;/g);

    expect(deleteStatements).toEqual(["delete from public.registrations;"]);
    expect(migration.indexOf("delete from public.registrations;")).toBeLessThan(
      migration.indexOf("alter column birth_date set not null"),
    );
    expect(migration).toContain("alter column diocese set not null");
  });

  it("does not classify legacy rows by a timestamp or hidden flag", () => {
    expect(migration).not.toContain("legacy_profile_fields");
    expect(migration).not.toMatch(/created_at\s*[<>]/);
  });
});
