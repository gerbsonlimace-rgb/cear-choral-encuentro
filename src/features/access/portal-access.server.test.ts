import { beforeEach, describe, expect, it, vi } from "vitest";

const { findParticipant, findPortal } = vi.hoisted(() => ({
  findParticipant: vi.fn(),
  findPortal: vi.fn(),
}));

vi.mock("@/features/regent/regent-auth.server", () => ({
  getPortalAuthorizer: () => ({ findActive: findPortal }),
}));
vi.mock("@/features/participant/participant-auth.server", () => ({
  getParticipantAuthorizer: () => ({ findAccess: findParticipant }),
}));

import { getUnifiedPortalAccessResolver } from "./portal-access.server";

beforeEach(() => {
  findPortal.mockReset();
  findParticipant.mockReset();
});

describe("unified portal server adapter", () => {
  it("maps the existing admin/regent authorizer before participant access", async () => {
    findPortal.mockResolvedValue({
      role: "admin",
      userId: "user-1",
      email: "admin@example.com",
    });

    await expect(
      getUnifiedPortalAccessResolver().resolve("user-1", "admin@example.com"),
    ).resolves.toEqual({ status: "authorized", destination: "/admin/inscricoes" });
    expect(findPortal).toHaveBeenCalledExactlyOnceWith("user-1", "admin@example.com");
    expect(findParticipant).not.toHaveBeenCalled();
  });

  it("accepts participant access only when the active paid account authorizer confirms it", async () => {
    findPortal.mockResolvedValue(null);
    findParticipant.mockResolvedValue({
      status: "authorized",
      accountId: "private-account",
      registrationId: "private-registration",
      userId: "user-1",
    });

    await expect(getUnifiedPortalAccessResolver().resolve("user-1", null)).resolves.toEqual({
      status: "authorized",
      destination: "/participante",
    });
    expect(findParticipant).toHaveBeenCalledExactlyOnceWith("user-1");
  });
});
