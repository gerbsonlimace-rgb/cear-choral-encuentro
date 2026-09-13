import type { ParticipantAccess } from "@/features/participant/participant-auth.server";

import {
  calculateAttendancePercentage,
  type AdminActivityAttendance,
  type AdminEventActivity,
  type AttendanceLocationInput,
  type EventActivityCreate,
  type EventActivityUpdate,
  type ParticipantActivityAttendance,
  type ParticipantGuideActivity,
  type PublicEventActivity,
} from "./eventActivity.domain";
import { createAttendanceTokenCodec, type AttendanceTokenCodec } from "./eventAttendanceToken.server";
import { validateAttendanceLocation } from "./eventGeofence";
import type { QrPdfInput } from "./eventActivityQrPdf.server";

export type AttendanceCheckInResult = {
  status: "recorded" | "already_recorded";
  activityTitle: string;
  checkedInAt: string;
  distanceMeters: number | null;
};

export type EventActivityRepository = {
  listAdminActivities(): Promise<AdminEventActivity[]>;
  listPublicActivities(): Promise<PublicEventActivity[]>;
  listParticipantGuideActivities(): Promise<ParticipantGuideActivity[]>;
  createActivity(input: EventActivityCreate): Promise<AdminEventActivity>;
  updateActivity(input: EventActivityUpdate): Promise<AdminEventActivity>;
  deleteActivity(activityId: string): Promise<void>;
  findActivity(activityId: string): Promise<AdminEventActivity | null>;
  incrementQrVersion(activityId: string): Promise<AdminEventActivity>;
  recordAttendance(input: {
    activityId: string;
    qrVersion: number;
    participantAccountId: string;
    registrationId: string;
    location: AttendanceLocationInput | null;
  }): Promise<AttendanceCheckInResult>;
  listParticipantAttendance(registrationId: string): Promise<ParticipantActivityAttendance[]>;
  listActivityAttendances(activityId: string): Promise<AdminActivityAttendance[]>;
};

export type QrCodeView = {
  activityId: string;
  activityTitle: string;
  scanUrl: string;
  svg: string;
};

export type AttendancePreparation = {
  activityId: string;
  activityTitle: string;
  verifyLocation: boolean;
};

type QrPdfDependencies = {
  renderQrPng(value: string): Promise<string>;
  readLogo(): Promise<Uint8Array>;
  buildPdf(input: QrPdfInput): Promise<{ bytes: Uint8Array; filename: string }>;
};

export function createEnvironmentAttendanceTokenCodec(
  readSecret: () => string | undefined = () => process.env.ATTENDANCE_QR_SECRET,
): AttendanceTokenCodec {
  const configured = () => {
    const secret = readSecret();
    if (!secret) throw new Error("A assinatura dos QR Codes ainda não foi configurada.");
    return createAttendanceTokenCodec(secret);
  };
  return {
    issue: (activityId, qrVersion) => configured().issue(activityId, qrVersion),
    verify: (token) => configured().verify(token),
  };
}

