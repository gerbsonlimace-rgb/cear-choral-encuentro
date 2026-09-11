import { describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  createAdminRegent,
  listAdminRegents,
  replaceAdminRegent,
  revokeAdminRegent,
  resetAdminRegentPassword,
} from "./regent.functions";

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
