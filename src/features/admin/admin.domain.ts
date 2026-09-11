import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const adminPaymentStatusSchema = z.enum(["all", "pending", "paid", "legacy"]);

export const adminRegistrationQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  paymentStatus: adminPaymentStatusSchema.default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminRegistrationExportSchema = adminRegistrationQuerySchema.pick({
  search: true,
  paymentStatus: true,
});

export type AdminRegistrationQuery = z.infer<typeof adminRegistrationQuerySchema>;
export type AdminRegistrationExportQuery = z.infer<typeof adminRegistrationExportSchema>;
export type RegistrationDatabaseRow = Tables<"registrations">;

export type AdminRegistrationRow = {
  id: string;
  createdAt: string;
  name: string;
  cpf: string;
  choirName: string;
  email: string;
  phone: string;
  city: string;
  institution: string | null;
  role: string;
  paymentStatus: "legacy" | "pending" | "paid";
  shirtLabel: string;
  amountCents: number | null;
  paidAmountCents: number | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  paidAt: string | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  shirtPriceCents: number | null;
  participantAccess?: AdminParticipantAccess | null;
};

export type AdminParticipantAccess = {
  label: "Ativo" | "Aguardando criação" | "Conflito de e-mail";
  canReprocess: boolean;
  canReset: boolean;
};

export function resolveParticipantAccess(
  paymentStatus: AdminRegistrationRow["paymentStatus"],
  accountStatus: "active" | "pending" | "conflict" | null,
): AdminParticipantAccess | null {
  if (paymentStatus !== "paid") return null;
  if (accountStatus === "active") {
    return { label: "Ativo", canReprocess: false, canReset: true };
  }
  if (accountStatus === "conflict") {
    return { label: "Conflito de e-mail", canReprocess: true, canReset: false };
  }
  return { label: "Aguardando criação", canReprocess: true, canReset: false };
}

export type AdminRegistrationPage = {
  rows: AdminRegistrationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminRegistrationSummary = {
  total: number;
  paid: number;
  pending: number;
  legacy: number;
  receivedCents: number;
  pendingRegentCents: number;
  byChoir: Array<{
    choirName: string;
    total: number;
    receivedCents: number;
    pendingRegentCents: number;
  }>;
};

export type AdminExportFile = { fileName: string; content: string };

export function mapAdminRegistrationRow(
  row: RegistrationDatabaseRow,
  accountStatus?: "active" | "pending" | "conflict" | null,
): AdminRegistrationRow {
  const status = row.payment_status as AdminRegistrationRow["paymentStatus"];

  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    cpf: formatCpf(row.cpf),
    choirName: row.choir_name,
    email: displayText(row.email),
    phone: row.phone,
    city: displayText(row.city),
    institution: row.institution,
    role: displayText(row.role),
    paymentStatus: status,
    shirtLabel:
      status === "legacy"
        ? "Não informado"
        : row.include_shirt
          ? `Tamanho ${row.shirt_size}`
          : "Sem camisa",
    amountCents: row.amount_cents,
    paidAmountCents: row.paid_amount_cents,
    paymentMethod: row.payment_method as AdminRegistrationRow["paymentMethod"],
    installments: row.installments,
    paidAt: row.paid_at,
    pricingType: row.pricing_type as AdminRegistrationRow["pricingType"],
    standardPriceCents: row.standard_price_cents,
    registrationPriceCents: row.registration_price_cents,
    shirtPriceCents: row.shirt_price_cents,
    ...(accountStatus === undefined
      ? {}
      : { participantAccess: resolveParticipantAccess(status, accountStatus) }),
  };
}

