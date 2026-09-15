import { describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listAdminActivities: vi.fn(),
  listPublicActivities: vi.fn().mockResolvedValue([]),
  listParticipantGuideActivities: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  findActivity: vi.fn(),
  incrementQrVersion: vi.fn(),
  recordAttendance: vi.fn(),
  listParticipantAttendance: vi.fn(),
  listActivityAttendances: vi.fn(),
}));

vi.mock("./eventActivity.repository.server", () => ({
  createSupabaseEventActivityRepository: () => repository,
}));

vi.mock("./eventActivityQrPdf.server", () => {
  throw new Error("PDF dependencies must be loaded only while generating a PDF.");
});

vi.mock("qrcode", () => {
  throw new Error("QR dependencies must be loaded only while generating a QR code.");
});

import { getEventActivityService } from "./eventActivity.server";

describe("event activity service loading", () => {
  it("loads programme data without importing QR or PDF dependencies", async () => {
    const service = await getEventActivityService();

    await expect(service.publicProgramme()).resolves.toEqual([]);
    expect(repository.listPublicActivities).toHaveBeenCalledOnce();
  });
});
