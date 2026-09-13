import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  createServerFn: () => {
    const fn: Record<string, unknown> = {};
    const chain = {
      middleware: vi.fn(() => chain),
      validator: vi.fn(() => chain),
      handler: vi.fn((handler) => Object.assign(fn, { handler })),
    };
    return chain;
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://evento.test/admin/atividades"),
}));

import { createEventActivityFunctionHandlers } from "./event-activity.functions";

describe("event activity server function handlers", () => {
  it("keeps public programme failures local to the section", async () => {
    const handlers = createEventActivityFunctionHandlers({
      publicProgramme: vi.fn().mockRejectedValue(new Error("offline")),
    } as never);

    await expect(handlers.publicProgramme()).resolves.toEqual({
      status: "unavailable",
      activities: [],
    });
  });

  it("validates activity writes and participant check-ins", async () => {
    const create = vi.fn().mockResolvedValue({ id: "activity" });
    const checkIn = vi.fn().mockResolvedValue({ status: "recorded" });
    const handlers = createEventActivityFunctionHandlers({ create, checkIn } as never);
    const activity = {
      title: "Conferência",
      activityDate: "2026-11-21",
      startsAt: "09:00",
      endsAt: "10:00",
      location: null,
      description: null,
      category: "conference",
      sortOrder: 10,
      isActive: true,
      requiresQr: true,
      verifyLocation: false,
      latitude: null,
      longitude: null,
      radiusMeters: null,
    };

    await handlers.create(activity);
    expect(create).toHaveBeenCalledWith(activity);

    const access = {
      status: "authorized" as const,
      accountId: "22222222-2222-4222-8222-222222222222",
      registrationId: "33333333-3333-4333-8333-333333333333",
      userId: "44444444-4444-4444-8444-444444444444",
    };
    await handlers.checkIn({ token: "signed-token", location: null }, access);
    expect(checkIn).toHaveBeenCalledWith({ token: "signed-token", location: null }, access);
  });
});
