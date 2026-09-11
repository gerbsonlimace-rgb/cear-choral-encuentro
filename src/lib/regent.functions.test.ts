import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  requirePortalAccess,
  requirePortalReadyAccess,
} from "@/features/regent/regent-auth.middleware";
import type { PortalParticipantPage } from "@/features/regent/regent-portal.server";
import type { PortalSummary } from "@/features/regent/regent-payments.domain";
import {
  changeRegentPassword,
  completeRegentPasswordChange,
  createComplementPaymentVerificationHandler,
  createRegentPortalHandlers,
  createRegentPasswordChangeService,
  createSupabaseRegentPasswordAuth,
  createSupabaseRegentPasswordChangeRepository,
  createAdminRegent,
  getRegentPortalSummary,
  getRegentPortalBootstrap,
  listAdminRegents,
  listRegentPortalParticipants,
  replaceAdminRegent,
  revokeAdminRegent,
  resetAdminRegentPassword,
  startComplementCheckout,
  verifyComplementPayment,
  type RegentPasswordChangeRepository,
} from "./regent.functions";

const { from, update, eq, is, select, maybeSingle, rpc, authAdmin, probeAuth } = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  authAdmin: { getUserById: vi.fn(), updateUserById: vi.fn() },
  probeAuth: { signInWithPassword: vi.fn(), signOut: vi.fn() },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  createSupabaseAdminClient: () => ({ auth: probeAuth }),
  supabaseAdmin: { from, rpc, auth: { admin: authAdmin } },
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: (options: { method: string }) => {
      const middlewares: unknown[] = [];
      let validator: { parse: (input: unknown) => unknown } | undefined;
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        validator(value: typeof validator) {
          validator = value;
          return builder;
        },
        handler(handler: (input: unknown) => unknown) {
          return Object.assign(handler, {
            method: options.method,
            middlewares,
            validate: (input: unknown) => validator?.parse(input),
          });
        },
      };
      return builder;
    },
  };
});
import { resolvePortalChoirSelection, toRegentAccessState } from "./regent.functions";
import type { PortalAccess } from "@/features/regent/regent.domain";

const regent: PortalAccess = {
  role: "regent",
  userId: "user-1",
  membershipId: "private-membership",
  choirId: "11111111-1111-4111-8111-111111111111",
  choirName: "Coro Diocesano de Quixadá",
  name: "Private Name",
  email: "private@example.com",
  passwordChangeRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  const query = { update, eq, is, select, maybeSingle };
  from.mockReturnValue(query);
  update.mockReturnValue(query);
  eq.mockReturnValue(query);
  is.mockReturnValue(query);
  select.mockReturnValue(query);
  maybeSingle.mockResolvedValue({ data: { id: regent.membershipId }, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
  authAdmin.getUserById.mockResolvedValue({
    data: { user: { email: regent.email, app_metadata: {} } },
    error: null,
  });
  authAdmin.updateUserById.mockResolvedValue({
    data: { user: { id: regent.userId } },
    error: null,
  });
  probeAuth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: "invalid_credentials" },
  });
  probeAuth.signOut.mockResolvedValue({ error: null });
});

describe("admin regent server function boundaries", () => {
  it.each([
    ["list", () => listAdminRegents, "GET"],
    ["create", () => createAdminRegent, "POST"],
    ["replace", () => replaceAdminRegent, "POST"],
    ["revoke", () => revokeAdminRegent, "POST"],
    ["reset", () => resetAdminRegentPassword, "POST"],
  ])("requires administrator middleware on %s", (_name, getFunction, method) => {
    const fn = (getFunction as () => unknown)() as { method: string; middlewares: unknown[] };
    expect(fn).toBeDefined();
    expect(fn.method).toBe(method);
    expect(fn.middlewares).toContain(requireAdmin);
  });
  it("normalizes creation data and rejects spoofed actor IDs and short passwords", () => {
    const fn = createAdminRegent as unknown as { validate: (input: unknown) => unknown };
    const input = {
      choirId: regent.choirId,
      name: " Ana Silva ",
      email: " REGENTE@example.com ",
      password: "SenhaTemp123",
    };
    expect(fn.validate(input)).toEqual({
      ...input,
      name: "Ana Silva",
      email: "regente@example.com",
    });
    expect(() => fn.validate({ ...input, grantedBy: "spoof" })).toThrow();
    expect(() => fn.validate({ ...input, password: "123" })).toThrow();
  });
  it("accepts only a membership ID for resets, never a client-selected Auth user", () => {
    const fn = resetAdminRegentPassword as unknown as { validate: (input: unknown) => unknown };
    expect(() =>
      fn.validate({ id: regent.choirId, password: "SenhaTemp123", userId: "victim" }),
    ).toThrow();
    expect(() => fn.validate({ id: "invalid", password: "SenhaTemp123" })).toThrow();
  });
});

