import { describe, expect, it } from "vitest";
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
