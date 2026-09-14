import { describe, expect, it, vi } from "vitest";

import { requestParticipantPosition } from "./participantGeolocation";

describe("participant geolocation", () => {
  it("requests one fresh high-accuracy position and keeps its timestamp", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback, _error?: PositionErrorCallback, _options?: PositionOptions) => success({
      coords: { latitude: -4.9708, longitude: -39.0167, accuracy: 18 },
      timestamp: Date.parse("2026-11-21T12:00:00Z"),
    } as GeolocationPosition));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    await expect(requestParticipantPosition()).resolves.toEqual({
      latitude: -4.9708,
      longitude: -39.0167,
      accuracyMeters: 18,
      collectedAt: "2026-11-21T12:00:00.000Z",
    });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  });

  it("explains denied location in Portuguese", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, error: (value: { code: number }) => void) => error({ code: 1 }) } });
    await expect(requestParticipantPosition()).rejects.toThrow("Permita a localização");
  });
});
