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
};

export type AdminRegistrationPage = {
  rows: AdminRegistrationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminExportFile = { fileName: string; content: string };

export function mapAdminRegistrationRow(row: RegistrationDatabaseRow): AdminRegistrationRow {
  const status = row.payment_status as AdminRegistrationRow["paymentStatus"];

  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone,
    city: row.city ?? "",
    institution: row.institution,
    role: row.role ?? "",
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
  };
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
  "E-mail",
  "Telefone",
  "Cidade",
  "Instituição",
  "Função",
  "Situação",
  "Camisa",
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
      row.email,
      row.phone,
      row.city,
      displayText(row.institution),
      row.role,
      displayStatus(row.paymentStatus),
      row.shirtLabel,
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
