import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  attendanceLocationInputSchema,
  eventActivityCreateSchema,
  eventActivityIdSchema,
  eventActivityUpdateSchema,
} from "@/features/event-activities/eventActivity.domain";
import type { getEventActivityService } from "@/features/event-activities/eventActivity.server";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import type { ParticipantAccess } from "@/features/participant/participant-auth.server";

const activityIdInputSchema = z.object({ activityId: eventActivityIdSchema }).strict();
const attendanceTokenInputSchema = z.object({ token: z.string().min(1).max(2048) }).strict();
const attendanceCheckInInputSchema = z
  .object({
    token: z.string().min(1).max(2048),
    location: attendanceLocationInputSchema.nullable(),
  })
  .strict();

type EventActivityService = Awaited<ReturnType<typeof getEventActivityService>>;
type AuthorizedParticipant = Extract<ParticipantAccess, { status: "authorized" }>;

export function createEventActivityFunctionHandlers(service: EventActivityService) {
  return {
    async publicProgramme() {
      try {
        return { status: "ready" as const, activities: await service.publicProgramme() };
      } catch {
        return { status: "unavailable" as const, activities: [] };
      }
    },
    listAdmin: () => service.listAdmin(),
    participantGuide: () => service.participantGuide(),
    create: (input: unknown) => service.create(eventActivityCreateSchema.parse(input)),
    update: (input: unknown) => service.update(eventActivityUpdateSchema.parse(input)),
    delete: (input: unknown) => service.delete(activityIdInputSchema.parse(input).activityId),
    listAttendances: (input: unknown) =>
      service.listAttendances(activityIdInputSchema.parse(input).activityId),
    generateQr: (input: unknown, publicOrigin: string) =>
      service.generateQr(activityIdInputSchema.parse(input).activityId, publicOrigin),
    regenerateQr: (input: unknown, publicOrigin: string) =>
      service.regenerateQr(activityIdInputSchema.parse(input).activityId, publicOrigin),
    generateQrPdf: (publicOrigin: string) => service.generateQrPdf(publicOrigin),
    prepareCheckIn: (input: unknown) =>
      service.prepareCheckIn(attendanceTokenInputSchema.parse(input).token),
    checkIn: (input: unknown, access: AuthorizedParticipant) =>
      service.checkIn(attendanceCheckInInputSchema.parse(input), access),
    participantDashboard: (access: AuthorizedParticipant) =>
      service.participantDashboard(access.registrationId),
  };
}

async function handlers() {
  const { getEventActivityService } = await import(
    "@/features/event-activities/eventActivity.server"
  );
  return createEventActivityFunctionHandlers(await getEventActivityService());
}

function requestOrigin() {
  return new URL(getRequest().url).origin;
}

export const getPublicEventProgramme = createServerFn({ method: "GET" }).handler(async () =>
  (await handlers()).publicProgramme(),
);

export const getAdminEventActivities = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await handlers()).listAdmin());

export const createAdminEventActivity = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventActivityCreateSchema)
  .handler(async ({ data }) => (await handlers()).create(data));

export const updateAdminEventActivity = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventActivityUpdateSchema)
  .handler(async ({ data }) => (await handlers()).update(data));

export const deleteAdminEventActivity = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(activityIdInputSchema)
  .handler(async ({ data }) => (await handlers()).delete(data));

export const getAdminActivityQr = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(activityIdInputSchema)
  .handler(async ({ data }) => (await handlers()).generateQr(data, requestOrigin()));

export const regenerateAdminActivityQr = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(activityIdInputSchema)
  .handler(async ({ data }) => (await handlers()).regenerateQr(data, requestOrigin()));

export const getAdminActivityAttendances = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(activityIdInputSchema)
  .handler(async ({ data }) => (await handlers()).listAttendances(data));

export const downloadAdminActivityQrPdf = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const file = await (await handlers()).generateQrPdf(requestOrigin());
    return {
      filename: file.filename,
      base64: Buffer.from(file.bytes).toString("base64"),
    };
  });

export const getParticipantEventActivities = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async () => (await handlers()).participantGuide());

export const prepareParticipantAttendance = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess])
  .validator(attendanceTokenInputSchema)
  .handler(async ({ data }) => (await handlers()).prepareCheckIn(data));

export const recordParticipantAttendance = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess])
  .validator(attendanceCheckInInputSchema)
  .handler(async ({ data, context }) =>
    (await handlers()).checkIn(data, context.participantAccess),
  );

export const getParticipantAttendanceDashboard = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async ({ context }) =>
    (await handlers()).participantDashboard(context.participantAccess),
  );
