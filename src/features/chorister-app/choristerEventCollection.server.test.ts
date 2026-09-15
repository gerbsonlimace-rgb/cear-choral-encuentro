import { describe, expect, it, vi } from "vitest";

import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";

import { createChoristerEventCollectionServer } from "./choristerEventCollection.server";

const sources: CoroAppEventSource[] = [
  {
    eventId: "22222222-2222-4222-8222-222222222222",
    publicUrl: "https://coroapp.lovable.app/e/22222222-2222-4222-8222-222222222222",
    eventName: "Primeiro evento",
    sortOrder: 0,
    updatedAt: "2026-09-12T20:00:00.000Z",
  },
  {
    eventId: "33333333-3333-4333-8333-333333333333",
    publicUrl: "https://coroapp.lovable.app/e/33333333-3333-4333-8333-333333333333",
    eventName: "Segundo evento",
    sortOrder: 1,
    updatedAt: "2026-09-12T20:00:00.000Z",
  },
];

function published(id: string, name: string) {
  return {
    status: "published" as const,
    event: {
      id,
      name,
      date: "2026-11-21",
      location: "Quixadá",
      coverImageUrl: null,
      songs: [],
      documents: [],
      guide: { notes: null },
    },
  };
}

describe("participant CoroApp event collection", () => {
  it("keeps other events available when one loader throws", async () => {
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent: async (eventId) => {
        if (eventId === sources[0].eventId) throw new Error("PRIVATE_UPSTREAM_DETAIL");
        return published(eventId, "Segundo evento");
      },
    });
    await expect(server.load()).resolves.toEqual({
      status: "published", events: [published(sources[1].eventId, "Segundo evento").event],
    });
  });

  it("keeps every configured event isolated and in administrative order", async () => {
    const loadEvent = vi.fn(async (eventId: string) =>
      eventId === sources[0].eventId
        ? published(eventId, "Primeiro evento")
        : published(eventId, "Segundo evento"),
    );
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent,
    });

    await expect(server.load()).resolves.toEqual({
      status: "published",
      events: [
        published(sources[0].eventId, "Primeiro evento").event,
        published(sources[1].eventId, "Segundo evento").event,
      ],
    });
    expect(loadEvent.mock.calls).toEqual([[sources[0].eventId], [sources[1].eventId]]);
  });

  it("keeps available events visible when one configured source is temporarily unavailable", async () => {
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent: async (eventId) =>
        eventId === sources[0].eventId
          ? { status: "unavailable" }
          : published(eventId, "Segundo evento"),
    });

    await expect(server.load()).resolves.toEqual({
      status: "published",
      events: [published(sources[1].eventId, "Segundo evento").event],
    });
  });

  it("attaches Encontro documents only to the matching published event", async () => {
    const localDocument = {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Guia do evento",
      category: "Guia do evento",
      kind: "document" as const,
      sortOrder: 0,
      signedUrl: "https://signed.example.test/guide.pdf",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    const loadDocuments = vi.fn(async () => [
      { eventId: sources[1].eventId, asset: localDocument },
      {
        eventId: "55555555-5555-4555-8555-555555555555",
        asset: { ...localDocument, id: "66666666-6666-4666-8666-666666666666" },
      },
    ]);
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent: async (eventId) => published(eventId, `Evento ${eventId}`),
      loadDocuments,
    });

    await expect(server.load()).resolves.toMatchObject({
      status: "published",
      events: [
        { id: sources[0].eventId, documents: [] },
        { id: sources[1].eventId, documents: [localDocument] },
      ],
    });
    expect(loadDocuments).toHaveBeenCalledExactlyOnceWith([sources[0].eventId, sources[1].eventId]);
  });

  it("loads local documents only for sources whose current CoroApp feed is published", async () => {
    const loadDocuments = vi.fn(async () => []);
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent: async (eventId) =>
        eventId === sources[0].eventId
          ? published(eventId, "Primeiro evento")
          : { status: "not_published" },
      loadDocuments,
    });

    await expect(server.load()).resolves.toMatchObject({ status: "published" });
    expect(loadDocuments).toHaveBeenCalledExactlyOnceWith([sources[0].eventId]);
  });

  it("does not contact CoroApp for unauthorized participants", async () => {
    const listSources = vi.fn(async () => sources);
    const loadEvent = vi.fn();
    const server = createChoristerEventCollectionServer({
      participantAccess: { status: "unauthorized" } as never,
      listSources,
      loadEvent,
    });

    await expect(server.load()).resolves.toEqual({ status: "unavailable" });
    expect(listSources).not.toHaveBeenCalled();
    expect(loadEvent).not.toHaveBeenCalled();
  });

  it("distinguishes no configured source from a source outage", async () => {
    const withoutSources = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => [],
      loadEvent: vi.fn(),
    });
    const unavailable = createChoristerEventCollectionServer({
      participantAccess: { status: "authorized" } as never,
      listSources: async () => sources,
      loadEvent: async () => ({ status: "unavailable" }),
    });

    await expect(withoutSources.load()).resolves.toEqual({ status: "not_published" });
    await expect(unavailable.load()).resolves.toEqual({ status: "unavailable" });
  });
});
