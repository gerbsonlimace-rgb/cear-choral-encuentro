import { describe, expect, it, vi } from "vitest";
import {
  createRegentAdminService,
  createSupabaseRegentAdminRepository,
  createSupabaseRegentAuthAdmin,
  createSupabaseRegentCandidateSearch,
  RegentGrantFailure,
  type AdminRegentRow,
  type RegentAdminRepository,
  type RegentAuthAdminPort,
} from "./regent-admin.server";

const { from, rpc, authAdmin, probeAuth, createSupabaseAdminClient } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  authAdmin: {
    createUser: vi.fn(),
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
    deleteUser: vi.fn(),
    listUsers: vi.fn(),
  },
  probeAuth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, rpc, auth: { admin: authAdmin } },
  createSupabaseAdminClient,
}));
const choirId = "11111111-1111-4111-8111-111111111111";
const input = {
  choirId,
  name: "Ana Silva",
  email: "regente@example.com",
  password: "SenhaTemp123",
};
type ExistingRegentInput = Omit<typeof input, "password">;
const row: AdminRegentRow = {
  id: "22222222-2222-4222-8222-222222222222",
  choirId,
  userId: "created-user",
  name: "Ana Silva",
  email: input.email,
  passwordChangeRequired: true,
  revokedAt: null,
};
const operationHash = "d".repeat(64);
const candidateFingerprint = "e".repeat(64);
function setup() {
  const repository: RegentAdminRepository = {
    list: vi.fn(async () => [row]),
    findById: vi.fn(async () => row),
    findActiveByChoir: vi.fn(async () => null),
    findByUserAndChoir: vi.fn(async () => null),
    grant: vi.fn(async () => row),
    replace: vi.fn(async () => row),
    revoke: vi.fn(async () => ({ ...row, revokedAt: "2026-09-11T12:00:00Z" })),
    claimPasswordOperation: vi.fn(async () => true),
    markPasswordOperationRetryable: vi.fn(async () => true),
    getPasswordOperation: vi.fn(async () => null),
    finishPasswordOperation: vi.fn(async () => row),
    finishRegentPasswordOperation: vi.fn(async () => {}),
    releasePasswordOperation: vi.fn(async () => true),
  };
  const auth: RegentAuthAdminPort = {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async () => ({ id: "created-user" })),
    deleteUser: vi.fn(async () => {}),
    inspectUser: vi.fn(async () => ({ appMetadata: {} })),
    passwordMatches: vi.fn(async () => "different" as const),
    updateUserById: vi.fn(async (): Promise<"updated" | "rejected" | "unknown"> => "updated"),
    updateAppMetadata: vi.fn(async () => "updated" as const),
  };
  const proofs = {
    createOperation: vi.fn(async () => ({ operationHash, candidateFingerprint })),
  };
  return {
    repository,
    auth,
    proofs,
    service: createRegentAdminService({ repository, auth, proofs }),
  };
}
describe("regent administrative lifecycle", () => {
  it("creates an already-confirmed Auth user and grants only password-free identity data", async () => {
    const { service, auth, repository } = setup();
    await expect(service.create(input, "admin-user")).resolves.toEqual({
      status: "success",
      regent: row,
    });
    expect(auth.createUser).toHaveBeenCalledWith({
      email: input.email,
      password: "SenhaTemp123",
      emailConfirm: true,
    });
    expect(repository.grant).toHaveBeenCalledWith({
      choirId,
      userId: "created-user",
      name: "Ana Silva",
      email: input.email,
      passwordChangeRequired: true,
      grantedBy: "admin-user",
    });
  });
  it("rejects an existing email without creating, modifying or deleting that user", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({
      status: "conflict",
    });
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("links an existing Auth account without changing its password or requiring a password change", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    vi.mocked(repository.list).mockResolvedValue([{ ...row, userId: "existing-user", name: "Irmã Macrina", email: "macrina@example.com", revokedAt: "2026-09-11" }]);
    vi.mocked(repository.grant).mockResolvedValue({ ...row, passwordChangeRequired: false });

    await expect(
      (service as unknown as {
        linkExisting(input: ExistingRegentInput, actorId: string): Promise<unknown>;
      }).linkExisting(
        { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
        "admin-user",
      ),
    ).resolves.toEqual({ status: "success", regent: { ...row, passwordChangeRequired: false } });

    expect(repository.grant).toHaveBeenCalledWith({
      choirId,
      userId: "existing-user",
      name: "Irmã Macrina",
      email: "macrina@example.com",
      passwordChangeRequired: false,
      grantedBy: "admin-user",
    });
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
  it("replaces a regent with an existing account without changing that account password", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    vi.mocked(repository.list).mockResolvedValue([{ ...row, userId: "existing-user", name: "Irmã Macrina", email: "macrina@example.com", revokedAt: "2026-09-11" }]);
    vi.mocked(repository.replace).mockResolvedValue({ ...row, passwordChangeRequired: false });

    await expect(
      (service as unknown as {
        replaceExisting(input: ExistingRegentInput, actorId: string): Promise<unknown>;
      }).replaceExisting(
        { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
        "admin-user",
      ),
    ).resolves.toEqual({ status: "success", regent: { ...row, passwordChangeRequired: false } });

    expect(repository.replace).toHaveBeenCalledWith({
      choirId,
      userId: "existing-user",
      name: "Irmã Macrina",
      email: "macrina@example.com",
      passwordChangeRequired: false,
      grantedBy: "admin-user",
    });
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });
  it("reports a missing existing account without changing memberships", async () => {
    const { service, repository } = setup();

    await expect(
      (service as unknown as {
        linkExisting(input: ExistingRegentInput, actorId: string): Promise<unknown>;
      }).linkExisting(
        { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
        "admin-user",
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Nenhuma conta encontrada com esse e-mail.",
    });

    expect(repository.grant).not.toHaveBeenCalled();
    expect(repository.replace).not.toHaveBeenCalled();
  });
  it("rejects a registered user who was never a regent", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "participant-user" });
    await expect(service.linkExisting({ choirId, name: "Participante", email: "participant@example.com" }, "admin-user")).resolves.toEqual({
      status: "error", message: "Selecione um regente já cadastrado.",
    });
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("does not assign a regent who is active in another choir", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    vi.mocked(repository.list).mockResolvedValue([{ ...row, userId: "existing-user", email: "macrina@example.com", choirId: "33333333-3333-4333-8333-333333333333" }]);
    await expect(service.linkExisting({ choirId, name: "Irmã Macrina", email: "macrina@example.com" }, "admin-user")).resolves.toMatchObject({ status: "conflict" });
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("rejects an occupied choir before creating Auth data", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.findActiveByChoir).mockResolvedValue(row);
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({
      status: "conflict",
    });
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it.each(["create", "replace"] as const)(
    "cleans up only the just-created user after a confirmed %s rejection and absent link",
    async (operation) => {
      const { service, auth, repository } = setup();
      vi.mocked(repository.grant).mockRejectedValue(new RegentGrantFailure("confirmed_rejection"));
      vi.mocked(repository.replace).mockRejectedValue(
        new RegentGrantFailure("confirmed_rejection"),
      );
      const result = await service[operation](input, "admin-user");
      expect(result).toMatchObject({ status: "error" });
      expect(JSON.stringify(result)).not.toContain("private DB");
      expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith("created-user");
      expect(repository.findByUserAndChoir).toHaveBeenCalledExactlyOnceWith(
        "created-user",
        choirId,
      );
      expect(vi.mocked(repository.findByUserAndChoir).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(auth.deleteUser).mock.invocationCallOrder[0],
      );
      expect(repository.revoke).not.toHaveBeenCalled();
    },
  );
  it.each(["create", "replace"] as const)(
    "keeps the Auth user after unknown %s failure even when a commit is invisible at reconciliation",
    async (operation) => {
      const { service, auth, repository } = setup();
      let committed: AdminRegentRow | null = null;
      let accountExists = true;
      vi.mocked(auth.deleteUser).mockImplementation(async () => {
        accountExists = false;
      });
      vi.mocked(repository[operation === "create" ? "grant" : "replace"]).mockRejectedValue(
        new Error("transport disconnected while write still runs"),
      );
      vi.mocked(repository.findByUserAndChoir).mockImplementation(async () => committed);
      const result = await service[operation](input, "admin-user");
      // The original database statement can finish only after the reconciliation snapshot.
      committed = row;
      expect(result).toMatchObject({
        status: "error",
        message: expect.stringContaining("administrador"),
      });
      expect(repository.findByUserAndChoir).toHaveBeenCalledExactlyOnceWith(
        "created-user",
        choirId,
      );
      expect(auth.deleteUser).not.toHaveBeenCalled();
      expect(accountExists).toBe(true);
      expect(committed.userId).toBe("created-user");
    },
  );
  it.each(["create", "replace"] as const)(
    "retains the new Auth user when %s commits but its response is lost",
    async (operation) => {
      const { service, auth, repository } = setup();
      let committed: AdminRegentRow | null = null;
      vi.mocked(repository[operation === "create" ? "grant" : "replace"]).mockImplementation(
        async () => {
          committed = row;
          throw new Error("response lost after commit");
        },
      );
      vi.mocked(repository.findByUserAndChoir).mockImplementation(async () => committed);
      await expect(service[operation](input, "admin-user")).resolves.toEqual({
        status: "success",
        regent: row,
      });
      expect(repository.findByUserAndChoir).toHaveBeenCalledExactlyOnceWith(
        "created-user",
        choirId,
      );
      expect(auth.deleteUser).not.toHaveBeenCalled();
      expect(repository.revoke).not.toHaveBeenCalled();
    },
  );
  it.each(["create", "replace"] as const)(
    "retains the Auth user when reconciliation after %s is unavailable",
    async (operation) => {
      const { service, auth, repository } = setup();
      vi.mocked(repository[operation === "create" ? "grant" : "replace"]).mockRejectedValue(
        new Error("response lost"),
      );
      vi.mocked(repository.findByUserAndChoir).mockRejectedValue(new Error("private DB details"));
      const result = await service[operation](input, "admin-user");
      expect(result).toMatchObject({
        status: "error",
        message: expect.stringContaining("administrador"),
      });
      expect(JSON.stringify(result)).not.toContain("private DB details");
      expect(auth.deleteUser).not.toHaveBeenCalled();
    },
  );
  it("retains a created user whose committed membership was subsequently revoked", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.grant).mockRejectedValue(new Error("response lost"));
    vi.mocked(repository.findByUserAndChoir).mockResolvedValue({
      ...row,
      revokedAt: "2026-09-11T12:00:00Z",
    });
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("administrador"),
    });
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
  it("does not attempt cleanup if Auth creation failed", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.createUser).mockRejectedValue(new Error("Auth failure"));
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({ status: "error" });
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("reports failed cleanup without attempting to delete a different user", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.grant).mockRejectedValue(new RegentGrantFailure("confirmed_rejection"));
    vi.mocked(auth.deleteUser).mockRejectedValue(new Error("cleanup failure"));
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("administrador"),
    });
    expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith("created-user");
  });
  it("uses one atomic repository replacement without revoking first", async () => {
    const { service, repository } = setup();
    await expect(service.replace(input, "admin-user")).resolves.toMatchObject({
      status: "success",
    });
    expect(repository.replace).toHaveBeenCalledWith(
      expect.objectContaining({ choirId, userId: "created-user", grantedBy: "admin-user" }),
    );
    expect(repository.revoke).not.toHaveBeenCalled();
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("claims the membership before resetting its resolved Auth user and finishes afterward", async () => {
    const { service, auth, repository } = setup();
    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "success",
    });
    const claim = vi.mocked(repository.claimPasswordOperation);
    const finish = vi.mocked(repository.finishPasswordOperation);
    expect(claim).toHaveBeenCalledWith(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
    );
    expect(auth.updateUserById).toHaveBeenCalledWith("created-user", {
      password: "NewPassword123",
      appMetadata: {
        regent_password_operation: {
          kind: "admin",
          membership_id: row.id,
          operation_hash: operationHash,
        },
      },
    });
    expect(finish).toHaveBeenCalledExactlyOnceWith(row.id, row.userId, "admin", operationHash);
    expect(claim.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.updateUserById).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(auth.updateUserById).mock.invocationCallOrder[0]).toBeLessThan(
      finish.mock.invocationCallOrder[0],
    );
  });
  it("does not change Auth when a durable password operation cannot be claimed", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });
  it("does not reset an inactive membership", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.findById).mockResolvedValue({ ...row, revokedAt: "2026-09-11" });
    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });
  it("lets only one durable password operation reach Auth during an admin/regent interleaving", async () => {
    const { service, auth, repository } = setup();
    const claimPasswordOperation = vi.fn(async () => false);
    Object.assign(repository, { claimPasswordOperation });

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(claimPasswordOperation).toHaveBeenCalledWith(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
    );
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("finishes an older proven admin operation then applies the currently requested password", async () => {
    const { service, auth, repository } = setup();
    Object.assign(repository, {
      claimPasswordOperation: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      getPasswordOperation: vi.fn(async () => ({
        kind: "admin",
        hash: "b".repeat(64),
        stage: "legacy" as const,
        candidateFingerprint: null,
      })),
      finishPasswordOperation: vi.fn(async () => row),
    });
    Object.assign(auth, {
      inspectUser: vi.fn(async () => ({
        appMetadata: {
          regent_password_operation: {
            kind: "admin",
            membership_id: row.id,
            operation_hash: "b".repeat(64),
          },
        },
      })),
    });

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "success",
    });

    const claims = vi.mocked(repository.claimPasswordOperation);
    const currentHash = claims.mock.calls[1][3];
    expect(currentHash).not.toBe("b".repeat(64));
    expect(auth.updateUserById).toHaveBeenCalledExactlyOnceWith(row.userId, {
      password: "NewPassword123",
      appMetadata: {
        regent_password_operation: {
          kind: "admin",
          membership_id: row.id,
          operation_hash: currentHash,
        },
      },
    });
    expect(repository.finishPasswordOperation).toHaveBeenNthCalledWith(
      1,
      row.id,
      row.userId,
      "admin",
      "b".repeat(64),
    );
    expect(repository.finishPasswordOperation).toHaveBeenNthCalledWith(
      2,
      row.id,
      row.userId,
      "admin",
      currentHash,
    );
  });

  it("finishes a proven regent operation then applies the current administrator reset", async () => {
    const { service, auth, repository } = setup();
    Object.assign(repository, {
      claimPasswordOperation: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      getPasswordOperation: vi.fn(async () => ({
        kind: "regent" as const,
        hash: "b".repeat(64),
        stage: "legacy" as const,
        candidateFingerprint: null,
      })),
    });
    vi.mocked(auth.inspectUser).mockResolvedValue({
      appMetadata: {
        regent_password_operation: {
          kind: "regent",
          membership_id: row.id,
          operation_hash: "b".repeat(64),
        },
      },
    });

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "success",
    });

    const claims = vi.mocked(repository.claimPasswordOperation);
    const currentHash = claims.mock.calls[1][3];
    expect(repository.finishRegentPasswordOperation).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "b".repeat(64),
    );
    expect(auth.updateUserById).toHaveBeenCalledExactlyOnceWith(row.userId, {
      password: "NewPassword123",
      appMetadata: {
        regent_password_operation: {
          kind: "admin",
          membership_id: row.id,
          operation_hash: currentHash,
        },
      },
    });
    expect(
      vi.mocked(repository.finishRegentPasswordOperation).mock.invocationCallOrder[0],
    ).toBeLessThan(claims.mock.invocationCallOrder[1]);
  });

  it("does not report success for the current reset when a fresh admin claim loses the race", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    vi.mocked(repository.getPasswordOperation)
      .mockResolvedValueOnce({
        kind: "regent",
        hash: "b".repeat(64),
        stage: "legacy",
        candidateFingerprint: null,
      })
      .mockResolvedValueOnce(null);
    vi.mocked(auth.inspectUser).mockResolvedValue({
      appMetadata: {
        regent_password_operation: {
          kind: "regent",
          membership_id: row.id,
          operation_hash: "b".repeat(64),
        },
      },
    });

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(repository.finishRegentPasswordOperation).toHaveBeenCalledOnce();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(repository.finishPasswordOperation).not.toHaveBeenCalled();
  });

  it("does not finalize an unproven regent operation before an administrator reset", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "regent",
      hash: "b".repeat(64),
      stage: "legacy",
      candidateFingerprint: null,
    });

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(repository.finishRegentPasswordOperation).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("releases an exact read-back admin claim if pre-Auth inspection fails", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation).mockRejectedValue(
      new TypeError("claim response lost"),
    );
    vi.mocked(repository.getPasswordOperation).mockImplementation(async () => ({
      kind: "admin",
      hash: vi.mocked(repository.claimPasswordOperation).mock.calls[0][3],
      stage: "claimed" as const,
      candidateFingerprint,
    }));
    vi.mocked(auth.inspectUser).mockRejectedValue(new TypeError("Auth unavailable"));

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    const operationHash = vi.mocked(repository.claimPasswordOperation).mock.calls[0][3];
    expect(repository.releasePasswordOperation).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
      "claimed",
    );
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("recovers an unknown Auth reset response from its durable metadata proof", async () => {
    const { service, auth, repository } = setup();
    let writtenMetadata: Record<string, unknown> = {};
    vi.mocked(auth.updateUserById).mockImplementation(async (_userId, attributes) => {
      writtenMetadata = attributes.appMetadata;
      return "unknown";
    });
    vi.mocked(auth.inspectUser)
      .mockResolvedValueOnce({ appMetadata: {} })
      .mockImplementation(async () => ({ appMetadata: writtenMetadata }));

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "success",
    });

    expect(auth.updateUserById).toHaveBeenCalledOnce();
    expect(auth.inspectUser).toHaveBeenCalledTimes(2);
    expect(repository.finishPasswordOperation).toHaveBeenCalledOnce();
    expect(repository.releasePasswordOperation).not.toHaveBeenCalled();
  });

  it("keeps the claim locked when an unknown Auth reset cannot yet be proven", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.updateUserById).mockResolvedValue("unknown");

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(auth.inspectUser).toHaveBeenCalledTimes(2);
    expect(repository.releasePasswordOperation).not.toHaveBeenCalled();
    expect(repository.finishPasswordOperation).not.toHaveBeenCalled();
    expect(repository.markPasswordOperationRetryable).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
    );
  });

  it("adopts the same admin candidate after an unknown unapplied reset and reissues the exact operation", async () => {
    const { service, auth, repository } = setup();
    const existingHash = "b".repeat(64);
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "admin",
      hash: existingHash,
      stage: "retryable",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("different");

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toEqual({
      status: "success",
      regent: row,
    });

    expect(auth.updateUserById).toHaveBeenCalledExactlyOnceWith(row.userId, {
      password: "NewPassword123",
      appMetadata: {
        regent_password_operation: {
          kind: "admin",
          membership_id: row.id,
          operation_hash: existingHash,
        },
      },
    });
    expect(repository.finishPasswordOperation).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "admin",
      existingHash,
    );
  });

  it("repairs exact metadata when the same admin candidate already became current", async () => {
    const { service, auth, repository } = setup();
    const existingHash = "b".repeat(64);
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "admin",
      hash: existingHash,
      stage: "retryable",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("matches");

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toEqual({
      status: "success",
      regent: row,
    });

    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.updateAppMetadata).toHaveBeenCalledExactlyOnceWith(row.userId, {
      regent_password_operation: {
        kind: "admin",
        membership_id: row.id,
        operation_hash: existingHash,
      },
    });
    expect(repository.finishPasswordOperation).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "admin",
      existingHash,
    );
  });

  it("does not report success when same-candidate metadata repair remains unproven", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "admin",
      hash: "b".repeat(64),
      stage: "retryable",
      candidateFingerprint,
    });
    vi.mocked(auth.passwordMatches).mockResolvedValue("matches");
    vi.mocked(auth.updateAppMetadata).mockResolvedValue("unknown");

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(repository.finishPasswordOperation).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects a different unproven admin candidate without updating or releasing Auth state", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.claimPasswordOperation).mockResolvedValue(false);
    vi.mocked(repository.getPasswordOperation).mockResolvedValue({
      kind: "admin",
      hash: "b".repeat(64),
      stage: "retryable",
      candidateFingerprint: "f".repeat(64),
    });

    await expect(service.resetPassword(row.id, "DifferentPassword123")).resolves.toMatchObject({
      status: "error",
    });

    expect(auth.inspectUser).toHaveBeenCalledExactlyOnceWith(row.userId);
    expect(auth.passwordMatches).not.toHaveBeenCalled();
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect(auth.updateAppMetadata).not.toHaveBeenCalled();
    expect(repository.releasePasswordOperation).not.toHaveBeenCalled();
  });

  it("releases only its own claim after a confirmed Auth rejection", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.updateUserById).mockResolvedValue("rejected");

    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "error",
    });

    const operationHash = vi.mocked(repository.claimPasswordOperation).mock.calls[0][3];
    expect(repository.releasePasswordOperation).toHaveBeenCalledExactlyOnceWith(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
      "claimed",
    );
    expect(repository.finishPasswordOperation).not.toHaveBeenCalled();
  });
  it("records who revoked access without deleting the Auth account", async () => {
    const { service, auth, repository } = setup();
    await expect(service.revoke(row.id, "admin-user")).resolves.toMatchObject({
      status: "success",
    });
    expect(repository.revoke).toHaveBeenCalledWith(row.id, "admin-user");
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
});
describe("Supabase administrative adapters", () => {
  const grant = {
    choirId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    passwordChangeRequired: true as const,
    grantedBy: "admin-user",
  };
  it.each(["grant", "replace"] as const)(
    "marks a completed database constraint rejection as confirmed for %s",
    async (operation) => {
      const response = {
        data: null,
        error: { code: "23505", message: "private database details" },
      };
      rpc.mockResolvedValue(response);
      from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(async () => response),
      });
      await expect(createSupabaseRegentAdminRepository()[operation](grant)).rejects.toMatchObject({
        outcome: "confirmed_rejection",
        conflict: true,
      });
    },
  );
  it.each(["", "08007", "40003", "PGRST116"])(
    "keeps response code %s unknown rather than inferring rollback",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { code, message: "unknown result" } });
      await expect(createSupabaseRegentAdminRepository().replace(grant)).rejects.toMatchObject({
        outcome: "unknown",
      });
    },
  );
  it("marks a thrown transport failure unknown even if it carries a database-like code", async () => {
    rpc.mockRejectedValue(Object.assign(new Error("connection lost"), { code: "23505" }));
    await expect(createSupabaseRegentAdminRepository().replace(grant)).rejects.toMatchObject({
      outcome: "unknown",
    });
  });
  it("reconciles by the exact new user and choir without hiding revoked history", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: row.id,
          user_id: row.userId,
          choir_id: choirId,
          name: row.name,
          email: row.email,
          password_change_required: true,
          revoked_at: "2026-09-11T12:00:00Z",
        },
        error: null,
      })),
    };
    from.mockReturnValue(query);
    await expect(
      createSupabaseRegentAdminRepository().findByUserAndChoir("created-user", choirId),
    ).resolves.toEqual({ ...row, revokedAt: "2026-09-11T12:00:00Z" });
    expect(from).toHaveBeenCalledWith("choir_regents");
    expect(query.eq.mock.calls).toEqual([
      ["user_id", "created-user"],
      ["choir_id", choirId],
    ]);
  });
  it("does not interpret a failed reconciliation query as an absent membership", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
    };
    from.mockReturnValue(query);
    await expect(
      createSupabaseRegentAdminRepository().findByUserAndChoir("created-user", choirId),
    ).rejects.toThrow();
  });
  it("maps replacement to the atomic RPC with no temporary password", async () => {
    rpc.mockResolvedValue({
      data: {
        id: row.id,
        choir_id: choirId,
        user_id: row.userId,
        name: row.name,
        email: row.email,
        password_change_required: true,
        revoked_at: null,
      },
      error: null,
    });
    await createSupabaseRegentAdminRepository().replace({
      choirId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      passwordChangeRequired: true,
      grantedBy: "admin-user",
    });
    expect(rpc).toHaveBeenCalledWith("replace_active_choir_regent", {
      p_choir_id: choirId,
      p_user_id: "created-user",
      p_name: "Ana Silva",
      p_email: "regente@example.com",
      p_granted_by: "admin-user",
      p_password_change_required: true,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it("reads the exact active password operation for recovery", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          password_change_operation_kind: "admin",
          password_change_retry_token_hash: "b".repeat(64),
          password_change_operation_stage: "retryable",
          password_change_candidate_fingerprint: candidateFingerprint,
        },
        error: null,
      })),
    };
    from.mockReturnValue(query);

    await expect(
      createSupabaseRegentAdminRepository().getPasswordOperation(row.id, row.userId),
    ).resolves.toEqual({
      kind: "admin",
      hash: "b".repeat(64),
      stage: "retryable",
      candidateFingerprint,
    });

    expect(query.eq.mock.calls).toEqual([
      ["id", row.id],
      ["user_id", row.userId],
    ]);
    expect(query.is).toHaveBeenCalledExactlyOnceWith("revoked_at", null);
  });
  it("claims, promotes, and releases an exact administrator candidate through stage-CAS RPCs", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const repository = createSupabaseRegentAdminRepository();

    await repository.claimPasswordOperation(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
    );
    await repository.markPasswordOperationRetryable(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
    );
    await repository.releasePasswordOperation(
      row.id,
      row.userId,
      "admin",
      operationHash,
      candidateFingerprint,
      "claimed",
    );

    expect(rpc.mock.calls).toEqual([
      [
        "claim_choir_regent_admin_password_candidate_operation",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_membership_id: row.id,
          p_operation_hash: operationHash,
          p_user_id: row.userId,
        },
      ],
      [
        "mark_choir_regent_admin_password_operation_retryable",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_membership_id: row.id,
          p_operation_hash: operationHash,
          p_user_id: row.userId,
        },
      ],
      [
        "release_choir_regent_admin_password_candidate_operation",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_expected_stage: "claimed",
          p_membership_id: row.id,
          p_operation_hash: operationHash,
          p_user_id: row.userId,
        },
      ],
    ]);
  });
  it("finishes an Auth-proven regent operation through the exact shared RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await createSupabaseRegentAdminRepository().finishRegentPasswordOperation(
      row.id,
      row.userId,
      "b".repeat(64),
    );

    expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_choir_regent_password_operation", {
      p_membership_id: row.id,
      p_user_id: row.userId,
      p_operation_kind: "regent",
      p_operation_hash: "b".repeat(64),
    });
  });
  it("uses email_confirm without sending an invitation", async () => {
    authAdmin.createUser.mockResolvedValue({ data: { user: { id: "new" } }, error: null });
    await createSupabaseRegentAuthAdmin().createUser({
      email: input.email,
      password: input.password,
      emailConfirm: true,
    });
    expect(authAdmin.createUser).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
  });
  it("checks all Auth pages for an existing normalized email", async () => {
    authAdmin.listUsers
      .mockResolvedValueOnce({
        data: { users: [{ id: "other", email: "other@example.com" }], nextPage: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [{ id: "existing", email: "REGENTE@example.com" }], nextPage: null },
        error: null,
      });
    await expect(createSupabaseRegentAuthAdmin().findUserByEmail(input.email)).resolves.toEqual({
      id: "existing",
    });
    expect(authAdmin.listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 1000 });
  });
  it("uses the direct Auth admin reset API with operation metadata", async () => {
    authAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: "created-user" } },
      error: null,
    });
    await expect(
      createSupabaseRegentAuthAdmin().updateUserById("created-user", {
        password: "NewPassword123",
        appMetadata: { retained: true, regent_password_operation: { kind: "admin" } },
      }),
    ).resolves.toBe("updated");
    expect(authAdmin.updateUserById).toHaveBeenCalledWith("created-user", {
      password: "NewPassword123",
      app_metadata: { retained: true, regent_password_operation: { kind: "admin" } },
    });
  });

  it("classifies Auth reset rejection separately from an unknown transport result", async () => {
    authAdmin.updateUserById.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "same_password", status: 422 },
    });
    const adapter = createSupabaseRegentAuthAdmin();
    await expect(
      adapter.updateUserById("created-user", { password: "same", appMetadata: {} }),
    ).resolves.toBe("rejected");

    authAdmin.updateUserById.mockRejectedValueOnce(new TypeError("transport lost"));
    await expect(
      adapter.updateUserById("created-user", { password: "unknown", appMetadata: {} }),
    ).resolves.toBe("unknown");
  });

  it("probes the requested administrator candidate in an isolated non-persistent session", async () => {
    createSupabaseAdminClient.mockReturnValue({ auth: probeAuth });
    probeAuth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "private" } },
      error: null,
    });
    probeAuth.signOut.mockResolvedValue({ error: null });

    await expect(
      createSupabaseRegentAuthAdmin().passwordMatches(row.email, "NewPassword123"),
    ).resolves.toBe("matches");

    expect(probeAuth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: row.email,
      password: "NewPassword123",
    });
    expect(probeAuth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("updates only exact administrator proof metadata during same-candidate recovery", async () => {
    authAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: row.userId } },
      error: null,
    });
    const metadata = {
      regent_password_operation: {
        kind: "admin",
        membership_id: row.id,
        operation_hash: operationHash,
      },
    };

    await expect(
      createSupabaseRegentAuthAdmin().updateAppMetadata(row.userId, metadata),
    ).resolves.toBe("updated");

    expect(authAdmin.updateUserById).toHaveBeenCalledWith(row.userId, {
      app_metadata: metadata,
    });
  });
});

