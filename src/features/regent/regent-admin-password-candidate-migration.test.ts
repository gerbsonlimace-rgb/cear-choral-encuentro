import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(
  process.cwd(),
  "supabase/migrations/20260911123809_bind_admin_password_candidate.sql",
);

describe("administrator password candidate migration", () => {
  it("moves pre-candidate administrator operations to a fail-closed legacy stage", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("set password_change_operation_stage = 'legacy'");
    expect(sql).toContain("where password_change_operation_kind = 'admin'");
    expect(sql).toContain("password_change_operation_stage = 'legacy'");
    expect(sql).toContain("password_change_candidate_fingerprint is null");
  });

  it("binds, promotes, and releases only the exact administrator candidate stage", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain(
      "create or replace function public.claim_choir_regent_admin_password_candidate_operation",
    );
    expect(sql).toContain(
      "create or replace function public.mark_choir_regent_admin_password_operation_retryable",
    );
    expect(sql).toContain(
      "create or replace function public.release_choir_regent_admin_password_candidate_operation",
    );
    expect(sql).toContain("password_change_operation_kind = 'admin'");
    expect(sql).toContain("password_change_candidate_fingerprint = p_candidate_fingerprint");
    expect(sql).toContain("password_change_operation_stage = 'retryable'");
    expect(sql).toContain("password_change_operation_stage = p_expected_stage");
    expect(sql).toContain("p_expected_stage <> 'claimed'");
    expect(sql).toContain("revoked_at is null");
  });

  it("keeps every new RPC security-invoker and service-role only", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain(
      "revoke all on function public.claim_choir_regent_admin_password_candidate_operation",
    );
    expect(sql).toContain(
      "revoke all on function public.mark_choir_regent_admin_password_operation_retryable",
    );
    expect(sql).toContain(
      "revoke all on function public.release_choir_regent_admin_password_candidate_operation",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
