import { describe, expect, it, vi } from "vitest";
import {
  createRegentAdminService,
  createSupabaseRegentAdminRepository,
  createSupabaseRegentAuthAdmin,
  type AdminRegentRow,
  type RegentAdminRepository,
  type RegentAuthAdminPort,
} from "./regent-admin.server";

const { from, rpc, authAdmin } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  authAdmin: {
    createUser: vi.fn(),
    updateUserById: vi.fn(),
    deleteUser: vi.fn(),
    listUsers: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, rpc, auth: { admin: authAdmin } },
}));
const choirId = "11111111-1111-4111-8111-111111111111";
const input = {
  choirId,
  name: "Ana Silva",
  email: "regente@example.com",
  password: "SenhaTemp123",
};
const row: AdminRegentRow = {
  id: "22222222-2222-4222-8222-222222222222",
  choirId,
  userId: "created-user",
  name: "Ana Silva",
  email: input.email,
  passwordChangeRequired: true,
  revokedAt: null,
};
function setup() {
  const repository: RegentAdminRepository = {
    list: vi.fn(async () => [row]),
    findById: vi.fn(async () => row),
    findActiveByChoir: vi.fn(async () => null),
    grant: vi.fn(async () => row),
    replace: vi.fn(async () => row),
    revoke: vi.fn(async () => ({ ...row, revokedAt: "2026-09-11T12:00:00Z" })),
    requirePasswordChange: vi.fn(async () => row),
  };
  const auth: RegentAuthAdminPort = {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async () => ({ id: "created-user" })),
    deleteUser: vi.fn(async () => {}),
    updateUserById: vi.fn(async () => {}),
  };
  return { repository, auth, service: createRegentAdminService({ repository, auth }) };
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
  it("rejects an occupied choir before creating Auth data", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.findActiveByChoir).mockResolvedValue(row);
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({
      status: "conflict",
    });
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it.each(["create", "replace"] as const)(
    "cleans up only the just-created user after a failed %s grant",
    async (operation) => {
      const { service, auth, repository } = setup();
      vi.mocked(repository.grant).mockRejectedValue(new Error("private DB failure"));
      vi.mocked(repository.replace).mockRejectedValue(new Error("private DB failure"));
      const result = await service[operation](input, "admin-user");
      expect(result).toMatchObject({ status: "error" });
      expect(JSON.stringify(result)).not.toContain("private DB");
      expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith("created-user");
      expect(repository.revoke).not.toHaveBeenCalled();
    },
  );
  it("does not attempt cleanup if Auth creation failed", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(auth.createUser).mockRejectedValue(new Error("Auth failure"));
    await expect(service.create(input, "admin-user")).resolves.toMatchObject({ status: "error" });
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.grant).not.toHaveBeenCalled();
  });
  it("reports failed cleanup without attempting to delete a different user", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.grant).mockRejectedValue(new Error("failure"));
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
  it("resets the membership's resolved user and closes the password gate first", async () => {
    const { service, auth, repository } = setup();
    await expect(service.resetPassword(row.id, "NewPassword123")).resolves.toMatchObject({
      status: "success",
    });
    expect(repository.requirePasswordChange).toHaveBeenCalledExactlyOnceWith(row.id);
    expect(auth.updateUserById).toHaveBeenCalledWith("created-user", {
      password: "NewPassword123",
    });
    expect(vi.mocked(repository.requirePasswordChange).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.updateUserById).mock.invocationCallOrder[0],
    );
  });
  it("does not change Auth when the password gate cannot be set", async () => {
    const { service, auth, repository } = setup();
    vi.mocked(repository.requirePasswordChange).mockRejectedValue(new Error("DB error"));
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
    });
    expect(from).not.toHaveBeenCalled();
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
  it("uses the direct Auth admin reset API", async () => {
    authAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: "created-user" } },
      error: null,
    });
    await createSupabaseRegentAuthAdmin().updateUserById("created-user", {
      password: "NewPassword123",
    });
    expect(authAdmin.updateUserById).toHaveBeenCalledWith("created-user", {
      password: "NewPassword123",
    });
  });
});
