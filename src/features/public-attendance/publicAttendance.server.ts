import {
  buildAttendanceCardsCsv, participantCardTokenSchema, participantCardUrl, publicAttendanceInputSchema,
  type AttendanceCardExportRow, type PublicAttendanceActivity, type PublicAttendanceResult, type PublicParticipantCard,
} from "./publicAttendance.domain";

export type PublicAttendanceRepository = {
  list(): Promise<PublicAttendanceActivity[]>;
  findCard(token: string): Promise<{ name: string; choirName: string; eligible: boolean } | null>;
  record(input: { activityId: string; token: string }): Promise<PublicAttendanceResult>;
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
      return { name: card.name, choirName: card.choirName, eligible: card.eligible, cardUrl, qrDataUrl: await renderQr(cardUrl) };
    },
    record: async (input: unknown) => repository.record(publicAttendanceInputSchema.parse(input)),
    async exportCards(origin: string) {
      const rows = await repository.prepareCards();
      return { csv: buildAttendanceCardsCsv(rows, origin), filename: "cartoes-participantes.csv", count: rows.length };
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
