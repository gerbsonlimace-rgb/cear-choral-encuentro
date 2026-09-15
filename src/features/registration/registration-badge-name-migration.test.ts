import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260915194500_add_registration_badge_name.sql"),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("registration badge name migration", () => {
  it("adds a bounded nullable badge name for existing registrations", () => {
    expect(migration).toContain("add column if not exists badge_name text");
    expect(migration).toContain("badge_name is null");
    expect(migration).toContain("char_length(badge_name) between 2 and 60");
    expect(migration).not.toContain("delete from public.registrations");
  });
});
