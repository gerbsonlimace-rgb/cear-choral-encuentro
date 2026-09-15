import { describe, expect, it, vi } from "vitest";

import {
  createCoroAppEventSourceService,
  type CoroAppEventSourceRepository,
  type CoroAppEventVerifier,
} from "./coroAppEventSource.server";

const firstEventId = "22222222-2222-4222-8222-222222222222";
const secondEventId = "33333333-3333-4333-8333-333333333333";

function repository(
  overrides: Partial<CoroAppEventSourceRepository> = {},
): CoroAppEventSourceRepository {
  return {
    list: vi.fn(async () => []),
    replace: vi.fn(async (sources: Parameters<CoroAppEventSourceRepository["replace"]>[0]) =>
      sources.map((source) => ({
        ...source,
        updatedAt: "2026-09-12T20:00:00.000Z",
      })),
    ),
    ...overrides,
  };
}

function verifier(overrides: Partial<CoroAppEventVerifier> = {}): CoroAppEventVerifier {
  return {
    verify: vi.fn(async (eventId) => ({
      eventId,
      name: eventId === firstEventId ? "Missa de abertura" : "Celebração de encerramento",
    })),
    ...overrides,
  };
}

describe("CoroApp event source service", () => {
  it("normalizes, verifies and atomically replaces the ordered event sources", async () => {
    const store = repository();
    const sourceVerifier = verifier();
    const service = createCoroAppEventSourceService({
      repository: store,
      verifier: sourceVerifier,
      trustedOrigins: ["https://coroapp.example.com"],
    });

    await expect(
      service.replace({
        publicUrls: [
          `https://coroapp.example.com/quixada/public/events/${firstEventId}?share=1`,
          `https://coroapp.example.com/e/${secondEventId}`,
          `https://coroapp.example.com/e/${firstEventId}`,
        ],
        updatedBy: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toEqual([
      {
        eventId: firstEventId,
        publicUrl: `https://coroapp.example.com/e/${firstEventId}`,
        eventName: "Missa de abertura",
        sortOrder: 0,
        updatedAt: "2026-09-12T20:00:00.000Z",
      },
      {
        eventId: secondEventId,
        publicUrl: `https://coroapp.example.com/e/${secondEventId}`,
        eventName: "Celebração de encerramento",
        sortOrder: 1,
        updatedAt: "2026-09-12T20:00:00.000Z",
      },
    ]);
    expect(sourceVerifier.verify).toHaveBeenCalledTimes(2);
    expect(store.replace).toHaveBeenCalledWith(
      [
        {
          eventId: firstEventId,
          publicUrl: `https://coroapp.example.com/e/${firstEventId}`,
          eventName: "Missa de abertura",
          sortOrder: 0,
        },
        {
          eventId: secondEventId,
          publicUrl: `https://coroapp.example.com/e/${secondEventId}`,
          eventName: "Celebração de encerramento",
          sortOrder: 1,
        },
      ],
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("does not replace anything if one event is unavailable", async () => {
    const store = repository();
    const service = createCoroAppEventSourceService({
      repository: store,
      verifier: verifier({
        verify: vi.fn(async (eventId) =>
          eventId === firstEventId ? { eventId, name: "Missa de abertura" } : null,
        ),
      }),
      trustedOrigins: ["https://coroapp.example.com"],
    });

    await expect(
      service.replace({
        publicUrls: [
          `https://coroapp.example.com/e/${firstEventId}`,
          `https://coroapp.example.com/e/${secondEventId}`,
        ],
        updatedBy: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("Um dos eventos não está disponível no feed autorizado do CoroApp.");
    expect(store.replace).not.toHaveBeenCalled();
  });
});
