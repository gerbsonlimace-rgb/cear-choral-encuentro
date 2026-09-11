import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, getUser, findAdmin } = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  findAdmin: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, auth: { getUser } },
}));
vi.mock("@/features/admin/admin-auth.server", () => ({
  getAdminAuthorizer: () => ({ findActive: findAdmin }),
}));

import {
  createPortalAuthorizer,
  getPortalAuthorizer,
  findPortalAccessForAuthorization,
} from "./regent-auth.server";
import { requirePortalAccess, requirePortalReadyAccess } from "./regent-auth.middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PortalAccess } from "./regent.domain";

const membership = {
  id: "membership-1",
  userId: "user-1",
  choirId: "11111111-1111-4111-8111-111111111111",
  choirName: "Coro Diocesano de Quixadá",
  name: "Ana",
  email: "snapshot@example.com",
  passwordChangeRequired: true,
  revokedAt: null,
};
const regent: PortalAccess = {
  role: "regent",
  userId: "user-1",
  membershipId: "membership-1",
  choirId: membership.choirId,
  choirName: membership.choirName,
  name: "Ana",
  email: "snapshot@example.com",
  passwordChangeRequired: true,
};

function database(rows: Record<string, unknown>[], error: { message: string } | null = null) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    maybeSingle: async () => ({
      data: rows.find((row) => filters.every((filter) => filter(row))) ?? null,
      error,
    }),
  };
  from.mockImplementation((table) => {
    if (table !== "choir_regents") throw new Error("Unexpected table");
    return builder;
  });
}

const row = {
  id: "membership-1",
  user_id: "user-1",
  choir_id: membership.choirId,
  choirs: { name: membership.choirName },
  name: "Ana",
  email: "snapshot@example.com",
  password_change_required: true,
  revoked_at: null,
};

beforeEach(() => {
  from.mockReset();
  getUser.mockReset();
  findAdmin.mockReset();
  findAdmin.mockResolvedValue(null);
});

describe("portal authorizer", () => {
  it("gives admins precedence even when their regent password change is pending", async () => {
    const authorizer = createPortalAuthorizer({
      findActiveAdmin: async () => ({ id: "admin-membership", userId: "user-1" }),
      findActiveRegent: async () => {
        throw new Error("Regent lookup must not run for admins");
      },
    });
    await expect(authorizer.requireActive("user-1", "verified@example.com")).resolves.toEqual({
      role: "admin",
      userId: "user-1",
      email: "verified@example.com",
    });
  });

  it("returns the association email snapshot instead of the mutable Auth email", async () => {
    const authorizer = createPortalAuthorizer({
      findActiveAdmin: async () => null,
      findActiveRegent: async () => membership,
    });
    await expect(authorizer.requireActive("user-1", "changed@example.com")).resolves.toEqual(
      regent,
    );
  });

  it.each([
    null,
    { ...membership, revokedAt: "2026-09-10T00:00:00Z" },
    { ...membership, userId: "other-user" },
  ])("rejects missing, revoked, or mismatched associations %#", async (association) => {
    const authorizer = createPortalAuthorizer({
      findActiveAdmin: async () => null,
      findActiveRegent: async () => association,
    });
    await expect(authorizer.requireActive("user-1", null)).rejects.toThrow(
      "Acesso não autorizado.",
    );
  });

  it("does not fall back to regent access when the admin lookup fails", async () => {
    const authorizer = createPortalAuthorizer({
      findActiveAdmin: async () => {
        throw new Error("Database unavailable");
      },
      findActiveRegent: async () => membership,
    });
    await expect(authorizer.requireActive("user-1", null)).rejects.toThrow("Database unavailable");
  });
});

