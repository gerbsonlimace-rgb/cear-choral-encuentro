import { describe, expect, it } from "vitest";
import {
  portalChoirSelectionSchema,
  regentIdSchema,
  regentMutationSchema,
  resolveAuthorizedChoir,
  type PortalAccess,
} from "./regent.domain";

const choirId = "11111111-1111-4111-8111-111111111111";
const otherChoirId = "22222222-2222-4222-8222-222222222222";
const regent: PortalAccess = {
  role: "regent",
  userId: "user-1",
  membershipId: "membership-1",
  choirId,
  name: "Ana",
  email: "ana@example.com",
  passwordChangeRequired: false,
};

describe("regent input boundaries", () => {
  it("normalizes the association snapshot without accepting authorization fields", () => {
    expect(
      regentMutationSchema.parse({ choirId, name: "  Ana Silva  ", email: " ANA@EXAMPLE.COM " }),
    ).toEqual({ choirId, name: "Ana Silva", email: "ana@example.com" });
    expect(
      regentMutationSchema.safeParse({
        choirId,
        name: "Ana",
        email: "ana@example.com",
        userId: "attacker",
      }).success,
    ).toBe(false);
  });

  it.each([
    { choirId: "invalid", name: "Ana", email: "ana@example.com" },
    { choirId, name: " ", email: "ana@example.com" },
    { choirId, name: "a".repeat(121), email: "ana@example.com" },
    { choirId, name: "Ana", email: "not-an-email" },
  ])("rejects malformed association input %#", (input) => {
    expect(regentMutationSchema.safeParse(input).success).toBe(false);
  });

  it("requires UUID identifiers and a strict choir selection object", () => {
    expect(regentIdSchema.parse(choirId)).toBe(choirId);
    expect(regentIdSchema.safeParse("membership-1").success).toBe(false);
    expect(portalChoirSelectionSchema.parse({ choirId })).toEqual({ choirId });
    for (const input of [{}, { choirId: "all" }, { choirId, role: "admin" }]) {
      expect(portalChoirSelectionSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("authorized choir scope", () => {
  it.each([undefined, otherChoirId, "all"])(
    "always uses the regent association, ignoring selection %s",
    (requested) => {
      expect(resolveAuthorizedChoir(regent, requested)).toBe(choirId);
    },
  );

  it("requires an explicit valid UUID for administrators", () => {
    const admin: PortalAccess = { role: "admin", userId: "admin", email: null };
    expect(resolveAuthorizedChoir(admin, otherChoirId)).toBe(otherChoirId);
    expect(() => resolveAuthorizedChoir(admin)).toThrow("Selecione um coro válido.");
    expect(() => resolveAuthorizedChoir(admin, "all")).toThrow("Selecione um coro válido.");
  });
});
