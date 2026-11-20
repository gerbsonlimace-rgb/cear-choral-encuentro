import {
  buildAttendanceCardsCsv, participantCardTokenSchema, participantCardUrl, publicAttendanceInputSchema,
  publicAttendanceLogisticsInputSchema,
  type AttendanceCardExportRow, type DietaryRestrictionKey, type PublicAttendanceActivity, type PublicAttendanceConfirmation,
  type PublicAttendanceLogisticsInput, type PublicAttendanceLogisticsResult,
  type PublicAttendanceResult, type PublicParticipantCard,
} from "./publicAttendance.domain";

export type PublicAttendanceRepository = {
  list(): Promise<PublicAttendanceActivity[]>;
  findCard(token: string): Promise<Pick<PublicParticipantCard,"name"|"choirName"|"eligible"|"fullName"|"photoUrl"|"lodging"> & {
    dietaryRestriction?: boolean | null;
    dietaryRestrictionTypes?: DietaryRestrictionKey[];
    dietaryRestrictionOther?: string | null;
    usesEventVan?: boolean | null;
  } | null>;
  record(input: { activityId: string; token: string }): Promise<PublicAttendanceResult>;
  archiveCall(input: { activityId: string; registrationId: string }): Promise<{ archivedCount: number; revision: string }>;
  saveLogistics?(input: PublicAttendanceLogisticsInput): Promise<PublicAttendanceLogisticsResult>;
  prepareCards(): Promise<AttendanceCardExportRow[]>;
};

export function createPublicAttendanceService(repository: PublicAttendanceRepository, renderQr: (url: string) => Promise<string>) {
  return {
    list: () => repository.list(),
    async card(rawToken: string, origin: string): Promise<PublicParticipantCard> {
      const token = participantCardTokenSchema.parse(rawToken);
      const card = await repository.findCard(token);
      if (!card) throw new Error("Cartão não encontrado ou inscrição cancelada. Procure a equipe do evento.");
      const cardUrl = participantCardUrl(token, origin);
      return { name: card.name, choirName: card.choirName, eligible: card.eligible, cardUrl, qrDataUrl: await renderQr(cardUrl),
        ...(card.fullName !== undefined ? {fullName:card.fullName}:{}),
        ...(card.photoUrl !== undefined ? {photoUrl:card.photoUrl}:{}),
        ...(card.lodging !== undefined ? {lodging:card.lodging}:{}),
      };
    },
    async confirmation(rawToken: string): Promise<PublicAttendanceConfirmation> {
      const token = participantCardTokenSchema.parse(rawToken);
      const card = await repository.findCard(token);
      if (!card) throw new Error("Cartão não encontrado ou inscrição cancelada.");
      return { name: card.name, choirName: card.choirName,
        ...(card.fullName !== undefined ? { fullName: card.fullName } : {}),
        ...(card.photoUrl !== undefined ? { photoUrl: card.photoUrl } : {}),
        ...(card.lodging !== undefined ? { lodging: card.lodging } : {}),
        ...(card.dietaryRestriction !== undefined ? { dietaryRestriction: card.dietaryRestriction } : {}),
        ...(card.dietaryRestrictionTypes !== undefined ? { dietaryRestrictionTypes: card.dietaryRestrictionTypes } : {}),
        ...(card.dietaryRestrictionOther !== undefined ? { dietaryRestrictionOther: card.dietaryRestrictionOther } : {}),
        ...(card.usesEventVan !== undefined ? { usesEventVan: card.usesEventVan } : {}),
      };
    },
    record: async (input: unknown) => repository.record(publicAttendanceInputSchema.parse(input)),
    archiveCall: (input: { activityId: string; registrationId: string }) => repository.archiveCall(input),
    async saveLogistics(input: unknown) {
      const parsed = publicAttendanceLogisticsInputSchema.parse(input);
      if (!repository.saveLogistics) throw new Error("Não foi possível salvar as respostas. Tente novamente.");
      return repository.saveLogistics(parsed);
    },
    async exportCards(origin: string) {
      const rows = await repository.prepareCards();
      return { csv: buildAttendanceCardsCsv(rows, origin), filename: "cartoes-participantes.csv", count: rows.length, cards: rows };
    },
  };
}

let singleton: ReturnType<typeof createPublicAttendanceService> | undefined;
export async function getPublicAttendanceService() {
  if (!singleton) {
    const { createPublicAttendanceRepository } = await import("./publicAttendance.repository.server");
    singleton = createPublicAttendanceService(createPublicAttendanceRepository(), async url => {
      const qrcode = await import("qrcode");
      return qrcode.toDataURL(url, { errorCorrectionLevel: "M", margin: 4, width: 720 });
    });
  }
  return singleton;
}
