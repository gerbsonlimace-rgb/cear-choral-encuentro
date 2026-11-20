import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireEventReports, requireEventScanner, requireEventAccess } from "@/features/public-attendance/eventManagement.middleware";
import {
  participantCardTokenSchema,
  publicAttendanceInputSchema,
  publicAttendanceLogisticsInputSchema,
} from "@/features/public-attendance/publicAttendance.domain";

async function service() {
  return (await import("@/features/public-attendance/publicAttendance.server")).getPublicAttendanceService();
}
export const getPublicAttendanceActivities = createServerFn({ method: "GET" }).middleware([requireEventAccess]).handler(async () => (await service()).list());
export const getPublicParticipantCard = createServerFn({ method: "GET" })
  .validator(z.object({ token: participantCardTokenSchema }).strict())
  .handler(async ({ data }) => (await service()).card(data.token, new URL(getRequest().url).origin));
export const getPublicAttendanceConfirmation = createServerFn({ method: "GET" })
  .middleware([requireEventScanner])
  .validator(z.object({ token: participantCardTokenSchema }).strict())
  .handler(async ({ data }) => (await service()).confirmation(data.token));
export const recordPublicAttendance = createServerFn({ method: "POST" })
  .middleware([requireEventScanner])
  .validator(publicAttendanceInputSchema)
  .handler(async ({ data }) => (await service()).record(data));
export const searchEventAttendanceParticipants = createServerFn({method:"POST"}).middleware([requireEventScanner])
  .validator(z.object({activityId:z.string().uuid(),query:z.string().trim().max(100)}).strict())
  .handler(async({data})=>(await import("@/features/public-attendance/attendanceSearch.server")).searchAttendanceParticipants(data.activityId,data.query));
export const savePublicAttendanceLogistics = createServerFn({ method: "POST" })
  .middleware([requireEventScanner])
  .validator(publicAttendanceLogisticsInputSchema)
  .handler(async ({ data }) => (await service()).saveLogistics(data));
export const prepareAdminAttendanceCards = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => (await service()).exportCards(new URL(getRequest().url).origin));

export const getEventManagementAccess = createServerFn({ method: "GET" })
  .handler(async () => (await import("@/features/public-attendance/eventManagement-pass.server")).readEventManagementPass());
export const unlockEventManagement = createServerFn({method:"POST"}).validator(z.object({cpf:z.string().regex(/^\d{11}$/)}).strict())
  .handler(async({data})=>(await import("@/features/public-attendance/eventManagement-pass.server")).unlockEventManagement(data.cpf));
export const lockEventManagement = createServerFn({method:"POST"})
  .handler(async()=>(await import("@/features/public-attendance/eventManagement-pass.server")).lockEventManagement());

export const getEventAttendanceReport = createServerFn({ method: "POST" }).middleware([requireEventReports])
  .validator(z.object({ activityId: z.string().uuid() }).strict())
  .handler(async ({ data }) => {
    const report = await (await import("@/features/public-attendance/attendanceReport.server")).loadAttendanceReport(data.activityId);
    const file = await (await import("@/features/public-attendance/attendanceReport.pdf")).buildAttendanceReportPdf(report);
    return { report, file };
  });

export const setRegistrationEventReportAccess = createServerFn({ method: "POST" }).middleware([requireAdmin])
  .validator(z.object({ registrationId: z.string().uuid(), enabled: z.boolean() }).strict())
  .handler(async ({ data }) => (await import("@/features/public-attendance/eventManagement-access.server")).setEventReportAccess(data.registrationId,data.enabled));
