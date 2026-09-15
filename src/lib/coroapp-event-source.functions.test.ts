import { describe, expect, it, vi } from "vitest";

const { list, replace } = vi.hoisted(() => ({ list: vi.fn(), replace: vi.fn() }));

vi.mock("@/features/coroapp-integration/coroAppEventSource.service.server", () => ({
  getCoroAppEventSourceService: () => ({ list, replace }),
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
        validator() {
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

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  getAdminCoroAppEventSources,
  replaceAdminCoroAppEventSources,
} from "./coroapp-event-source.functions";

type ServerFunction = {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

describe("CoroApp event source admin server-functions", () => {
  it("requires an administrator to list event sources", async () => {
    list.mockResolvedValue([]);
    const fn = getAdminCoroAppEventSources as unknown as ServerFunction;

    await expect(fn({ context: { adminUserId: "admin-1" } })).resolves.toEqual([]);
    expect(fn.method).toBe("GET");
    expect(fn.middlewares).toContain(requireAdmin);
  });

  it("uses the authenticated administrator id when replacing sources", async () => {
    replace.mockResolvedValue([]);
    const fn = replaceAdminCoroAppEventSources as unknown as ServerFunction;
    const publicUrls = [
      "https://coroapp.lovable.app/quixada/events/22222222-2222-4222-8222-222222222222",
    ];

    await expect(
      fn({ data: { publicUrls }, context: { adminUserId: "admin-1" } }),
    ).resolves.toEqual([]);
    expect(fn.method).toBe("POST");
    expect(fn.middlewares).toContain(requireAdmin);
    expect(replace).toHaveBeenCalledWith({ publicUrls, updatedBy: "admin-1" });
  });
});
