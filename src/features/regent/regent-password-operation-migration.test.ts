import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(
  process.cwd(),
  "supabase/migrations/20260911071600_serialize_regent_password_operations.sql",
);

describe("serialized regent password operation migration", () => {
  it("adds an operation kind paired with the existing SHA-256 hash", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("add column password_change_operation_kind text");
    expect(sql).toContain("password_change_operation_kind in ('admin', 'regent')");
    expect(sql).toContain("password_change_operation_kind is null");
    expect(sql).toContain("password_change_retry_token_hash is null");
  });

  it("claims, finishes, and releases an exact active membership operation atomically", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain(
      "create or replace function public.claim_choir_regent_password_operation",
    );
    expect(sql).toContain(
      "create or replace function public.finish_choir_regent_password_operation",
    );
    expect(sql).toContain(
      "create or replace function public.release_choir_regent_password_operation",
    );
    expect(sql).toContain("password_change_operation_kind is null");
    expect(sql).toContain("revoked_at is null");
    expect(sql).toContain("password_change_operation_kind = p_operation_kind");
    expect(sql).toContain("password_change_retry_token_hash = p_operation_hash");
    expect(sql).toContain("password_change_required = (p_operation_kind = 'admin')");
    expect(sql).toContain("revoke all on function public.claim_choir_regent_password_operation");
    expect(sql).toContain("grant execute on function public.claim_choir_regent_password_operation");
    expect(sql).toContain("to service_role");
  });
});
