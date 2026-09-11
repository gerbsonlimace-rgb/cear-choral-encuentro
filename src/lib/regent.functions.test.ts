import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requirePortalAccess } from "@/features/regent/regent-auth.middleware";
import {
  changeRegentPassword,
  completeRegentPasswordChange,
  createRegentPasswordChangeService,
  createSupabaseRegentPasswordChangeRepository,
  createAdminRegent,
  listAdminRegents,
  replaceAdminRegent,
  revokeAdminRegent,
  resetAdminRegentPassword,
  type RegentPasswordChangeRepository,
} from "./regent.functions";

const { from, update, eq, is, select, maybeSingle, authAdmin } = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  authAdmin: { updateUserById: vi.fn() },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, auth: { admin: authAdmin } },
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
  it("exposes only the role and allowed choir of an authorized regent", () => {
    expect(toRegentAccessState({ authenticated: true, access: regent })).toEqual({
      status: "authorized",
      role: "regent",
      choirId: regent.choirId,
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
  it("reports administrator access without attaching a regent scope", () => {
    expect(
      toRegentAccessState({
        authenticated: true,
        access: { role: "admin", userId: "admin", email: "private@example.com" },
      }),
    ).toEqual({ status: "authorized", role: "admin" });
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

  it("accepts a password only on change and a server proof only on completion", () => {
    const change = changeRegentPassword as unknown as { validate: (input: unknown) => unknown };
    const complete = completeRegentPasswordChange as unknown as {
      validate: (input: unknown) => unknown;
    };
    const token = "a".repeat(64);

    expect(change.validate({ password: "SenhaNova123" })).toEqual({ password: "SenhaNova123" });
    expect(() => change.validate({ password: "short" })).toThrow();
    expect(() => change.validate({ password: "SenhaNova123", userId: "victim" })).toThrow();
    expect(complete.validate({ retryToken: token })).toEqual({ retryToken: token });
    expect(() => complete.validate({})).toThrow();
    expect(() => complete.validate({ retryToken: token, password: "SenhaNova123" })).toThrow();
  });
});

describe("regent password change service", () => {
  const token = "a".repeat(64);
  const tokenHash = "b".repeat(64);

  function setupPasswordService() {
    const repository: RegentPasswordChangeRepository = {
      armRetryProof: vi.fn(async () => {}),
      clearRetryProof: vi.fn(async () => {}),
      completeWithProof: vi.fn(async () => true),
      isCompleted: vi.fn(async () => false),
    };
    const auth = { updateUserById: vi.fn(async () => {}) };
    const proofs = {
      create: vi.fn(async () => ({ token, hash: tokenHash })),
      hash: vi.fn(async () => tokenHash),
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

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "success" });

    expect(repository.armRetryProof).toHaveBeenCalledWith(regent, tokenHash);
    expect(repository.armRetryProof).not.toHaveBeenCalledWith(regent, token);
    expect(auth.updateUserById).toHaveBeenCalledExactlyOnceWith(regent.userId, {
      password: "SenhaNova123",
    });
    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, tokenHash);
    expect(vi.mocked(repository.armRetryProof).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.updateUserById).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(auth.updateUserById).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.completeWithProof).mock.invocationCallOrder[0],
    );
  });

  it("exposes the raw retry token only after Auth succeeds and completion remains pending", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(repository.completeWithProof).mockRejectedValue(new Error("database unavailable"));

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({
      status: "completion_required",
      retryToken: token,
    });

    expect(auth.updateUserById).toHaveBeenCalledOnce();
    expect(repository.isCompleted).toHaveBeenCalledWith(regent);
  });

  it("does not expose proof when Auth fails and clears only its own stale hash", async () => {
    const { service, repository, auth } = setupPasswordService();
    vi.mocked(auth.updateUserById).mockRejectedValue(new Error("SECRET_AUTH_DETAIL"));

    await expect(service.change(regent, "SenhaNova123")).rejects.toThrow(
      "Não foi possível alterar a senha.",
    );

    expect(repository.clearRetryProof).toHaveBeenCalledExactlyOnceWith(regent, tokenHash);
    expect(repository.completeWithProof).not.toHaveBeenCalled();
  });

  it("accepts completion only with a matching server proof for the active caller", async () => {
    const { service, repository, proofs } = setupPasswordService();
    const suppliedToken = "c".repeat(64);

    await expect(service.complete(regent, suppliedToken)).resolves.toEqual({ status: "success" });

    expect(proofs.hash).toHaveBeenCalledExactlyOnceWith(suppliedToken);
    expect(repository.completeWithProof).toHaveBeenCalledExactlyOnceWith(regent, tokenHash);
  });

  it("rejects direct completion when the proof does not match a still-gated membership", async () => {
    const { service, repository } = setupPasswordService();
    vi.mocked(repository.completeWithProof).mockResolvedValue(false);
    vi.mocked(repository.isCompleted).mockResolvedValue(false);

    await expect(service.complete(regent, "c".repeat(64))).rejects.toThrow(
      "Não foi possível concluir a alteração de senha.",
    );
  });

  it("treats a lost completion response as success when reconciliation sees the gate closed", async () => {
    const { service, repository } = setupPasswordService();
    vi.mocked(repository.completeWithProof).mockRejectedValue(new Error("response lost"));
    vi.mocked(repository.isCompleted).mockResolvedValue(true);

    await expect(service.change(regent, "SenhaNova123")).resolves.toEqual({ status: "success" });
  });

  it("rejects administrators without touching a regent membership", async () => {
    const { service, repository, auth } = setupPasswordService();
    const admin: PortalAccess = { role: "admin", userId: "admin", email: null };

    await expect(service.change(admin, "SenhaNova123")).rejects.toThrow(
      "Não foi possível alterar a senha.",
    );
    await expect(service.complete(admin, token)).rejects.toThrow(
      "Não foi possível concluir a alteração de senha.",
    );
    expect(repository.armRetryProof).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });
});

describe("Supabase regent password proof adapter", () => {
  it("arms only the gated active caller membership with the proof hash", async () => {
    const hash = "b".repeat(64);

    await createSupabaseRegentPasswordChangeRepository().armRetryProof(regent, hash);

    expect(update).toHaveBeenCalledExactlyOnceWith({ password_change_retry_token_hash: hash });
    expect(eq.mock.calls).toEqual([
      ["id", regent.membershipId],
      ["user_id", regent.userId],
      ["password_change_required", true],
    ]);
    expect(is).toHaveBeenCalledExactlyOnceWith("revoked_at", null);
  });

  it("clears the gate only for an active caller row with the matching proof hash", async () => {
    const hash = "b".repeat(64);

    await expect(
      createSupabaseRegentPasswordChangeRepository().completeWithProof(regent, hash),
    ).resolves.toBe(true);

    expect(update).toHaveBeenCalledExactlyOnceWith({
      password_change_required: false,
      password_change_retry_token_hash: null,
    });
    expect(eq.mock.calls).toEqual([
      ["id", regent.membershipId],
      ["user_id", regent.userId],
      ["password_change_required", true],
      ["password_change_retry_token_hash", hash],
    ]);
    expect(is).toHaveBeenCalledExactlyOnceWith("revoked_at", null);
  });
});
