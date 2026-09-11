import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(
  process.cwd(),
  "supabase/migrations/20260911082730_restore_regent_password_operation_state.sql",
);

describe("regent password operation recovery migration", () => {
  it("records the pre-claim gate and keeps it paired with the operation", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("add column password_change_operation_previous_required boolean");
    expect(sql).toContain("password_change_operation_previous_required = password_change_required");
    expect(sql).toContain("password_change_operation_previous_required is null");
    expect(sql).toContain("password_change_operation_kind is null");
  });

  it("restores the prior gate on exact admin rejection and clears all operation fields", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain(
      "case when p_operation_kind = 'admin' then password_change_operation_previous_required else password_change_required end",
    );
    expect(sql).toContain("password_change_operation_kind = null");
    expect(sql).toContain("password_change_retry_token_hash = null");
    expect(sql).toContain("password_change_operation_previous_required = null");
    expect(sql).toContain("password_change_operation_kind = p_operation_kind");
    expect(sql).toContain("password_change_retry_token_hash = p_operation_hash");
  });
});
