import { describe, expect, it } from "vitest";

import {
  coroAppEventSourceSchema,
  normalizeCoroAppEventUrl,
} from "./coroAppEventSource.domain";

const eventId = "22222222-2222-4222-8222-222222222222";
const origins = ["https://coroapp.example.com"];

describe("CoroApp event source URL", () => {
  it("accepts the timezone offset returned by Postgres timestamps", () => {
    expect(
      coroAppEventSourceSchema.safeParse({
        eventId,
        publicUrl: `https://coroapp.example.com/e/${eventId}`,
        eventName: "Evento publicado",
        sortOrder: 0,
        updatedAt: "2026-09-12T20:24:17.393919+00:00",
      }).success,
    ).toBe(true);
  });

  it.each([
    [`https://coroapp.example.com/e/${eventId}`, `https://coroapp.example.com/e/${eventId}`],
    [
      `https://coroapp.example.com/quixada/public/events/${eventId}?utm_source=share#player`,
      `https://coroapp.example.com/e/${eventId}`,
    ],
    [
      `https://COROAPP.example.com/quixada/shared/events/${eventId}`,
      `https://coroapp.example.com/e/${eventId}`,
    ],
    [
      `https://coroapp.example.com/quixada/events/${eventId}`,
      `https://coroapp.example.com/e/${eventId}`,
    ],
  ])("extracts the event and stores a canonical public URL", (input, publicUrl) => {
    expect(normalizeCoroAppEventUrl(input, origins)).toEqual({ eventId, publicUrl });
  });

  it.each([
    `http://coroapp.example.com/e/${eventId}`,
    `https://other.example.com/e/${eventId}`,
    "https://coroapp.example.com/e/not-an-event",
    `https://user:password@coroapp.example.com/e/${eventId}`,
    `https://coroapp.example.com/events/${eventId}`,
  ])("rejects a URL that is not a supported public CoroApp event", (input) => {
    expect(() => normalizeCoroAppEventUrl(input, origins)).toThrow(
      "Informe uma URL pública válida de evento do CoroApp.",
    );
  });

  it("rejects validation when no trusted CoroApp origin is configured", () => {
    expect(() => normalizeCoroAppEventUrl(`https://coroapp.example.com/e/${eventId}`, [])).toThrow(
      "A origem pública do CoroApp não está configurada.",
    );
  });
});
