import { describe, expect, it } from "vitest";

import {
  calculateAttendancePercentage,
  eventActivityCreateSchema,
} from "./eventActivity.domain";

const baseActivity = {
  title: "2ª Conferência",
  activityDate: "2026-11-21",
  startsAt: "09:00",
  endsAt: "10:00",
  location: "Auditório",
  description: null,
  category: "conference" as const,
  sortOrder: 10,
  isActive: true,
  requiresQr: false,
  verifyLocation: false,
  latitude: null,
  longitude: null,
  radiusMeters: null,
};

describe("event activity domain", () => {
  it("accepts an activity without QR or geolocation", () => {
    expect(eventActivityCreateSchema.safeParse(baseActivity).success).toBe(true);
  });

  it("requires QR before location verification", () => {
    const parsed = eventActivityCreateSchema.safeParse({
      ...baseActivity,
      verifyLocation: true,
      latitude: -4.9708,
      longitude: -39.0167,
      radiusMeters: 150,
    });
    expect(parsed.success).toBe(false);
  });

  it("requires coordinates and radius when location verification is active", () => {
    expect(
      eventActivityCreateSchema.safeParse({
        ...baseActivity,
        requiresQr: true,
        verifyLocation: true,
      }).success,
    ).toBe(false);
  });

  it("rejects persisted geofence values while location verification is inactive", () => {
    expect(
      eventActivityCreateSchema.safeParse({
        ...baseActivity,
        latitude: -4.9708,
        longitude: -39.0167,
        radiusMeters: 150,
      }).success,
    ).toBe(false);
  });

  it("requires start and end times when QR attendance is active", () => {
    expect(
      eventActivityCreateSchema.safeParse({
        ...baseActivity,
        startsAt: "09:00",
        endsAt: null,
        requiresQr: true,
      }).success,
    ).toBe(false);
  });

  it("calculates participation from active QR activities only", () => {
    expect(
      calculateAttendancePercentage([
        { isActive: true, requiresQr: true, attended: true },
        { isActive: true, requiresQr: true, attended: false },
        { isActive: true, requiresQr: false, attended: true },
        { isActive: false, requiresQr: true, attended: true },
      ]),
    ).toEqual({ attended: 1, required: 2, percentage: 50 });
  });
});
