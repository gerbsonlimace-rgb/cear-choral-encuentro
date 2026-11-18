import { z } from "zod";
import {
  getAdminFinancialState,
  summarizeAdminRegistrations,
  type AdminRegistrationRow,
} from "./admin.domain";
import { getAdminRafflePending, getAdminRegistrationPendingCents } from "./admin-raffle.domain";

export type FinanceParticipant = {
  id: string;
  name: string;
  amountCents: number;
  registrationStatus?: "paid" | "pending" | "unknown";
};
export type FinanceEntry = {
  id: string;
  type: "income" | "expense";
  source: "registration" | "raffle" | "manual";
  date: string;
  description: string;
  responsible: string;
  notes: string;
  amountCents: number;
  choirName?: string;
  participants?: FinanceParticipant[];
  attachmentName?: string | null;
};

export const financeAttachmentSchema = z.object({
  base64: z
    .string()
    .min(4)
    .max(14_000_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .refine((name) => !/[\\/]/.test(name)),
});

export const createFinanceEntrySchema = z
  .object({
    type: z.enum(["income", "expense"]),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`))),
    description: z.string().trim().min(3).max(180),
    responsible: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(1000).default(""),
    amountCents: z.number().int().positive().max(100_000_000),
    attachment: financeAttachmentSchema.optional(),
  })
  .strict();
export type CreateFinanceEntry = z.infer<typeof createFinanceEntrySchema>;

function receivedRegistrationCents(row: AdminRegistrationRow): number {
  const financial = getAdminFinancialState(row);
  const confirmed =
    financial.status === "paid" || financial.status === "partially_paid"
      ? financial.confirmedPrincipalCents
      : 0;
  if (!row.cancelledAt) return confirmed;
  const raffle = row.adminRafflePaidCents ?? 0;
  return Math.max(0, confirmed + raffle - (row.refundCents ?? 0)) - raffle;
}

function getFinanceRegistrationStatus(
  row: AdminRegistrationRow,
): FinanceParticipant["registrationStatus"] {
  const financial = getAdminFinancialState(row);
  if (financial.status === "legacy") return "unknown";

  const registrationPendingCents = getAdminRegistrationPendingCents(row, financial);
  if (registrationPendingCents === null) return "unknown";

  const rafflePendingCents = getAdminRafflePending(row, financial)?.cents ?? 0;
  return registrationPendingCents === 0 && rafflePendingCents === 0 ? "paid" : "pending";
}

export function buildFinanceAutoEntries(
  rows: AdminRegistrationRow[],
  asOfDate: string,
): FinanceEntry[] {
  const summary = summarizeAdminRegistrations(rows);
  const byChoir = new Map<string, AdminRegistrationRow[]>();
  for (const row of rows) {
    const group = byChoir.get(row.choirName) ?? [];
    group.push(row);
    byChoir.set(row.choirName, group);
  }
  return summary.byChoir.flatMap((choir) => {
    const members = [...(byChoir.get(choir.choirName) ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
    const common = {
      type: "income" as const,
      date: asOfDate,
      responsible: "Sistema",
      choirName: choir.choirName,
    };
    return [
      {
        ...common,
        id: `registration:${choir.choirName}`,
        source: "registration" as const,
        description: `${choir.choirName} · Inscrições`,
        notes: "Recebimentos confirmados, líquidos de devoluções. Posição nesta data.",
        amountCents: choir.receivedCents - (choir.rafflePaidCents ?? 0),
        participants: members.map((row) => ({
          id: row.id,
          name: row.name,
          amountCents: receivedRegistrationCents(row),
          registrationStatus: getFinanceRegistrationStatus(row),
        })),
      },
      {
        ...common,
        id: `raffle:${choir.choirName}`,
        source: "raffle" as const,
        description: `${choir.choirName} · Rifas`,
        notes: "Rifas recebidas registradas na administração. Posição nesta data.",
        amountCents: choir.rafflePaidCents ?? 0,
        participants: members.map((row) => ({
          id: row.id,
          name: row.name,
          amountCents: row.adminRafflePaidCents ?? 0,
        })),
      },
    ];
  });
}
