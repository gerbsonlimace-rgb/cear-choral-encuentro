import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { participantCardTokenSchema, publicAttendanceInputSchema } from "@/features/public-attendance/publicAttendance.domain";

async function service() {
  return (await import("@/features/public-attendance/publicAttendance.server")).getPublicAttendanceService();
}
export const getPublicAttendanceActivities = createServerFn({ method: "GET" }).handler(async () => (await service()).list());
export const getPublicParticipantCard = createServerFn({ method: "GET" })
  .validator(z.object({ token: participantCardTokenSchema }).strict())
  .handler(async ({ data }) => (await service()).card(data.token, new URL(getRequest().url).origin));
export const recordPublicAttendance = createServerFn({ method: "POST" })
  .validator(publicAttendanceInputSchema)
  .handler(async ({ data }) => (await service()).record(data));
export const prepareAdminAttendanceCards = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => (await service()).exportCards(new URL(getRequest().url).origin));