describe("candidate user search", () => {
  const row = {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user-1",
    email: "regent@example.com",
    name: "Maria",
    passwordChangeRequired: false,
    revokedAt: null,
  };

  function stubbedQuery(result: { data: unknown; error: unknown }) {
    return {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => result),
    };
  }

  it("searches only registered regents and deduplicates by account", async () => {
    from.mockImplementation(() => stubbedQuery({
      data: [
        { name: "Irmã Macrina", email: "macrina@example.com", user_id: "user-1" },
        { name: "Pe. Lucas", email: "lucas@example.com", user_id: "user-2" },
        { name: "Irmã Macrina", email: "macrina@example.com", user_id: "user-1" },
      ],
      error: null,
    }));

    const search = createSupabaseRegentCandidateSearch();

    await expect(search.search("macrina")).resolves.toEqual([
      { userId: "user-1", email: "macrina@example.com", name: "Irmã Macrina" },
      { userId: "user-2", email: "lucas@example.com", name: "Pe. Lucas" },
    ]);
    expect(from).toHaveBeenCalledExactlyOnceWith("choir_regents");
  });

  it("escapes LIKE special characters in the search pattern", async () => {
    const regents = stubbedQuery({ data: [], error: null });
    from.mockImplementation(() => regents);

    const search = createSupabaseRegentCandidateSearch();
    await search.search("50%,_a\\b");

    expect(regents.or).toHaveBeenCalledExactlyOnceWith(
      "name.ilike.%50\\% \\_a\\\\b%,email.ilike.%50\\% \\_a\\\\b%",
    );
  });

  it("does not expose ordinary Auth users when no regent matches", async () => {
    from.mockImplementation(() => stubbedQuery({ data: [], error: null }));
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "user-7", email: "Macrina@example.com", user_metadata: { full_name: "Irmã Macrina" } },
          { id: "user-8", email: "other@example.com", user_metadata: {} },
        ],
        nextPage: null,
      },
      error: null,
    });

    const search = createSupabaseRegentCandidateSearch();

    await expect(search.search("macrina@example.com")).resolves.toEqual([]);
    expect(authAdmin.listUsers).not.toHaveBeenCalled();
  });

  it("maps search failures to a friendly Portuguese error and skips short queries", async () => {
    const { repository, auth, proofs } = setup();
    const failing = {
      search: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const service = createRegentAdminService({
      repository,
      auth,
      proofs,
      candidateSearch: failing,
    });

    await expect(service.searchCandidates("a")).resolves.toEqual([]);
    await expect(service.searchCandidates("macrina")).rejects.toThrow(
      "Não foi possível buscar usuários.",
    );
  });
});
