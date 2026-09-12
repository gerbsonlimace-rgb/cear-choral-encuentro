import { describe, expect, it, vi } from "vitest";

const { createChoristerAppServer, load } = vi.hoisted(() => ({
  createChoristerAppServer: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/features/chorister-app/choristerApp.server", () => ({
  createChoristerAppServer,
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

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import { getChoristerPortalFeed } from "./chorister-app.functions";

type ServerFunction = {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

describe("chorister feed server-function boundary", () => {
  it("uses the participant middleware and accepts no event selector from the browser", async () => {
    load.mockResolvedValue({ status: "not_published" });
    createChoristerAppServer.mockReturnValue({ load });
    const serverFunction = getChoristerPortalFeed as unknown as ServerFunction;

    await expect(
      serverFunction({
        data: { eventId: "44444444-4444-4444-8444-444444444444" },
        context: {
          participantAccess: {
            status: "authorized",
            accountId: "account-1",
            registrationId: "11111111-1111-4111-8111-111111111111",
            userId: "user-1",
          },
        },
      }),
    ).resolves.toEqual({ status: "not_published" });
    expect(serverFunction.method).toBe("GET");
    expect(serverFunction.middlewares).toContain(requireParticipantAccess);
    expect(load).toHaveBeenCalledOnce();
    expect(createChoristerAppServer).toHaveBeenCalledWith(
      expect.objectContaining({
        participantAccess: {
          status: "authorized",
          accountId: "account-1",
          registrationId: "11111111-1111-4111-8111-111111111111",
          userId: "user-1",
        },
      }),
    );
    expect(createChoristerAppServer.mock.calls[0][0]).not.toHaveProperty("eventId");
  });
});
