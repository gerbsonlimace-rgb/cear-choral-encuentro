import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(
  process.cwd(),
  "supabase/migrations/20260911120713_bind_regent_password_candidate.sql",
);

describe("regent password candidate migration", () => {
  it("pairs a non-reversible candidate fingerprint and durable stage with each operation", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("add column password_change_candidate_fingerprint text");
    expect(sql).toContain("add column password_change_operation_stage text");
    expect(sql).toContain(
      "password_change_operation_stage in ('claimed', 'candidate_verified', 'retryable', 'legacy')",
    );
    expect(sql).toContain("password_change_candidate_fingerprint ~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("password_change_operation_stage = 'legacy'");
  });

  it("claims and verifies only the exact active regent candidate before Auth", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain(
      "create or replace function public.claim_choir_regent_password_candidate_operation",
    );
    expect(sql).toContain(
      "create or replace function public.verify_choir_regent_password_operation_candidate",
    );
    expect(sql).toContain(
      "create or replace function public.mark_choir_regent_password_operation_retryable",
    );
    expect(sql).toContain(
      "create or replace function public.release_choir_regent_password_candidate_operation",
    );
    expect(sql).toContain("password_change_candidate_fingerprint = p_candidate_fingerprint");
    expect(sql).toContain("password_change_operation_stage = 'candidate_verified'");
    expect(sql).toContain("password_change_operation_kind = 'regent'");
    expect(sql).toContain("revoked_at is null");
    expect(sql).toContain("password_change_operation_stage = p_expected_stage");
    expect(sql).toContain("p_expected_stage not in ('claimed', 'candidate_verified')");
  });

  it("clears candidate state on exact finish or safe release and keeps RPCs service-role only", () => {
    const sql = readFileSync(path, "utf8").toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("password_change_candidate_fingerprint = null");
    expect(sql).toContain("password_change_operation_stage = null");
    expect(sql).toContain(
      "revoke all on function public.claim_choir_regent_password_candidate_operation",
    );
    expect(sql).toContain(
      "revoke all on function public.verify_choir_regent_password_operation_candidate",
    );
    expect(sql).toContain(
      "revoke all on function public.release_choir_regent_password_candidate_operation",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
