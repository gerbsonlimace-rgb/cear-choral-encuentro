import { describe, expect, it } from "vitest";

import { mapAdminEventActivityRow, mapPublicEventActivityRow } from "./eventActivity.repository.server";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "2ª Conferência",
  activity_date: "2026-11-21",
  starts_at: "09:00:00",
  ends_at: "10:00:00",
  location: "Auditório",
  description: null,
  category: "conference",
  sort_order: 10,
  is_active: true,
  requires_qr: true,
  verify_location: true,
  latitude: -4.9708,
  longitude: -39.0167,
  radius_meters: 150,
  qr_version: 2,
  created_at: "2026-09-13T12:00:00Z",
  updated_at: "2026-09-13T12:00:00Z",
};

describe("event activity repository mapping", () => {
  it("maps private admin fields and attendance counts", () => {
    expect(mapAdminEventActivityRow(row, 4)).toMatchObject({
      activityDate: "2026-11-21",
      startsAt: "09:00",
      category: "conference",
      verifyLocation: true,
      latitude: -4.9708,
      qrVersion: 2,
      attendanceCount: 4,
    });
  });

  it("projects a public row without QR, geofence or version fields", () => {
    const projected = mapPublicEventActivityRow(row);
    expect(projected).toEqual({
      id: row.id,
      title: row.title,
      activityDate: row.activity_date,
      startsAt: "09:00",
      endsAt: "10:00",
      location: row.location,
      description: null,
      category: "conference",
      sortOrder: 10,
    });
    expect(projected).not.toHaveProperty("latitude");
    expect(projected).not.toHaveProperty("requiresQr");
    expect(projected).not.toHaveProperty("qrVersion");
  });
});