describe("public regent access state", () => {
  it("returns unauthenticated without identity data", () => {
    expect(toRegentAccessState({ authenticated: false })).toEqual({ status: "unauthenticated" });
  });
  it("returns forbidden without identity data", () => {
    expect(toRegentAccessState({ authenticated: true, access: null })).toEqual({
      status: "forbidden",
    });
  });
  it("exposes the authoritative regent identity and allowed choir", () => {
    expect(toRegentAccessState({ authenticated: true, access: regent })).toEqual({
      status: "authorized",
      role: "regent",
      choirId: regent.choirId,
      choirName: regent.choirName,
      name: regent.name,
      email: regent.email,
    });
  });
  it("reports the password gate before marking a regent authorized", () => {
    expect(
      toRegentAccessState({
        authenticated: true,
        access: { ...regent, passwordChangeRequired: true },
      }),
    ).toEqual({ status: "password_change_required", role: "regent", choirId: regent.choirId });
  });
  it("reports administrator access with the verified email and without a regent scope", () => {
    expect(
      toRegentAccessState({
        authenticated: true,
        access: { role: "admin", userId: "admin", email: "private@example.com" },
      }),
    ).toEqual({ status: "authorized", role: "admin", email: "private@example.com" });
  });
});

describe("portal handler choir selection", () => {
  it("ignores a regent's attempt to select another choir or impersonate an admin", () => {
    expect(
      resolvePortalChoirSelection(regent, {
        choirId: "22222222-2222-4222-8222-222222222222",
        role: "admin",
      }),
    ).toBe(regent.choirId);
    expect(resolvePortalChoirSelection(regent, undefined)).toBe(regent.choirId);
  });
  it("requires valid explicit administrator input", () => {
    const admin: PortalAccess = { role: "admin", userId: "admin", email: null };
    expect(
      resolvePortalChoirSelection(admin, { choirId: "22222222-2222-4222-8222-222222222222" }),
    ).toBe("22222222-2222-4222-8222-222222222222");
    for (const input of [
      undefined,
      {},
      { choirId: "all" },
      { choirId: regent.choirId, userId: "spoof" },
    ]) {
      expect(() => resolvePortalChoirSelection(admin, input)).toThrow();
    }
  });
});

