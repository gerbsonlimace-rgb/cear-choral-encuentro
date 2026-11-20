import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  participantCardTokenSchema,
  publicAttendanceInputSchema,
  publicAttendanceLogisticsInputSchema,
} from "@/features/public-attendance/publicAttendance.domain";

async function service() {
  return (await import("@/features/public-attendance/publicAttendance.server")).getPublicAttendanceService();
}
export const getPublicAttendanceActivities = createServerFn({ method: "GET" }).handler(async () => (await service()).list());
export const getPublicParticipantCard = createServerFn({ method: "GET" })
  .validator(z.object({ token: participantCardTokenSchema }).strict())
  .handler(async ({ data }) => (await service()).card(data.token, new URL(getRequest().url).origin));
export const getPublicAttendanceConfirmation = createServerFn({ method: "GET" })
  .validator(z.object({ token: participantCardTokenSchema }).strict())
  .handler(async ({ data }) => (await service()).confirmation(data.token));
export const recordPublicAttendance = createServerFn({ method: "POST" })
  .validator(publicAttendanceInputSchema)
  .handler(async ({ data }) => (await service()).record(data));
export const savePublicAttendanceLogistics = createServerFn({ method: "POST" })
  .validator(publicAttendanceLogisticsInputSchema)
  .handler(async ({ data }) => (await service()).saveLogistics(data));
export const prepareAdminAttendanceCards = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => (await service()).exportCards(new URL(getRequest().url).origin));
