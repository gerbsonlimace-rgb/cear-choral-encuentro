import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrations).filter((name) =>
  name.endsWith("_allow_existing_regent_user_link.sql"),
);

describe("existing regent user link migration", () => {
  it("adds an atomic replacement overload that preserves an existing password", () => {
    expect(files).toHaveLength(1);
    const sql = readFileSync(path.join(migrations, files[0]), "utf8")
      .replace(/--[^\n]*/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(sql).toContain("create or replace function public.replace_active_choir_regent(");
    expect(sql).toContain("p_password_change_required boolean");
    expect(sql).toContain("password_change_required, granted_at, granted_by");
    expect(sql).toContain("p_password_change_required, v_changed_at, p_granted_by");
    expect(sql).toContain("for update");
    expect(sql).toContain("revoke all on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid, boolean)");
    expect(sql).toContain("grant execute on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid, boolean) to service_role");
  });
});