describe("regent portal handler factory", () => {
  const emptyPage: PortalParticipantPage = { rows: [], total: 0, page: 1, pageSize: 20 };
  const emptySummary: PortalSummary = {
    totalParticipants: 0,
    eligibleComplementCents: 0,
    confirmedComplementCents: 0,
    outstandingComplementCents: 0,
  };

  function setupPortalHandlers() {
    const service = {
      list: vi.fn().mockResolvedValue(emptyPage),
      summary: vi.fn().mockResolvedValue(emptySummary),
    };
    return { service, handlers: createRegentPortalHandlers(service) };
  }

  it("ignores a regent-supplied choir and forwards only the server-authorized choir", async () => {
    const { service, handlers } = setupPortalHandlers();

    await expect(
      handlers.list(regent, {
        choirId: "22222222-2222-4222-8222-222222222222",
        search: " Ana ",
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toBe(emptyPage);

    expect(service.list).toHaveBeenCalledExactlyOnceWith(regent.choirId, {
      search: "Ana",
      page: 1,
      pageSize: 20,
    });
  });

  it("requires an administrator to select a valid choir for list and summary", async () => {
    const { service, handlers } = setupPortalHandlers();
    const admin: PortalAccess = { role: "admin", userId: "admin-1", email: "adm@example.com" };

    await handlers.list(admin, {
      choirId: "22222222-2222-4222-8222-222222222222",
      search: "",
      page: 2,
      pageSize: 50,
    });
    await handlers.summary(admin, {
      choirId: "22222222-2222-4222-8222-222222222222",
    });

    expect(service.list).toHaveBeenCalledExactlyOnceWith("22222222-2222-4222-8222-222222222222", {
      search: "",
      page: 2,
      pageSize: 50,
    });
    expect(service.summary).toHaveBeenCalledExactlyOnceWith("22222222-2222-4222-8222-222222222222");
    await expect(handlers.summary(admin, {})).rejects.toThrow("Selecione um coro válido.");
  });

  it("applies strict query bounds before calling the portal service", async () => {
    const { service, handlers } = setupPortalHandlers();

    for (const input of [
      { search: "a".repeat(101), page: 1, pageSize: 20 },
      { search: "", page: 0, pageSize: 20 },
      { search: "", page: 1, pageSize: 51 },
      { search: "", page: 1, pageSize: 20, userId: "spoof" },
    ]) {
      await expect(handlers.list(regent, input)).rejects.toThrow();
    }

    expect(service.list).not.toHaveBeenCalled();
  });

  it("protects both public portal server functions with ready portal middleware", () => {
    const list = listRegentPortalParticipants as unknown as { middlewares: unknown[] };
    const summary = getRegentPortalSummary as unknown as { middlewares: unknown[] };
    expect(list.middlewares).toContain(requirePortalReadyAccess);
    expect(summary.middlewares).toContain(requirePortalReadyAccess);
    const verify = verifyComplementPayment as unknown as { middlewares: unknown[] };
    expect(verify.middlewares).toContain(requirePortalReadyAccess);
  });
});

describe("regent portal bootstrap boundary", () => {
  it("uses a single GET request for the initial portal payload", () => {
    expect(getRegentPortalBootstrap.method).toBe("GET");
  });
});

describe("complement confirmation server boundary", () => {
  const lookup = {
    orderNsu: "22222222-2222-4222-8222-222222222222",
    transactionNsu: "transaction-123",
    slug: "invoice-123",
  };

  it("requires ready portal access and forwards the authoritative access identity", async () => {
    const service = { reconcilePaymentForAccess: vi.fn().mockResolvedValue({ status: "pending" }) };
    const handler = createComplementPaymentVerificationHandler(service);
    const fn = verifyComplementPayment as unknown as {
      method: string;
      middlewares: unknown[];
      validate: (input: unknown) => unknown;
    };

    expect(fn.method).toBe("POST");
    expect(fn.middlewares).toContain(requirePortalReadyAccess);
    expect(fn.validate(lookup)).toEqual(lookup);
    await expect(handler(regent, lookup)).resolves.toEqual({ status: "pending" });
    expect(service.reconcilePaymentForAccess).toHaveBeenCalledExactlyOnceWith(lookup, regent);
  });
});

describe("regent password server boundaries", () => {
  it.each([
    ["change", changeRegentPassword],
    ["completion", completeRegentPasswordChange],
  ])("requires portal middleware on %s", (_name, serverFunction) => {
    const fn = serverFunction as unknown as {
      method: string;
      middlewares: unknown[];
      validate: (input: unknown) => unknown;
    };

    expect(fn.method).toBe("POST");
    expect(fn.middlewares).toContain(requirePortalAccess);
  });

  it("accepts only a password on change and no client data on completion", () => {
    const change = changeRegentPassword as unknown as { validate: (input: unknown) => unknown };
    const complete = completeRegentPasswordChange as unknown as {
      validate: (input: unknown) => unknown;
    };
    expect(change.validate({ password: "SenhaNova123" })).toEqual({ password: "SenhaNova123" });
    expect(() => change.validate({ password: "short" })).toThrow();
    expect(() =>
      change.validate({ password: "SenhaNova123", operationToken: "a".repeat(64) }),
    ).toThrow();
    expect(complete.validate(undefined)).toBeUndefined();
    expect(() => complete.validate({ retryToken: "a".repeat(64) })).toThrow();
  });
});

describe("regent password change service", () => {
  const operationHash = "b".repeat(64);
  const candidateFingerprint = "c".repeat(64);

  function setupPasswordService() {
    const repository: RegentPasswordChangeRepository = {
      armRetryProof: vi.fn(async () => true),
      verifyCandidate: vi.fn(async () => true),
      makeRetryable: vi.fn(async () => true),
      clearRetryProof: vi.fn(async () => true),
      completeWithProof: vi.fn(async () => true),
      getPasswordOperation: vi.fn(async () => null),
      isCompleted: vi.fn(async () => false),
    };
    const auth = {
      inspectUser: vi.fn(async () => ({ email: regent.email!, appMetadata: {} })),
      passwordMatches: vi.fn(async (): Promise<"matches" | "different" | "unknown"> => "different"),
      updateUserById: vi.fn(async (): Promise<"updated" | "rejected" | "unknown"> => "updated"),
      updateAppMetadata: vi.fn(async (): Promise<"updated" | "rejected" | "unknown"> => "updated"),
    };
    const proofs = {
      createOperation: vi.fn(async () => ({ operationHash, candidateFingerprint })),
    };
    return {
      repository,
      auth,
      proofs,
      service: createRegentPasswordChangeService({ repository, auth, proofs }),
    };
  }

  it("arms a hashed proof before server-side Auth and clears with that proof afterward", async () => {
    const { service, repository, auth } = setupPasswordService();

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "success",
    });

    expect(repository.armRetryProof).toHaveBeenCalledWith(
      regent,
      operationHash,
      candidateFingerprint,
    );
    expect(repository.verifyCandidate).toHaveBeenCalledWith(
      regent,
      operationHash,
      candidateFingerprint,
    );
    expect(auth.updateUserById).toHaveBeenCalledExactlyOnceWith(regent.userId, {
      password: "SenhaNova123",
      appMetadata: {
        regent_password_operation: {
          kind: "regent",
          membership_id: regent.membershipId,
          operation_hash: operationHash,
        },
      },
    });
    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, operationHash);
    expect(vi.mocked(repository.armRetryProof).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.updateUserById).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(auth.updateUserById).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.completeWithProof).mock.invocationCallOrder[0],
    );
  });

  it("returns password-changed recovery without exposing a raw operation secret", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.completeWithProof).mockRejectedValue(new Error("database unavailable"));

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "recovery_required",
    });

    expect(auth.updateUserById).toHaveBeenCalledOnce();
    expect(repository.isCompleted).toHaveBeenCalledWith(regent);
  });

  it("returns a typed rejection when Auth rejects and clears only its own stale hash", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(auth.updateUserById).mockResolvedValue("rejected");

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "rejected" });

    expect(repository.clearRetryProof).toHaveBeenCalledExactlyOnceWith(
      regent,
      operationHash,
      "candidate_verified",
    );
    expect(repository.completeWithProof).not.toHaveBeenCalled();
  });

  it("accepts completion only with a matching server proof for the active caller", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "candidate_verified",
      candidateFingerprint,
    });
    vi.mocked(auth.inspectUser).mockResolvedValue({
      email: regent.email,
      appMetadata: {
        regent_password_operation: {
          kind: "regent",
          membership_id: regent.membershipId,
          operation_hash: operationHash,
        },
      },
    });

    await expect(service.complete(regent)).resolves.toEqual({ status: "success" });

    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, operationHash);
  });

  it("rejects direct completion when the proof does not match a still-gated membership", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(auth.inspectUser).mockResolvedValue({
      email: regent.email,
      appMetadata: { regent_password_operation: { kind: "admin" } },
    });
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "candidate_verified",
      candidateFingerprint,
    });
    vi.mocked(repository.completeWithProof).mockResolvedValue(false);
    vi.mocked(repository.isCompleted).mockResolvedValue(false);

    await expect(service.complete(regent)).resolves.toEqual({ status: "not_ready" });
    expect(repository.completeWithProof).not.toHaveBeenCalled();
  });

  it("treats a lost completion response as success when reconciliation sees the gate closed", async () => {
    const { service, repository } = setupPasswordService();
    vi.mocked(repository.completeWithProof).mockRejectedValue(new Error("response lost"));
    vi.mocked(repository.isCompleted).mockResolvedValue(true);

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "success",
    });
  });

  it("rejects administrators without touching a regent membership", async () => {
    const { service, repository, auth } = setupPasswordService();
    const admin: PortalAccess = { role: "admin", userId: "admin", email: null };

    await expect(service.change(admin, "SenhaNova123")).rejects.toThrow(
      "Não foi possível alterar a senha.",
    );
    await expect(service.complete(admin)).rejects.toThrow(
      "Não foi possível concluir a alteração de senha.",
    );
    expect(repository.armRetryProof).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects the current temporary password using an Auth sign-in proof and revokes that probe", async () => {
    const { repository, proofs } = setupPasswordService();
    const auth = {
      updateUserById: vi.fn(async () => {}),
      updateAppMetadata: vi.fn(async () => "updated" as const),
      inspectUser: vi.fn(async () => ({ email: regent.email, appMetadata: {} })),
      passwordMatches: vi.fn(async () => "matches" as const),
    };
    const service = createRegentPasswordChangeService({ repository, auth, proofs } as never);

    await expect(service.change(regent, "SenhaTemp123")).resolves.toEqual({
      status: "rejected",
    });

    expect(auth.passwordMatches).toHaveBeenCalledExactlyOnceWith(regent.email, "SenhaTemp123");
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(repository.clearRetryProof).toHaveBeenCalledExactlyOnceWith(
      regent,
      operationHash,
      "claimed",
    );
  });

  it("recovers an operation whose Auth response was lost without changing the password again", async () => {
    const { repository, proofs } = setupPasswordService();
    const auth = {
      updateUserById: vi.fn(async () => "unknown" as const),
      updateAppMetadata: vi.fn(async () => "updated" as const),
      inspectUser: vi
        .fn()
        .mockResolvedValueOnce({ email: regent.email, appMetadata: {} })
        .mockResolvedValueOnce({
          email: regent.email,
          appMetadata: {
            regent_password_operation: {
              kind: "regent",
              membership_id: regent.membershipId,
              operation_hash: operationHash,
            },
          },
        }),
      passwordMatches: vi.fn(async () => "different" as const),
    };
    const service = createRegentPasswordChangeService({ repository, auth, proofs } as never);

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "success",
    });

    expect(auth.updateUserById).toHaveBeenCalledOnce();
    expect(auth.inspectUser).toHaveBeenCalledTimes(2);
    expect(repository.completeWithProof).toHaveBeenCalled();
    expect(repository.clearRetryProof).not.toHaveBeenCalled();
  });

  it("reconciles an exact claim whose database response was lost before touching Auth", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockRejectedValue(new TypeError("transport lost"));
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "claimed",
      candidateFingerprint,
    });

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "success",
    });

    expect(auth.updateUserById).toHaveBeenCalledOnce();
    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, operationHash);
  });

  it("releases an exact read-back claim if pre-Auth inspection fails", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockRejectedValue(new TypeError("claim response lost"));
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "claimed",
      candidateFingerprint,
    });
    vi.mocked(auth.inspectUser).mockRejectedValue(new TypeError("Auth unavailable"));

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "rejected",
    });

    expect(repository.clearRetryProof).toHaveBeenCalledExactlyOnceWith(
      regent,
      operationHash,
      "claimed",
    );
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("never adopts an administrator password operation as the regent's own", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "admin",
      hash: operationHash,
      stage: "claimed",
      candidateFingerprint: null,
    });

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "rejected" });

    expect(auth.inspectUser).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(repository.clearRetryProof).not.toHaveBeenCalled();
  });

  it("keeps an exact claim locked when Auth completion is unknown and cannot be proven", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(auth.updateUserById).mockResolvedValue("unknown");

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "recovery_required",
    });

    expect(auth.inspectUser).toHaveBeenCalledTimes(2);
    expect(repository.clearRetryProof).not.toHaveBeenCalled();
    expect(repository.completeWithProof).not.toHaveBeenCalled();
  });

  it("adopts the same candidate after an unknown unapplied Auth result and reissues the exact operation", async () => {
    const { service, repository, auth, proofs } = setupPasswordService();
    vi.mocked(auth.updateUserById)
      .mockResolvedValueOnce("unknown")
      .mockResolvedValueOnce("updated");

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "recovery_required",
    });

    vi.mocked(proofs.createOperation).mockResolvedValueOnce({
      operationHash: "d".repeat(64),
      candidateFingerprint,
    });
    vi.mocked(repository.armRetryProof).mockResolvedValueOnce(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValueOnce({
      kind: "regent",
      hash: operationHash,
      stage: "retryable",
      candidateFingerprint,
    });

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "success" });

    expect(auth.updateUserById).toHaveBeenNthCalledWith(2, regent.userId, {
      password: "SenhaNova123",
      appMetadata: {
        regent_password_operation: {
          kind: "regent",
          membership_id: regent.membershipId,
          operation_hash: operationHash,
        },
      },
    });
    expect(repository.completeWithProof).toHaveBeenCalledWith(regent, operationHash);
    expect(repository.clearRetryProof).not.toHaveBeenCalled();
  });

  it("repairs only Auth metadata when the same verified candidate already became current", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "candidate_verified",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("matches");

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "success" });

    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.updateAppMetadata).toHaveBeenCalledExactlyOnceWith(regent.userId, {
      regent_password_operation: {
        kind: "regent",
        membership_id: regent.membershipId,
        operation_hash: operationHash,
      },
    });
    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, operationHash);
  });

  it("reconciles a lost metadata-repair response from the exact Auth proof", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "retryable",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("matches");
    vi.mocked(auth.updateAppMetadata).mockRejectedValue(new TypeError("response lost"));
    vi.mocked(auth.inspectUser)
      .mockResolvedValueOnce({ email: regent.email, appMetadata: {} })
      .mockResolvedValueOnce({
        email: regent.email,
        appMetadata: {
          regent_password_operation: {
            kind: "regent",
            membership_id: regent.membershipId,
            operation_hash: operationHash,
          },
        },
      });

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "success" });

    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, operationHash);
  });

  it("keeps the candidate retryable when metadata repair is still unproven", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.armRetryProof).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "retryable",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("matches");
    vi.mocked(auth.updateAppMetadata).mockRejectedValue(new TypeError("Auth unavailable"));

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "recovery_required",
    });

    expect(repository.clearRetryProof).not.toHaveBeenCalled();
    expect(repository.completeWithProof).not.toHaveBeenCalled();
  });

  it("rejects a different candidate while an unproven operation may still write Auth", async () => {
    const { service, repository, auth, proofs } = setupPasswordService();
    vi.mocked(proofs.createOperation).mockResolvedValue({
      operationHash: "d".repeat(64),
      candidateFingerprint: "e".repeat(64),
    });
    vi.mocked(repository.armRetryProof).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: operationHash,
      stage: "candidate_verified",
      candidateFingerprint,
    });

    await expect(service.change(regent, "OutraSenha123")).resolves.toEqual({
      status: "rejected",
    });

    expect(auth.inspectUser).not.toHaveBeenCalled();
    expect(auth.passwordMatches).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.updateAppMetadata).not.toHaveBeenCalled();
    expect(repository.clearRetryProof).not.toHaveBeenCalled();
  });

  it("releases its claim when the current-password probe is unavailable before any Auth write", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(auth.passwordMatches).mockResolvedValue("unknown");

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "rejected" });

    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(repository.clearRetryProof).toHaveBeenCalledExactlyOnceWith(
      regent,
      operationHash,
      "claimed",
    );
  });
});