export function summarizeAdminRegistrations(
  rows: Array<
    Pick<
      AdminRegistrationRow,
      | "choirName"
      | "paymentStatus"
      | "paidAmountCents"
      | "pricingType"
      | "standardPriceCents"
      | "registrationPriceCents"
    >
  >,
): AdminRegistrationSummary {
  const summary: AdminRegistrationSummary = {
    total: rows.length,
    paid: 0,
    pending: 0,
    legacy: 0,
    receivedCents: 0,
    pendingRegentCents: 0,
    byChoir: [],
  };
  const choirs = new Map<
    string,
    { total: number; receivedCents: number; pendingRegentCents: number }
  >();

  for (const row of rows) {
    summary[row.paymentStatus] += 1;
    const choir = choirs.get(row.choirName) ?? {
      total: 0,
      receivedCents: 0,
      pendingRegentCents: 0,
    };
    choir.total += 1;

    if (row.paymentStatus === "paid") {
      const receivedCents = row.paidAmountCents ?? 0;
      const pendingRegentCents =
        row.pricingType === "promotional" &&
        row.standardPriceCents !== null &&
        row.registrationPriceCents !== null
          ? Math.max(0, row.standardPriceCents - row.registrationPriceCents)
          : 0;

      summary.receivedCents += receivedCents;
      summary.pendingRegentCents += pendingRegentCents;
      choir.receivedCents += receivedCents;
      choir.pendingRegentCents += pendingRegentCents;
    }

    choirs.set(row.choirName, choir);
  }

  summary.byChoir = [...choirs.entries()]
    .map(([choirName, financials]) => ({ choirName, ...financials }))
    .sort(
      (left, right) => right.total - left.total || left.choirName.localeCompare(right.choirName),
    );

  return summary;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const csvHeaders = [
  "Data",
  "Nome",
  "CPF",
  "Coro/Diocese",
  "E-mail",
  "Telefone",
  "Cidade",
  "Instituição",
  "Função",
  "Situação",
  "Camisa",
  "Tipo do valor",
  "Valor normal",
  "Valor da inscrição",
  "Valor da camisa",
  "Valor esperado",
  "Valor pago",
  "Forma de pagamento",
  "Parcelas",
  "Pago em",
];

function escapeSpreadsheetCell(value: string): string {
  const neutralized = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(neutralized) ? `"${neutralized.replaceAll('"', '""')}"` : neutralized;
}

function displayText(value: string | null): string {
  return value ?? "Não informado";
}

function formatCpf(value: string | null): string {
  return value?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") ?? "Não informado";
}

function displayAmount(value: number | null): string {
  return value === null ? "Não informado" : currencyFormatter.format(value / 100);
}

function displayDate(value: string | null): string {
  return value === null ? "Não informado" : dateFormatter.format(new Date(value));
}

function displayStatus(value: AdminRegistrationRow["paymentStatus"]): string {
  return { pending: "Pendente", paid: "Pago", legacy: "Histórico" }[value];
}

function displayPaymentMethod(value: AdminRegistrationRow["paymentMethod"]): string {
  if (value === "pix") return "Pix";
  if (value === "credit_card") return "Cartão";
  return "Não informado";
}

function displayPricingType(value: AdminRegistrationRow["pricingType"]): string {
  if (value === "standard") return "Normal";
  if (value === "promotional") return "Promocional";
  return "Não informado";
}

function dateStamp(date: Date): string {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});

  return `${values.year}-${values.month}-${values.day}`;
}

export function buildRegistrationsCsv(rows: AdminRegistrationRow[], now: Date): AdminExportFile {
  const lines = [
    csvHeaders,
    ...rows.map((row) => [
      displayDate(row.createdAt),
      row.name,
      row.cpf,
      row.choirName,
      row.email,
      row.phone,
      row.city,
      displayText(row.institution),
      row.role,
      displayStatus(row.paymentStatus),
      row.shirtLabel,
      displayPricingType(row.pricingType),
      displayAmount(row.standardPriceCents),
      displayAmount(row.registrationPriceCents),
      displayAmount(row.shirtPriceCents),
      displayAmount(row.amountCents),
      displayAmount(row.paidAmountCents),
      displayPaymentMethod(row.paymentMethod),
      row.installments === null ? "Não informado" : String(row.installments),
      displayDate(row.paidAt),
    ]),
  ];

  return {
    fileName: `inscricoes-${dateStamp(now)}.csv`,
    content: `\uFEFF${lines.map((line) => line.map(escapeSpreadsheetCell).join(";")).join("\r\n")}`,
  };
}
