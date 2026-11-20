import { z } from "zod";

export const participantCardTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "QR Code de participante inválido.");
export const publicAttendanceInputSchema = z.object({
  activityId: z.string().uuid(), token: participantCardTokenSchema,
}).strict();

export type PublicAttendanceActivity = {
  id: string; title: string; activityDate: string; startsAt: string | null; endsAt: string | null;
  totalConfirmed: number; attended: number; revision: string;
};
export type PublicAttendanceProgress = Pick<PublicAttendanceActivity, "id" | "totalConfirmed" | "attended" | "revision">;
export type PublicAttendanceResult =
  | { status: "recorded" | "already_recorded"; participantName: string; checkedInAt: string; activity: PublicAttendanceProgress }
  | { status: "invalid_card" | "ineligible" | "activity_unavailable"; message: string };
export type PublicParticipantCard = {
  name: string; choirName: string; eligible: boolean; cardUrl: string; qrDataUrl: string;
};
export type AttendanceCardExportRow = { name: string; choirName: string; token: string };

export function extractParticipantCardToken(value: string): string {
  if (value.length > 2048) throw new Error("QR Code de participante inválido.");
  if (participantCardTokenSchema.safeParse(value).success) return value;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== "/cartao") throw new Error();
    return participantCardTokenSchema.parse(url.searchParams.get("token"));
  } catch { throw new Error("Este não é um QR Code de participante válido."); }
}

export function participantCardUrl(token: string, origin: string) {
  const url = new URL("/cartao", origin);
  url.searchParams.set("token", participantCardTokenSchema.parse(token));
  return url.toString();
}

function csvCell(value: string) {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildAttendanceCardsCsv(rows: AttendanceCardExportRow[], origin: string) {
  return "\uFEFF" + [["Nome", "Coro", "Link do cartão"], ...rows.map(row =>
    [row.name, row.choirName, participantCardUrl(row.token, origin)])]
    .map(row => row.map(csvCell).join(";")).join("\r\n");
}

export function mergeAttendanceProgress(current: PublicAttendanceActivity, next: PublicAttendanceProgress): PublicAttendanceActivity {
  return current.id === next.id && next.revision >= current.revision ? { ...current, ...next } : current;
}
