import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261017203128_bd39f884-70b9-4185-9cbc-d843fb4469f5.sql"),
  "utf8",
).toLowerCase();

describe("administrator mutation privileges", () => {
  it("allows the protected service to grant and revoke administrator access", () => {
    expect(migration).toMatch(/grant\s+insert\s*,\s*update\s+on\s+table\s+public\.admin_users\s+to\s+service_role\s*;/);
  });

  it("does not give visitors or participants direct administrator mutation privileges", () => {
    expect(migration).not.toMatch(/\bto\s+(?:anon|authenticated|public)\b/);
  });
});