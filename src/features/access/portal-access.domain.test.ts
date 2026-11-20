import { describe, expect, it, vi } from "vitest";

import { createUnifiedPortalResolver, type UnifiedPortalChecks } from "./portal-access.domain";

function setup(overrides: Partial<UnifiedPortalChecks> = {}) {
  const checks: UnifiedPortalChecks = {
    findAdminOrRegent: vi.fn().mockResolvedValue(null),
    hasParticipantAccess: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { checks, resolver: createUnifiedPortalResolver(checks) };
}

describe("unified portal destination", () => {
  it.each([
    [{ role: "admin" as const }, "/admin/inscricoes"],
    [{ role: "regent" as const, passwordChangeRequired: true }, "/regente/alterar-senha"],
    [{ role: "regent" as const, passwordChangeRequired: false }, "/regente"],
  ])("routes an admin or regent profile", async (profile, destination) => {
    const { checks, resolver } = setup({
      findAdminOrRegent: vi.fn().mockResolvedValue(profile),
      hasParticipantAccess: vi.fn().mockResolvedValue(true),
    });

    await expect(resolver.resolve("user-1", "person@example.com")).resolves.toEqual({
      status: "authorized",
      destination,
    });
    expect(checks.hasParticipantAccess).not.toHaveBeenCalled();
  });

  it("uses participant access only after admin and regent access are absent", async () => {
    const { resolver } = setup({ hasParticipantAccess: vi.fn().mockResolvedValue(true) });

    await expect(resolver.resolve("user-1", null)).resolves.toEqual({
      status: "authorized",
      destination: "/participante",
    });
  });

  it("returns no destination when every active-profile lookup is negative", async () => {
    const { resolver } = setup();

    await expect(resolver.resolve("user-1", null)).resolves.toEqual({ status: "unavailable" });
  });
});
