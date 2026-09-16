import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260907135058_simplify_registration_fields.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");
const separateDioceseMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260915200000_separate_registration_diocese.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");
const otherChoirMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260916050000_add_registration_other_choir.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");
const musicalProfileMigrationFile = readdirSync(resolve(process.cwd(), "supabase/migrations")).find(
  (file) => file.endsWith("_add_registration_musical_profile.sql"),
);
const musicalProfileMigration = musicalProfileMigrationFile
  ? readFileSync(resolve(process.cwd(), "supabase/migrations", musicalProfileMigrationFile), "utf8")
      .toLowerCase()
      .replace(/\s+/g, " ")
  : "";

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

  it("keeps the diocese independent from the configured choir", () => {
    expect(separateDioceseMigration).toContain(
      "drop constraint if exists registrations_choir_names_match_check",
    );
    expect(separateDioceseMigration).toContain(
      "drop trigger if exists sync_registration_choir_names_before_write",
    );
    expect(separateDioceseMigration).toContain("add constraint registrations_diocese_check");
    expect(separateDioceseMigration).toContain("not valid");
    expect(separateDioceseMigration).toContain("diocese de baturité");
    expect(separateDioceseMigration).toContain("diocese de tianguá");
  });

  it("stores a manual choir only on the registration and supports priced legacy-compatible rows", () => {
    expect(otherChoirMigration).toContain("add column other_choir_name text");
    expect(otherChoirMigration).toContain("registrations_other_choir_name_check");
    expect(otherChoirMigration).toContain("registrations_choir_source_check");
    expect(otherChoirMigration).toContain("drop constraint if exists registrations_pricing_snapshot_check");
    expect(otherChoirMigration).toContain("pricing_type is null");
    expect(otherChoirMigration).not.toContain("insert into public.choirs");
  });

  it("stores the new participant musical profile without invalidating legacy rows", () => {
    expect(musicalProfileMigration).toContain("add column if not exists musical_profile text");
    expect(musicalProfileMigration).toContain("registrations_musical_profile_check");
    expect(musicalProfileMigration).toContain("'regente'");
    expect(musicalProfileMigration).toContain("'instrumentista'");
    expect(musicalProfileMigration).toContain("'coralista'");
    expect(musicalProfileMigration).toContain("musical_profile is null");
  });
});
