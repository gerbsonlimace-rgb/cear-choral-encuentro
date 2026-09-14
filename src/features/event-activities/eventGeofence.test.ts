import { describe, expect, it } from "vitest";

import { calculateDistanceMeters, validateAttendanceLocation } from "./eventGeofence";

const activity = {
  latitude: -4.9708,
  longitude: -39.0167,
  radiusMeters: 150,
};
const position = {
  latitude: -4.9709,
  longitude: -39.0168,
  accuracyMeters: 20,
  collectedAt: "2026-11-21T12:00:00.000Z",
};
const now = new Date("2026-11-21T12:01:00.000Z");

describe("event geofence", () => {
  it("calculates zero distance for identical coordinates", () => {
    expect(calculateDistanceMeters(activity, activity)).toBe(0);
  });

  it("accepts a fresh and precise position inside the configured radius", () => {
    expect(validateAttendanceLocation({ activity, position, now }).distanceMeters).toBeLessThan(150);
  });

  it("rejects positions older than two minutes or too far in the future", () => {
    expect(() =>
      validateAttendanceLocation({
        activity,
        position: { ...position, collectedAt: "2026-11-21T11:58:59.000Z" },
        now,
      }),
    ).toThrow("localização atual");
    expect(() =>
      validateAttendanceLocation({
        activity,
        position: { ...position, collectedAt: "2026-11-21T12:01:31.000Z" },
        now,
      }),
    ).toThrow("localização atual");
  });

  it("rejects accuracy worse than 100 metres", () => {
    expect(() =>
      validateAttendanceLocation({
        activity,
        position: { ...position, accuracyMeters: 100.01 },
        now,
      }),
    ).toThrow("baixa precisão");
  });

  it("rejects a valid position outside the activity radius", () => {
    expect(() =>
      validateAttendanceLocation({
        activity: { ...activity, radiusMeters: 10 },
        position: { ...position, latitude: -4.98 },
        now,
      }),
    ).toThrow("fora da área");
  });
});
