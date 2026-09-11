import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("@/features/access/portal-access.server", () => ({
  getUnifiedPortalAccessResolver: () => ({ resolve }),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: (options: { method: string }) => {
      const middlewares: unknown[] = [];
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        handler(handler: (input: unknown) => unknown) {
          return Object.assign(handler, { method: options.method, middlewares });
        },
      };
      return builder;
    },
  };
});

import { getUnifiedPortalAccess } from "./portal-access.functions";

const fn = getUnifiedPortalAccess as unknown as {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unified portal access server-function boundary", () => {
  it("uses only the verified authenticated context and returns the closed access result", async () => {
    resolve.mockResolvedValue({ status: "authorized", destination: "/participante" });

    expect(fn.method).toBe("GET");
    expect(fn.middlewares).toContain(requireSupabaseAuth);

    await expect(
      fn({
        data: { role: "admin", userId: "spoofed", email: "spoofed@example.com" },
        context: { userId: "verified-user", claims: { email: "verified@example.com" } },
      }),
    ).resolves.toEqual({ status: "authorized", destination: "/participante" });

    expect(resolve).toHaveBeenCalledExactlyOnceWith("verified-user", "verified@example.com");
  });

  it("normalizes an absent authenticated email to null", async () => {
    resolve.mockResolvedValue({ status: "unavailable" });

    await expect(fn({ context: { userId: "verified-user", claims: {} } })).resolves.toEqual({
      status: "unavailable",
    });

    expect(resolve).toHaveBeenCalledExactlyOnceWith("verified-user", null);
  });

  it("normalizes a non-string authenticated email to null", async () => {
    resolve.mockResolvedValue({ status: "unavailable" });

    await expect(
      fn({ context: { userId: "verified-user", claims: { email: ["not-an-email"] } } }),
    ).resolves.toEqual({ status: "unavailable" });

    expect(resolve).toHaveBeenCalledExactlyOnceWith("verified-user", null);
  });
});
