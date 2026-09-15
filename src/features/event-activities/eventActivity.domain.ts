import { z } from "zod";

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(500).nullable(),
);
const clockTimeSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
);

export const eventActivityIdSchema = z.string().uuid();
export const eventActivityCategorySchema = z.enum([
  "welcome",
  "celebration",
  "meal",
  "conference",
  "music",
  "visit",
]);

export const eventActivityCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    activityDate: z.string().date(),
    startsAt: clockTimeSchema,
    endsAt: clockTimeSchema,
    location: nullableText,
    description: nullableText,
    category: eventActivityCategorySchema,
    sortOrder: z.number().int().min(0).max(999),
    isActive: z.boolean(),
    requiresQr: z.boolean(),
    verifyLocation: z.boolean(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radiusMeters: z.number().int().min(10).max(5_000).nullable(),
  })
  .superRefine((activity, context) => {
    if (activity.requiresQr && (!activity.startsAt || !activity.endsAt)) {
      context.addIssue({
        code: "custom",
        path: ["requiresQr"],
        message: "Informe os horários inicial e final para usar QR Code.",
      });
    }
    if (activity.startsAt && activity.endsAt && activity.endsAt <= activity.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "O horário final deve ser posterior ao inicial.",
      });
    }
    if (activity.verifyLocation && !activity.requiresQr) {
      context.addIssue({
        code: "custom",
        path: ["verifyLocation"],
        message: "Ative o QR Code antes de verificar a localização.",
      });
    }
    if (
      activity.verifyLocation &&
      (activity.latitude === null ||
        activity.longitude === null ||
        activity.radiusMeters === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["verifyLocation"],
        message: "Informe latitude, longitude e raio para verificar a localização.",
      });
    }
    if (
      !activity.verifyLocation &&
      (activity.latitude !== null ||
        activity.longitude !== null ||
        activity.radiusMeters !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["verifyLocation"],
        message: "Remova os dados da geocerca quando a verificação estiver desativada.",
      });
    }
  });

export const eventActivityUpdateSchema = eventActivityCreateSchema.and(
  z.object({ id: eventActivityIdSchema }),
);

export const attendanceLocationInputSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(10_000),
    collectedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type EventActivityCategory = z.infer<typeof eventActivityCategorySchema>;
export type EventActivityCreate = z.infer<typeof eventActivityCreateSchema>;
export type EventActivityUpdate = z.infer<typeof eventActivityUpdateSchema>;
export type AttendanceLocationInput = z.infer<typeof attendanceLocationInputSchema>;

export type EventActivity = EventActivityCreate & {
  id: string;
  qrVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminEventActivity = EventActivity & { attendanceCount: number };

export type PublicEventActivity = Pick<
  EventActivity,
  | "id"
  | "title"
  | "activityDate"
  | "startsAt"
  | "endsAt"
  | "location"
  | "description"
  | "category"
  | "sortOrder"
>;

export type ParticipantGuideActivity = PublicEventActivity & { requiresQr: boolean };

export type ParticipantActivityAttendance = Pick<
  EventActivity,
  "id" | "title" | "activityDate" | "startsAt" | "endsAt" | "location" | "sortOrder"
> & {
  attended: boolean;
  checkedInAt: string | null;
};

export type AdminActivityAttendance = {
  id: string;
  participantName: string;
  checkedInAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  distanceMeters: number | null;
};

export type AttendanceSummary = { attended: number; required: number; percentage: number };

export function calculateAttendancePercentage(
  activities: Array<{ isActive: boolean; requiresQr: boolean; attended: boolean }>,
): AttendanceSummary {
  const requiredActivities = activities.filter(
    (activity) => activity.isActive && activity.requiresQr,
  );
  const attended = requiredActivities.filter((activity) => activity.attended).length;
  const required = requiredActivities.length;
  return {
    attended,
    required,
    percentage: required === 0 ? 0 : Math.round((attended / required) * 100),
  };
}

export type ParticipantAttendanceDashboard = AttendanceSummary & {
  activities: ParticipantActivityAttendance[];
};
