import { describe, expect, it, vi } from "vitest";

const { service } = vi.hoisted(() => ({
  service: {
    listAdmin: vi.fn(async () => []),
    listParticipant: vi.fn(async () => []),
    create: vi.fn(async (input: unknown) => input),
    update: vi.fn(async (input: unknown) => input),
  },
}));
vi.mock("@/features/event-notices/eventNotice.service.server", () => ({
  getEventNoticeService: () => service,
}));
vi.mock("@/features/coroapp-integration/coroAppEventSource.service.server", () => ({
  getCoroAppEventSourceService: () => ({ list: async () => [] }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: (options: { method: string }) => {
      const middlewares: unknown[] = [];
      let schema: { parse: (data: unknown) => unknown } | undefined;
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        validator(value: typeof schema) {
          schema = value;
          return builder;
        },
        handler(handler: (input: { data: unknown; context: unknown }) => unknown) {
          return Object.assign(
            (input: { data: unknown; context: unknown }) =>
              handler({ ...input, data: schema ? schema.parse(input.data) : input.data }),
            { method: options.method, middlewares },
          );
        },
      };
      return builder;
    },
  };
});

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import {
  createAdminEventNotice,
  updateAdminEventNotice,
  getAdminEventNoticeBootstrap,
  getParticipantEventNotices,
} from "./event-notice.functions";

type Boundary = ((input: { data?: unknown; context?: unknown }) => Promise<unknown>) & {
  method: string;
  middlewares: unknown[];
};
const draft = {
  eventId: "22222222-2222-4222-8222-222222222222",
  title: "Ensaio geral",
  body: "Chegue às 18h.",
  isPublished: true,
};

describe("event notice server boundaries", () => {
  it("requires administrator authorization for listing, creation and editing", () => {
    for (const fn of [
      getAdminEventNoticeBootstrap,
      createAdminEventNotice,
      updateAdminEventNotice,
    ] as unknown as Boundary[]) {
      expect(fn.middlewares).toContain(requireAdmin);
    }
    expect((createAdminEventNotice as unknown as Boundary).method).toBe("POST");
    expect((updateAdminEventNotice as unknown as Boundary).method).toBe("POST");
  });

  it("requires active participant access for reading notices", () => {
    expect((getParticipantEventNotices as unknown as Boundary).middlewares).toContain(
      requireParticipantAccess,
    );
  });

  it("takes the audit identity only from trusted middleware context", async () => {
    await (createAdminEventNotice as unknown as Boundary)({
      data: draft,
      context: { adminUserId: "trusted-admin" },
    });
    expect(service.create).toHaveBeenCalledWith({ ...draft, adminUserId: "trusted-admin" });
    expect(() =>
      (createAdminEventNotice as unknown as Boundary)({
        data: { ...draft, adminUserId: "spoofed" },
        context: { adminUserId: "trusted-admin" },
      }),
    ).toThrow();
  });
});