describe("Supabase regent password proof adapter", () => {
  it("arms only the gated active caller membership with the proof hash", async () => {
    const hash = "b".repeat(64);

    const candidate = "c".repeat(64);

    await createSupabaseRegentPasswordChangeRepository().armRetryProof(regent, hash, candidate);

    expect(rpc).toHaveBeenCalledExactlyOnceWith("claim_choir_regent_password_candidate_operation", {
      p_candidate_fingerprint: candidate,
      p_membership_id: regent.membershipId,
      p_user_id: regent.userId,
      p_operation_hash: hash,
    });
  });

  it("durably verifies the exact candidate before any Auth password write", async () => {
    const hash = "b".repeat(64);
    const candidate = "c".repeat(64);

    await createSupabaseRegentPasswordChangeRepository().verifyCandidate(regent, hash, candidate);

    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "verify_choir_regent_password_operation_candidate",
      {
        p_candidate_fingerprint: candidate,
        p_membership_id: regent.membershipId,
        p_user_id: regent.userId,
        p_operation_hash: hash,
      },
    );
  });

  it("marks only the exact verified candidate retryable after an unknown Auth result", async () => {
    const hash = "b".repeat(64);
    const candidate = "c".repeat(64);

    await createSupabaseRegentPasswordChangeRepository().makeRetryable(regent, hash, candidate);

    expect(rpc).toHaveBeenCalledExactlyOnceWith("mark_choir_regent_password_operation_retryable", {
      p_candidate_fingerprint: candidate,
      p_membership_id: regent.membershipId,
      p_user_id: regent.userId,
      p_operation_hash: hash,
    });
  });

  it("releases only the exact expected candidate stage", async () => {
    const hash = "b".repeat(64);

    await createSupabaseRegentPasswordChangeRepository().clearRetryProof(
      regent,
      hash,
      "candidate_verified",
    );

    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "release_choir_regent_password_candidate_operation",
      {
        p_expected_stage: "candidate_verified",
        p_membership_id: regent.membershipId,
        p_user_id: regent.userId,
        p_operation_hash: hash,
      },
    );
  });

  it("clears the gate only for an active caller row with the matching proof hash", async () => {
    const hash = "b".repeat(64);

    await expect(
      createSupabaseRegentPasswordChangeRepository().completeWithProof(regent, hash),
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_choir_regent_password_operation", {
      p_membership_id: regent.membershipId,
      p_user_id: regent.userId,
      p_operation_kind: "regent",
      p_operation_hash: hash,
    });
  });
});

describe("Supabase regent password Auth adapter", () => {
  it("distinguishes a confirmed different password from an unavailable Auth probe", async () => {
    const auth = createSupabaseRegentPasswordAuth();

    await expect(auth.passwordMatches(regent.email, "different")).resolves.toBe("different");

    probeAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: "request_timeout" },
    });
    await expect(auth.passwordMatches(regent.email, "unknown")).resolves.toBe("unknown");
  });

  it("revokes only the successful isolated password probe session", async () => {
    probeAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: regent.userId }, session: { access_token: "private" } },
      error: null,
    });

    await expect(
      createSupabaseRegentPasswordAuth().passwordMatches(regent.email, "same"),
    ).resolves.toBe("matches");

    expect(probeAuth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("treats a returned probe sign-out error as an indeterminate verification", async () => {
    probeAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: regent.userId }, session: { access_token: "private" } },
      error: null,
    });
    probeAuth.signOut.mockResolvedValue({ error: { code: "request_timeout" } });

    await expect(
      createSupabaseRegentPasswordAuth().passwordMatches(regent.email, "same"),
    ).resolves.toBe("unknown");
  });
});