describe("portal repository", () => {
  it("selects only the active association of the authenticated user", async () => {
    database([
      { ...row, user_id: "other-user", choir_id: "wrong-choir" },
      { ...row, revoked_at: "revoked", choir_id: "old-choir" },
      row,
    ]);
    await expect(getPortalAuthorizer().requireActive("user-1", null)).resolves.toEqual(regent);
  });

  it("denies access when only a revoked row remains", async () => {
    database([{ ...row, revoked_at: "revoked" }]);
    await expect(getPortalAuthorizer().requireActive("user-1", null)).rejects.toThrow(
      "Acesso não autorizado.",
    );
  });

  it("fails closed with a safe message on repository errors", async () => {
    database([], { message: "private database details" });
    await expect(getPortalAuthorizer().requireActive("user-1", null)).rejects.toThrow(
      "Não foi possível validar o acesso do regente.",
    );
  });
});

describe("access probe authentication", () => {
  it.each([undefined, null, "", "Basic secret", "Bearer "])(
    "treats missing or malformed credentials as unauthenticated (%s)",
    async (header) => {
      await expect(findPortalAccessForAuthorization(header)).resolves.toEqual({
        authenticated: false,
      });
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it("does not authorize a rejected Auth token", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid token" } });
    await expect(findPortalAccessForAuthorization("Bearer invalid.token.value")).resolves.toEqual({
      authenticated: false,
    });
    expect(from).not.toHaveBeenCalled();
    expect(findAdmin).not.toHaveBeenCalled();
  });

  it("uses the Auth server identity and ignores user-editable role metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "verified@example.com",
          user_metadata: { role: "admin", choirId: "wrong" },
        },
      },
      error: null,
    });
    database([row]);
    await expect(findPortalAccessForAuthorization("Bearer signed.token.value")).resolves.toEqual({
      authenticated: true,
      access: regent,
    });
    expect(getUser).toHaveBeenCalledWith("signed.token.value");
    expect(findAdmin).toHaveBeenCalledWith("user-1");
  });

  it("returns a forbidden probe result for a verified identity without access", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    database([]);
    await expect(findPortalAccessForAuthorization("Bearer signed.token.value")).resolves.toEqual({
      authenticated: true,
      access: null,
    });
  });
});

type MiddlewareHandler = (input: {
  context: Record<string, unknown>;
  next: (input: unknown) => Promise<unknown>;
}) => Promise<unknown>;
function handler(middleware: { options: unknown }) {
  return (middleware.options as { server: MiddlewareHandler }).server;
}

describe("portal middleware", () => {
  it("composes verified Supabase auth and carries only server-resolved access", async () => {
    expect(requirePortalAccess.options.middleware).toContain(requireSupabaseAuth);
    database([row]);
    await expect(
      handler(requirePortalAccess)({
        context: {
          userId: "user-1",
          claims: { email: "changed@example.com" },
          portalAccess: { role: "admin" },
        },
        next: async (result) => result,
      }),
    ).resolves.toEqual({ context: { portalAccess: regent } });
  });

  it("copies the verified claim email for administrators", async () => {
    findAdmin.mockResolvedValue({ id: "admin-membership", userId: "user-1" });
    await expect(
      handler(requirePortalAccess)({
        context: { userId: "user-1", claims: { email: "verified@example.com" } },
        next: async (result) => result,
      }),
    ).resolves.toEqual({
      context: { portalAccess: { role: "admin", userId: "user-1", email: "verified@example.com" } },
    });
  });

  it("blocks pending password changes before the protected operation", async () => {
    expect(requirePortalReadyAccess.options.middleware).toContain(requirePortalAccess);
    const next = vi.fn(async () => "private data");
    await expect(
      handler(requirePortalReadyAccess)({ context: { portalAccess: regent }, next }),
    ).rejects.toThrow("Altere sua senha");
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    { ...regent, passwordChangeRequired: false },
    { role: "admin", userId: "admin", email: null },
  ])("allows ready regents and administrators %#", async (access) => {
    await expect(
      handler(requirePortalReadyAccess)({
        context: { portalAccess: access },
        next: async () => "private data",
      }),
    ).resolves.toBe("private data");
  });
});
