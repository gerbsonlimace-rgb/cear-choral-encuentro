import { z } from "zod";
import type { ParticipantCardLodging } from "./participantCardDetails.domain";

export const participantCardTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "QR Code de participante inválido.");
export const publicAttendanceInputSchema = z.object({
  activityId: z.string().uuid(), token: participantCardTokenSchema,
}).strict();
const dietaryRestrictionKeys = [
  "sem_lactose",
  "sem_gluten",
  "vegetariana",
  "vegana",
  "amendoim_castanhas",
  "ovo",
  "soja",
  "peixes_frutos_do_mar",
  "outra",
] as const;

export const dietaryRestrictionKeySchema = z.enum(dietaryRestrictionKeys);
export type DietaryRestrictionKey = z.infer<typeof dietaryRestrictionKeySchema>;

export const dietaryRestrictionOptions = [
  { value: "sem_lactose", label: "Leite ou lactose" },
  { value: "sem_gluten", label: "Glúten" },
  { value: "vegetariana", label: "Vegetariana" },
  { value: "vegana", label: "Vegana" },
  { value: "amendoim_castanhas", label: "Amendoim ou castanhas" },
  { value: "ovo", label: "Ovos" },
  { value: "soja", label: "Soja" },
  { value: "peixes_frutos_do_mar", label: "Peixes ou frutos do mar" },
  { value: "outra", label: "Outra" },
] as const satisfies readonly { value: DietaryRestrictionKey; label: string }[];

export function dietaryRestrictionLabels(keys: string[] | null | undefined, other: string | null | undefined) {
  return (keys ?? []).map(key => {
    const option = dietaryRestrictionOptions.find(item => item.value === key);
    return key === "outra" && other?.trim() ? `Outra: ${other.trim()}` : option?.label ?? key;
  }).join(", ");
}

export const publicAttendanceLogisticsInputSchema = z.object({
  token: participantCardTokenSchema,
  dietaryRestriction: z.boolean(),
  dietaryRestrictionTypes: z.array(dietaryRestrictionKeySchema).max(dietaryRestrictionOptions.length),
  dietaryRestrictionOther: z.string().trim().max(280).nullable(),
  usesEventVan: z.boolean(),
}).strict().superRefine((input, context) => {
  if (!input.dietaryRestriction && (input.dietaryRestrictionTypes.length > 0 || input.dietaryRestrictionOther)) {
    context.addIssue({ code: "custom", path: ["dietaryRestrictionTypes"], message: "Respostas alimentares só podem ser informadas quando há restrição." });
  }
  if (input.dietaryRestriction && input.dietaryRestrictionTypes.length === 0) {
    context.addIssue({ code: "custom", path: ["dietaryRestrictionTypes"], message: "Selecione ao menos uma restrição alimentar." });
  }
  if (input.dietaryRestrictionTypes.includes("outra") && !input.dietaryRestrictionOther?.trim()) {
    context.addIssue({ code: "custom", path: ["dietaryRestrictionOther"], message: "Descreva a outra restrição alimentar." });
  }
  if (!input.dietaryRestrictionTypes.includes("outra") && input.dietaryRestrictionOther) {
    context.addIssue({ code: "custom", path: ["dietaryRestrictionOther"], message: "A descrição só pode ser preenchida para Outra." });
  }
});

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
  fullName?: string; photoUrl?: string | null; lodging?: ParticipantCardLodging | null;
};
export type PublicAttendanceConfirmation = Pick<PublicParticipantCard, "name" | "fullName" | "choirName" | "photoUrl" | "lodging"> & {
  dietaryRestriction?: boolean | null;
  dietaryRestrictionTypes?: DietaryRestrictionKey[];
  dietaryRestrictionOther?: string | null;
  usesEventVan?: boolean | null;
};
export type PublicAttendanceLogisticsInput = z.infer<typeof publicAttendanceLogisticsInputSchema>;
export type PublicAttendanceLogisticsResult = {
  dietaryRestriction: boolean;
  dietaryRestrictionTypes: DietaryRestrictionKey[];
  dietaryRestrictionOther: string | null;
  usesEventVan: boolean;
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
