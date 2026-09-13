import { describe, expect, it, vi } from "vitest";

import {
  createEnvironmentAttendanceTokenCodec,
  createEventActivityService,
  type EventActivityRepository,
} from "./eventActivity.server";

const activity = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "2ª Conferência",
  activityDate: "2026-11-21",
  startsAt: "09:00",
  endsAt: "10:00",
  location: "Auditório",
  description: null,
  category: "conference" as const,
  sortOrder: 10,
  isActive: true,
  requiresQr: true,
  verifyLocation: true,
  latitude: -4.9708,
  longitude: -39.0167,
  radiusMeters: 150,
  qrVersion: 2,
  attendanceCount: 0,
  createdAt: "2026-09-13T12:00:00Z",
  updatedAt: "2026-09-13T12:00:00Z",
};

function repository(overrides: Partial<EventActivityRepository> = {}): EventActivityRepository {
  return {
    listAdminActivities: vi.fn().mockResolvedValue([activity]),
    listPublicActivities: vi.fn().mockResolvedValue([]),
    listParticipantGuideActivities: vi.fn().mockResolvedValue([]),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    findActivity: vi.fn().mockResolvedValue(activity),
    incrementQrVersion: vi.fn().mockResolvedValue({ ...activity, qrVersion: 3 }),
    recordAttendance: vi.fn().mockResolvedValue({
      status: "recorded",
      activityTitle: activity.title,
      checkedInAt: "2026-11-21T12:30:00Z",
      distanceMeters: 15,
    }),
    listParticipantAttendance: vi.fn().mockResolvedValue([]),
    listActivityAttendances: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const participantAccess = {
  status: "authorized" as const,
  accountId: "22222222-2222-4222-8222-222222222222",
  registrationId: "33333333-3333-4333-8333-333333333333",
  userId: "44444444-4444-4444-8444-444444444444",
};
const location = {
  latitude: -4.9709,
  longitude: -39.0168,
  accuracyMeters: 20,
  collectedAt: "2026-11-21T12:00:00Z",
};

describe("event activity service", () => {
  it("does not require the signing secret for ordinary CRUD", async () => {
    const readSecret = vi.fn().mockReturnValue(undefined);
    const service = createEventActivityService(
      repository(),
      createEnvironmentAttendanceTokenCodec(readSecret),
      vi.fn(),
      () => new Date("2026-11-21T12:01:00Z"),
    );

    await expect(service.listAdmin()).resolves.toEqual([activity]);
    expect(readSecret).not.toHaveBeenCalled();
  });

  it("creates a stable QR for an active required activity", async () => {
    const issue = vi.fn().mockReturnValue({ token: "signed-token" });
    const renderQr = vi.fn().mockResolvedValue("<svg />");
    const service = createEventActivityService(
      repository(),
      { issue, verify: vi.fn() },
      renderQr,
      () => new Date("2026-11-21T12:01:00Z"),
    );

    await expect(service.generateQr(activity.id, "https://evento.test")).resolves.toMatchObject({
      activityId: activity.id,
      scanUrl: "https://evento.test/participante/presenca?token=signed-token",
      svg: "<svg />",
    });
    expect(issue).toHaveBeenCalledWith(activity.id, 2);
  });

  it("preflights location without exposing coordinates or radius", async () => {
    const service = createEventActivityService(
      repository(),
      {
        issue: vi.fn(),
        verify: vi.fn().mockReturnValue({ activityId: activity.id, qrVersion: 2 }),
      },
      vi.fn(),
      () => new Date("2026-11-21T12:01:00Z"),
    );

    await expect(service.prepareCheckIn("signed-token")).resolves.toEqual({
      activityId: activity.id,
      activityTitle: activity.title,
      verifyLocation: true,
    });
  });

  it("records attendance with server-confirmed participant identifiers", async () => {
    const recordAttendance = vi.fn().mockResolvedValue({
      status: "recorded",
      activityTitle: activity.title,
      checkedInAt: "2026-11-21T12:30:00Z",
      distanceMeters: 15,
    });
    const service = createEventActivityService(
      repository({ recordAttendance }),
      {
        issue: vi.fn(),
        verify: vi.fn().mockReturnValue({ activityId: activity.id, qrVersion: 2 }),
      },
      vi.fn(),
      () => new Date("2026-11-21T12:01:00Z"),
    );

    await service.checkIn({ token: "signed-token", location }, participantAccess);

    expect(recordAttendance).toHaveBeenCalledWith({
      activityId: activity.id,
      qrVersion: 2,
      participantAccountId: participantAccess.accountId,
      registrationId: participantAccess.registrationId,
      location,
    });
  });

  it("never asks the repository to store location when verification is disabled", async () => {
    const recordAttendance = vi.fn().mockResolvedValue({
      status: "recorded",
      activityTitle: activity.title,
      checkedInAt: "2026-11-21T12:30:00Z",
      distanceMeters: null,
    });
    const service = createEventActivityService(
      repository({
        findActivity: vi.fn().mockResolvedValue({
          ...activity,
          verifyLocation: false,
          latitude: null,
          longitude: null,
          radiusMeters: null,
        }),
        recordAttendance,
      }),
      {
        issue: vi.fn(),
        verify: vi.fn().mockReturnValue({ activityId: activity.id, qrVersion: 2 }),
      },
      vi.fn(),
      () => new Date("2026-11-21T12:01:00Z"),
    );

    await service.checkIn({ token: "signed-token", location }, participantAccess);
    expect(recordAttendance).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
  });
});
