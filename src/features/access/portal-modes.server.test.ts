import { beforeEach, describe, expect, it, vi } from "vitest";

const { findAdmin, findParticipant, findPortal } = vi.hoisted(() => ({
  findAdmin: vi.fn(),
  findParticipant: vi.fn(),
  findPortal: vi.fn(),
}));
vi.mock("@/features/admin/admin-auth.server", () => ({
  getAdminAuthorizer: () => ({ findActive: findAdmin }),
}));
vi.mock("@/features/participant/participant-auth.server", () => ({
  getParticipantAuthorizer: () => ({ findAccess: findParticipant }),
}));
vi.mock("@/features/regent/regent-auth.server", () => ({
  getPortalAuthorizer: () => ({ findActive: findPortal }),
}));

import { resolvePortalModes } from "./portal-modes.server";

beforeEach(() => {
  findAdmin.mockReset();
  findParticipant.mockReset();
  findPortal.mockReset();
  findPortal.mockResolvedValue(null);
});

describe("portal mode memberships", () => {
  it("uses the authenticated user's active memberships and returns no personal data", async () => {
    findAdmin.mockResolvedValue({ id: "membership", userId: "signed-in-user" });
    findParticipant.mockResolvedValue({
      status: "authorized",
      registrationId: "private-registration",
    });
    await expect(resolvePortalModes("signed-in-user")).resolves.toEqual({
      admin: true,
      participant: true,
      regent: false,
    });
    expect(findAdmin).toHaveBeenCalledWith("signed-in-user");
    expect(findParticipant).toHaveBeenCalledWith("signed-in-user");
  });

  it("flags an active regent membership without granting admin", async () => {
    findAdmin.mockResolvedValue(null);
    findParticipant.mockResolvedValue({ status: "authorized" });
    findPortal.mockResolvedValue({ role: "regent", choirId: "choir" });
    await expect(resolvePortalModes("regent-user")).resolves.toEqual({
      admin: false,
      participant: true,
      regent: true,
    });
  });

  it("does not flag a revoked or missing regent membership", async () => {
    findAdmin.mockResolvedValue(null);
    findParticipant.mockResolvedValue({ status: "authorized" });
    findPortal.mockResolvedValue(null);
    await expect(resolvePortalModes("participant")).resolves.toEqual({
      admin: false,
      participant: true,
      regent: false,
    });
  });

  it("does not treat admin access as participant access", async () => {
    findAdmin.mockResolvedValue({ id: "membership" });
    findParticipant.mockResolvedValue({ status: "unavailable" });
    await expect(resolvePortalModes("admin-only")).resolves.toEqual({
      admin: true,
      participant: false,
      regent: false,
    });
  });

  it("fails closed when either membership cannot be checked", async () => {
    findAdmin.mockRejectedValue(new Error("database unavailable"));
    findParticipant.mockResolvedValue({ status: "authorized" });
    await expect(resolvePortalModes("user")).rejects.toThrow("database unavailable");
  });
});
