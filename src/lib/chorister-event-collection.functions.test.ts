import { describe, expect, it, vi } from "vitest";

const { collectionLoad, createCollectionServer, listSources, loadCoroAppFeed } =
  vi.hoisted(() => ({
    collectionLoad: vi.fn(),
    createCollectionServer: vi.fn(),
    listSources: vi.fn(),
    loadCoroAppFeed: vi.fn(),
  }));

vi.mock("@/features/chorister-app/choristerEventCollection.server", () => ({
  createChoristerEventCollectionServer: createCollectionServer,
}));
vi.mock("@/features/chorister-app/choristerApp.server", () => ({ loadCoroAppFeed }));
vi.mock("@/features/coroapp-integration/coroAppEventSource.service.server", () => ({
  getCoroAppEventSourceService: () => ({ list: listSources }),
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
import { getChoristerPortalCollection } from "./chorister-event-collection.functions";

describe("participant event collection server-function boundary", () => {
  it("loads configured events only from the trusted server environment", async () => {
    collectionLoad.mockResolvedValue({ status: "published", events: [] });
    createCollectionServer.mockReturnValue({ load: collectionLoad });
    const participantAccess = {
      status: "authorized",
      accountId: "account-1",
      registrationId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    };

    await expect(
      (getChoristerPortalCollection as unknown as (input: unknown) => Promise<unknown>)({
        data: { eventIds: ["browser-controlled"] },
        context: { participantAccess },
      }),
    ).resolves.toEqual({ status: "published", events: [] });

    expect((getChoristerPortalCollection as { method?: string }).method).toBe("GET");
    expect((getChoristerPortalCollection as { middlewares?: unknown[] }).middlewares).toContain(
      requireParticipantAccess,
    );
    expect(createCollectionServer).toHaveBeenCalledWith(
      expect.objectContaining({ participantAccess, listSources }),
    );

    const loadEvent = createCollectionServer.mock.calls[0][0].loadEvent;
    await loadEvent("22222222-2222-4222-8222-222222222222");
    expect(loadCoroAppFeed).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "22222222-2222-4222-8222-222222222222" }),
    );
  });
});