export function createEventActivityService(
  repository: EventActivityRepository,
  tokens: AttendanceTokenCodec,
  renderQrSvg: (value: string) => Promise<string>,
  clock: () => Date = () => new Date(),
  pdf?: QrPdfDependencies,
) {
  async function requiredQrActivity(token: string) {
    const payload = tokens.verify(token);
    const activity = await repository.findActivity(payload.activityId);
    if (!activity?.isActive || !activity.requiresQr) {
      throw new Error("Esta atividade não está disponível para presença.");
    }
    if (activity.qrVersion !== payload.qrVersion) throw new Error("Este QR Code foi revogado.");
    return { activity, payload };
  }

  return {
    listAdmin: () => repository.listAdminActivities(),
    publicProgramme: () => repository.listPublicActivities(),
    participantGuide: () => repository.listParticipantGuideActivities(),
    create: (input: EventActivityCreate) => repository.createActivity(input),
    update: (input: EventActivityUpdate) => repository.updateActivity(input),
    delete: (activityId: string) => repository.deleteActivity(activityId),
    listAttendances: (activityId: string) => repository.listActivityAttendances(activityId),

    async generateQr(activityId: string, publicOrigin: string): Promise<QrCodeView> {
      const activity = await repository.findActivity(activityId);
      if (!activity?.isActive || !activity.requiresQr) {
        throw new Error("Esta atividade não aceita presença por QR Code.");
      }
      const issued = tokens.issue(activity.id, activity.qrVersion);
      const scanUrl = new URL("/participante/presenca", publicOrigin);
      scanUrl.searchParams.set("token", issued.token);
      return {
        activityId: activity.id,
        activityTitle: activity.title,
        scanUrl: scanUrl.toString(),
        svg: await renderQrSvg(scanUrl.toString()),
      };
    },

    async regenerateQr(activityId: string, publicOrigin: string): Promise<QrCodeView> {
      const activity = await repository.incrementQrVersion(activityId);
      if (!activity.isActive || !activity.requiresQr) {
        throw new Error("Esta atividade não aceita presença por QR Code.");
      }
      const issued = tokens.issue(activity.id, activity.qrVersion);
      const scanUrl = new URL("/participante/presenca", publicOrigin);
      scanUrl.searchParams.set("token", issued.token);
      return {
        activityId: activity.id,
        activityTitle: activity.title,
        scanUrl: scanUrl.toString(),
        svg: await renderQrSvg(scanUrl.toString()),
      };
    },

    async prepareCheckIn(token: string): Promise<AttendancePreparation> {
      const { activity } = await requiredQrActivity(token);
      return {
        activityId: activity.id,
        activityTitle: activity.title,
        verifyLocation: activity.verifyLocation,
      };
    },

    async checkIn(
      input: { token: string; location: AttendanceLocationInput | null },
      access: Extract<ParticipantAccess, { status: "authorized" }>,
    ) {
      const { activity, payload } = await requiredQrActivity(input.token);
      let location: AttendanceLocationInput | null = null;
      if (activity.verifyLocation) {
        if (!input.location || activity.latitude === null || activity.longitude === null || activity.radiusMeters === null) {
          throw new Error("A localização é obrigatória para esta atividade.");
        }
        validateAttendanceLocation({
          activity: {
            latitude: activity.latitude,
            longitude: activity.longitude,
            radiusMeters: activity.radiusMeters,
          },
          position: input.location,
          now: clock(),
        });
        location = input.location;
      }
      return repository.recordAttendance({
        activityId: activity.id,
        qrVersion: payload.qrVersion,
        participantAccountId: access.accountId,
        registrationId: access.registrationId,
        location,
      });
    },

    async participantDashboard(registrationId: string) {
      const activities = await repository.listParticipantAttendance(registrationId);
      const summary = calculateAttendancePercentage(
        activities.map((item) => ({ isActive: true, requiresQr: true, attended: item.attended })),
      );
      return { ...summary, activities };
    },

    async generateQrPdf(publicOrigin: string) {
      if (!pdf) throw new Error("A geração do PDF ainda não está disponível.");
      const activities = (await repository.listAdminActivities()).filter(
        (activity) => activity.isActive && activity.requiresQr,
      );
      const pdfActivities = await Promise.all(
        activities.map(async (activity) => {
          const issued = tokens.issue(activity.id, activity.qrVersion);
          const scanUrl = new URL("/participante/presenca", publicOrigin);
          scanUrl.searchParams.set("token", issued.token);
          return {
            title: activity.title,
            activityDate: activity.activityDate,
            startsAt: activity.startsAt,
            endsAt: activity.endsAt,
            location: activity.location,
            qrPngDataUrl: await pdf.renderQrPng(scanUrl.toString()),
          };
        }),
      );
      return pdf.buildPdf({
        generatedAt: clock(),
        logoBytes: await pdf.readLogo(),
        activities: pdfActivities,
      });
    },
  };
}

let singleton: ReturnType<typeof createEventActivityService> | undefined;

export async function getEventActivityService() {
  if (!singleton) {
    const { createSupabaseEventActivityRepository } = await import(
      "./eventActivity.repository.server"
    );
    singleton = createEventActivityService(
      createSupabaseEventActivityRepository(),
      createEnvironmentAttendanceTokenCodec(),
      async (value) => {
        const qrcode = await import("qrcode");
        return qrcode.toString(value, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 2,
          width: 360,
          color: { dark: "#18181b", light: "#ffffff" },
        });
      },
      () => new Date(),
      {
        renderQrPng: async (value) => {
          const qrcode = await import("qrcode");
          return qrcode.toDataURL(value, {
            type: "image/png",
            errorCorrectionLevel: "M",
            margin: 2,
            width: 900,
            color: { dark: "#18181b", light: "#ffffff" },
          });
        },
        readLogo: async () => {
          const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
          return new Uint8Array(
            await fs.readFile(path.resolve(process.cwd(), "src/assets/logo-coros-preto.png")),
          );
        },
        buildPdf: async (input) =>
          (await import("./eventActivityQrPdf.server")).buildEventActivityQrPdf(input),
      },
    );
  }
  return singleton;
}
