import { beforeEach, describe, expect, it, vi } from "vitest";

const { findAdmin, findParticipant } = vi.hoisted(() => ({
  findAdmin: vi.fn(),
  findParticipant: vi.fn(),
}));
vi.mock("@/features/admin/admin-auth.server", () => ({
  getAdminAuthorizer: () => ({ findActive: findAdmin }),
}));
vi.mock("@/features/participant/participant-auth.server", () => ({
  getParticipantAuthorizer: () => ({ findAccess: findParticipant }),
}));

import { resolvePortalModes } from "./portal-modes.server";

beforeEach(() => {
  findAdmin.mockReset();
  findParticipant.mockReset();
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
    });
    expect(findAdmin).toHaveBeenCalledWith("signed-in-user");
    expect(findParticipant).toHaveBeenCalledWith("signed-in-user");
  });

  it("does not grant an admin membership to an ordinary participant", async () => {
    findAdmin.mockResolvedValue(null);
    findParticipant.mockResolvedValue({ status: "authorized" });
    await expect(resolvePortalModes("participant")).resolves.toEqual({
      admin: false,
      participant: true,
    });
  });

  it("does not treat admin access as participant access", async () => {
    findAdmin.mockResolvedValue({ id: "membership" });
    findParticipant.mockResolvedValue({ status: "unavailable" });
    await expect(resolvePortalModes("admin-only")).resolves.toEqual({
      admin: true,
      participant: false,
    });
  });

  it("fails closed when either membership cannot be checked", async () => {
    findAdmin.mockRejectedValue(new Error("database unavailable"));
    findParticipant.mockResolvedValue({ status: "authorized" });
    await expect(resolvePortalModes("user")).rejects.toThrow("database unavailable");
  });
});
