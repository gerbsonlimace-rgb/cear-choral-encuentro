import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  authorizeAdminOperation,
  createAdminAuthorizer,
  getAdminAuthorizer,
} from "./admin-auth.server";

type DatabaseResult = {
  data: { id: string; user_id: string } | null;
  error: { message: string } | null;
  count: number | null;
  status: number;
  statusText: string;
};

type SupabaseBuilder = {
  select(columns: string): SupabaseBuilder;
  eq(column: string, value: unknown): SupabaseBuilder;
  is(column: string, value: unknown): SupabaseBuilder;
  maybeSingle(): Promise<DatabaseResult>;
};

function createSupabaseHarness(result: DatabaseResult) {
  const trace: unknown[][] = [];
  const builder: SupabaseBuilder = {
    select: vi.fn((columns: string) => {
      trace.push(["select", columns]);
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      trace.push(["eq", column, value]);
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      trace.push(["is", column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => {
      trace.push(["maybeSingle"]);
      return result;
    }),
  };

  supabaseAdminMock.from.mockImplementation((table: string) => {
    trace.push(["from", table]);
    return builder;
  });

  return { trace };
}

describe("admin authorization", () => {
  it("rejects a user without an active membership before running the operation", async () => {
    const operation = vi.fn();
    const authorizer = createAdminAuthorizer({ findActive: vi.fn(async () => null) });

    await expect(authorizeAdminOperation("user-1", authorizer, operation)).rejects.toThrow(
      "Acesso não autorizado",
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it("passes the active membership to the protected operation", async () => {
    const membership = { id: "membership-1", userId: "user-1" };
    const authorizer = createAdminAuthorizer({ findActive: vi.fn(async () => membership) });

    await expect(
      authorizeAdminOperation("user-1", authorizer, async (admin) => admin.id),
    ).resolves.toBe("membership-1");
  });
});

describe("Supabase admin membership repository", () => {
  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
  });

  it("queries and maps only the active membership for the authenticated user", async () => {
    const database = createSupabaseHarness({
      data: { id: "membership-1", user_id: "user-1" },
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });

    await expect(getAdminAuthorizer().findActive("user-1")).resolves.toEqual({
      id: "membership-1",
      userId: "user-1",
    });
    expect(database.trace).toEqual([
      ["from", "admin_users"],
      ["select", "id,user_id"],
      ["eq", "user_id", "user-1"],
      ["is", "revoked_at", null],
      ["maybeSingle"],
    ]);
  });

  it("maps a database failure to a safe administrative-access error", async () => {
    createSupabaseHarness({
      data: null,
      error: { message: "lookup failed for user-1" },
      count: null,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(getAdminAuthorizer().findActive("user-1")).rejects.toThrow(
      "Não foi possível validar o acesso administrativo.",
    );
  });
});
