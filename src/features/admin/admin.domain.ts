import { z } from "zod";
import { getAdminRafflePending, getAdminRegistrationPendingCents } from "./admin-raffle.domain";
import {
  birthDateSchema,
  brazilianMobilePhoneSchema,
  cpfSchema,
  musicalProfileSchema,
  voicePartSchema,
} from "@/features/registration/registration.domain";
import { dioceseSchema } from "@/features/dioceses/diocese.domain";
import type { Tables } from "@/integrations/supabase/types";
import type { ComplementPaymentRow } from "@/features/regent/regent-payments.domain";
import {
  deriveRegistrationFinancialState,
  type RegistrationFinancialState,
} from "@/features/registration/registration-financial-state.domain";

export const adminPaymentStatusSchema = z.enum([
  "all",
  "pending",
  "partially_paid",
  "paid",
  "exempt",
  "legacy",
  "cancelled",
]);

/** Sentinel accepted in place of a choir uuid to disable the choir filter. */
export const ADMIN_CHOIR_FILTER_ALL = "all";
/** Sentinel for registrations whose choir is not one of the configured choirs. */
export const ADMIN_CHOIR_FILTER_OTHER = "other";

const adminChoirFilterSchema = z.union([
  z.literal(ADMIN_CHOIR_FILTER_ALL),
  z.literal(ADMIN_CHOIR_FILTER_OTHER),
  z.string().uuid(),
]);

const adminMusicalProfileFilterSchema = z.union([
  z.literal("all"),
  musicalProfileSchema,
]);

export const adminRegistrationQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  loginStatus: z.enum(["all", "never", "has"]).optional(),
  paymentStatus: adminPaymentStatusSchema.default("all"),
  choirId: adminChoirFilterSchema.default(ADMIN_CHOIR_FILTER_ALL),
  musicalProfile: adminMusicalProfileFilterSchema.default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminRegistrationExportSchema = adminRegistrationQuerySchema.pick({
  search: true,
  loginStatus: true,
  paymentStatus: true,
  choirId: true,
  musicalProfile: true,
});

// Summary cards group by the exact stored name, including unconfigured choirs.
export const adminRegistrationPdfExportSchema = adminRegistrationExportSchema.extend({
  choirName: z.string().min(1).max(255).optional(),
});
export type AdminRegistrationPdfExportQuery = z.infer<typeof adminRegistrationPdfExportSchema>;

export const MAX_MANUAL_PAYMENT_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_MANUAL_PAYMENT_RECEIPT_BASE64_LENGTH =
  Math.ceil(MAX_MANUAL_PAYMENT_RECEIPT_BYTES / 3) * 4;
export const manualPaymentReceiptMimeTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const manualPaymentReceiptSchema = z
  .object({
    base64: z
      .string()
      .min(4, "Envie o comprovante de pagamento.")
      .max(MAX_MANUAL_PAYMENT_RECEIPT_BASE64_LENGTH, "O comprovante deve ter até 10 MB.")
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, {
        message: "O comprovante enviado é inválido.",
      }),
    mimeType: manualPaymentReceiptMimeTypeSchema,
    fileName: z
      .string()
      .trim()
      .min(1, "Informe o nome do comprovante.")
      .max(160, "O nome do comprovante é muito longo.")
      .refine((value) => !/[\\/]/.test(value), "O nome do comprovante é inválido."),
  })
  .strict();

export const adminMarkPaidSchema = z
  .object({
    registrationId: z.string().uuid(),
    receipt: manualPaymentReceiptSchema.optional(),
    amountCents: z.number().int().min(0).max(100_000_000).optional(),
    remainder: z.enum(["pending", "discount"]).optional(),
    originalRegistrationPriceCents: z.number().int().min(0).max(100_000_000).optional(),
    rafflePaidCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const adminMarkExemptSchema = z
  .object({
    registrationId: z.string().uuid(),
  })
  .strict();

/** Cancellation only records the refund; shared payment columns stay untouched. */
export const adminCancelRegistrationSchema = z
  .object({
    registrationId: z.string().uuid(),
    refundCents: z.number().int().min(0).max(100_000_000),
  })
  .strict();

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const adminUpdateRegistrationFields = z
  .object({
    registrationId: z.string().min(1),
    name: z.string().trim().min(2, "Informe o nome completo.").max(100),
    badgeName: z
      .string()
      .trim()
      .min(2, "Informe o nome para o crachá.")
      .max(60)
      .nullable()
      .default(null),
    cpf: cpfSchema,
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    phone: brazilianMobilePhoneSchema,
    birthDate: birthDateSchema,
    diocese: dioceseSchema,
    choirId: z.string().uuid("Selecione um coro válido.").nullable(),
    otherChoirName: z
      .string()
      .trim()
      .min(2, "Informe o nome do coro.")
      .max(120)
      .nullable(),
    city: optionalTrimmed(100).default(null),
    institution: optionalTrimmed(120).default(null),
    role: optionalTrimmed(60).default(null),
    musicalProfile: musicalProfileSchema.nullable().default(null),
    voicePart: voicePartSchema.nullable().default(null),
    observations: optionalTrimmed(500).default(null),
  })
  .strict();

type AdminUpdateRegistrationFields = z.infer<typeof adminUpdateRegistrationFields>;

function refineAdminUpdateRegistration(
  value: AdminUpdateRegistrationFields,
  context: z.RefinementCtx,
) {
  const hasConfiguredChoir = value.choirId !== null;
  const hasOtherChoir = value.otherChoirName !== null;
  if (hasConfiguredChoir === hasOtherChoir) {
    context.addIssue({
      code: "custom",
      path: [hasConfiguredChoir ? "otherChoirName" : "choirId"],
      message: "Selecione um coro ou informe outro coro.",
    });
  }
  if (value.musicalProfile === "coralista" && value.voicePart === null) {
    context.addIssue({
      code: "custom",
      path: ["voicePart"],
      message: "Selecione o naipe vocal.",
    });
  }
  if (value.musicalProfile !== "coralista" && value.voicePart !== null) {
    context.addIssue({
      code: "custom",
      path: ["voicePart"],
      message: "O naipe vocal deve ser informado apenas para Coralista.",
    });
  }
}

export const adminUpdateRegistrationFormSchema =
  adminUpdateRegistrationFields.superRefine(refineAdminUpdateRegistration);

export const adminUpdateRegistrationSchema = adminUpdateRegistrationFields
  .extend({ registrationId: z.string().uuid() })
  .superRefine(refineAdminUpdateRegistration);

export type AdminUpdateRegistrationInput = z.infer<typeof adminUpdateRegistrationSchema>;

export type ManualPaymentReceipt = z.infer<typeof manualPaymentReceiptSchema>;

export type AdminRegistrationQuery = z.infer<typeof adminRegistrationQuerySchema>;
export type AdminRegistrationExportQuery = z.infer<typeof adminRegistrationExportSchema>;
export type RegistrationDatabaseRow = Tables<"registrations"> & {
  dietary_restriction?: boolean | null;
  uses_event_van?: boolean | null;
};

export type AdminSupersededCheckoutReview = {
  orderNsu: string;
  amountCents: number;
  paidAmountCents: number;
  paymentMethod: "pix" | "credit_card";
  installments: number;
  paidAt: string;
  transactionNsu: string;
  receiptUrl: string | null;
};

export type AdminRegistrationRow = {
  id: string;
  createdAt: string;
  name: string;
  badgeName: string | null;
  cpf: string;
  birthDate: string;
  diocese: string;
  choirName: string;
  choirId?: string | null;
  otherChoirName: string | null;
  email: string;
  phone: string;
  city: string;
  institution: string | null;
  role: string;
  musicalProfile?: string | null;
  voicePart: string | null;
  observations: string | null;
  dietaryRestriction?: boolean | null;
  usesEventVan?: boolean | null;
  includeShirt: boolean;
  shirtSize: string | null;
  shirtPriceCents: number | null;
  paymentStatus: "legacy" | "pending" | "paid";
  amountCents: number | null;
  paidAmountCents: number | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  paidAt: string | null;
  paymentOrigin?: "infinitepay" | "manual" | "exemption" | null;
  isFreeRegistration?: boolean;
  rafflePaidCents?: number;
  adminRafflePaidCents?: number | null;
  hasManualReceipt?: boolean;
  /** Registration-fee balance left open by an administrator (admin-only tracking). */
  manualFeePendingCents?: number | null;
  /** Registration-fee amount waived as a discount by an administrator. */
  manualDiscountCents?: number | null;
  adminRegistrationOriginalPriceCents?: number | null;
  manualPaymentReason?: string | null;
  /** Set when the registration was cancelled administratively. */
  cancelledAt?: string | null;
  /** Amount returned to the participant on cancellation (0 = money kept). */
  refundCents?: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  remainingPriceCents?: number | null;
  photoUrl: string | null;
  regentName: string | null;
  /** Present on rows returned by the enriched admin service. */
  financialState?: RegistrationFinancialState;
  /** The newest creating/pending complement checkout, if one exists. */
  openComplementPayment?: ComplementPaymentRow | null;
  supersededCheckoutReview?: AdminSupersededCheckoutReview | null;
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

/**
 * Name shown in the listing and in exports: the name the participant chose for
 * the badge, falling back to the full registration name when none was given.
 */
export function getRegistrationDisplayName(
  row: Pick<AdminRegistrationRow, "name" | "badgeName">,
): string {
  return row.badgeName?.trim() || row.name;
}

export type AdminRegistrationPage = {
  rows: AdminRegistrationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminChoirFinancials = {
  rafflePendingCents?: number;
  rafflePendingTickets?: number | null;
  /** Raffle revenue already received for this choir (manual or settlement). */
  rafflePaidCents?: number;
  choirName: string;
  total: number;
  cancelled?: number;
  refundedCents?: number;
  receivedCents: number;
  pendingCents: number;
  pendingRegentCents: number;
  expectedCents: number;
};

export type AdminRegistrationSummary = {
  rafflePendingCents?: number;
  rafflePendingTickets?: number | null;
  /** Raffle revenue already received (manual or settlement). */
  rafflePaidCents?: number;
  total: number;
  paid: number;
  pending: number;
  partiallyPaid?: number;
  exempt?: number;
  legacy: number;
  cancelled?: number;
  refundedCents?: number;
  receivedCents: number;
  pendingCents: number;
  pendingRegentCents: number;
  expectedCents: number;
  byChoir: AdminChoirFinancials[];
};

export type AdminExportFile = { fileName: string; content: string };

export function mapAdminRegistrationRow(
  row: RegistrationDatabaseRow,
  accountStatus?: "active" | "pending" | "conflict" | null,
  photoUrl: string | null = null,
  regentName: string | null = null,
): AdminRegistrationRow {
  const status = row.payment_status as AdminRegistrationRow["paymentStatus"];

  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    badgeName: row.badge_name,
    cpf: formatCpf(row.cpf),
    birthDate: row.birth_date ?? "",
    diocese: displayText(row.diocese),
    choirName: row.choir_name,
    choirId: row.choir_id,
    otherChoirName: row.other_choir_name,
    email: displayText(row.email),
    phone: row.phone,
    city: displayText(row.city),
    institution: row.institution,
    role: displayText(row.role),
    musicalProfile: row.musical_profile,
    voicePart: row.voice_part,
    observations: row.observations,
    dietaryRestriction: row.dietary_restriction ?? null,
    usesEventVan: row.uses_event_van ?? null,
    includeShirt: Boolean(row.include_shirt),
    shirtSize: row.shirt_size,
    shirtPriceCents: row.shirt_price_cents,
    paymentStatus: status,
    amountCents: row.amount_cents,
    paidAmountCents: row.paid_amount_cents,
    paymentMethod: row.payment_method as AdminRegistrationRow["paymentMethod"],
    installments: row.installments,
    paidAt: row.paid_at,
    paymentOrigin:
      row.payment_origin === "manual" ||
      row.payment_origin === "infinitepay" ||
      row.payment_origin === "exemption"
        ? row.payment_origin
        : null,
    isFreeRegistration: row.is_free_registration,
    hasManualReceipt: Boolean(row.manual_receipt_path),
    manualFeePendingCents: row.manual_fee_pending_cents ?? null,
    manualDiscountCents: row.manual_discount_cents ?? null,
    adminRegistrationOriginalPriceCents: row.admin_registration_original_price_cents ?? null,
    adminRafflePaidCents: row.admin_raffle_paid_cents ?? null,
    manualPaymentReason: row.admin_payment_reason ?? null,
    cancelledAt: row.cancelled_at ?? null,
    refundCents: row.refund_cents ?? 0,
    pricingType: row.pricing_type as AdminRegistrationRow["pricingType"],
    standardPriceCents: row.standard_price_cents,
    registrationPriceCents: row.registration_price_cents,
    remainingPriceCents: row.remaining_price_cents,
    photoUrl,
    regentName,
    ...(accountStatus === undefined
      ? {}
      : { participantAccess: resolveParticipantAccess(status, accountStatus) }),
  };
}

export type AdminComplementPaymentRow = ComplementPaymentRow & { registrationId: string };

export type AdminRegistrationCandidate = {
  row: RegistrationDatabaseRow;
  accountStatus: "active" | "pending" | "conflict" | null;
  regentName: string | null;
};

export function enrichAdminRegistrationRow(
  candidate: AdminRegistrationCandidate,
  payments: AdminComplementPaymentRow[],
  photoUrl: string | null = null,
  supersededCheckoutReview: AdminSupersededCheckoutReview | null = null,
): AdminRegistrationRow {
  const confirmedComplementCents = payments.reduce(
    (total, payment) => total + (payment.status === "paid" ? payment.amountCents : 0),
    0,
  );
  const financialState = deriveRegistrationFinancialState({
    paymentStatus: candidate.row.payment_status as "legacy" | "pending" | "paid",
    isExempt: candidate.row.payment_origin === "exemption",
    initialAmountCents: candidate.row.amount_cents,
    pricingType: candidate.row.pricing_type as "standard" | "promotional" | null,
    standardPriceCents: candidate.row.standard_price_cents,
    registrationPriceCents: candidate.row.registration_price_cents,
    remainingPriceCents: candidate.row.remaining_price_cents,
    confirmedComplementCents: Math.min(
      confirmedComplementCents,
      Math.max(0, candidate.row.remaining_price_cents ??
        (candidate.row.standard_price_cents ?? 0) - (candidate.row.registration_price_cents ?? 0)),
    ),
  });
  const openComplementPayment =
    payments
      .filter((payment) => payment.status === "creating" || payment.status === "pending")
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      )[0] ?? null;
  const mapped = mapAdminRegistrationRow(
    candidate.row,
    candidate.accountStatus,
    photoUrl,
    candidate.regentName,
  );
  // A pre-registration has app access after the initial payment, even while
  // its derived financial state remains partially paid.
  if (mapped.participantAccess && financialState.status === "partially_paid") {
    mapped.participantAccess = resolveParticipantAccess("paid", candidate.accountStatus);
  }
  return {
    ...mapped,
    financialState,
    ...(mapped.isFreeRegistration ? { rafflePaidCents: confirmedComplementCents } : {}),
    openComplementPayment,
    supersededCheckoutReview,
  };
}

export function getAdminFinancialState(row: AdminRegistrationRow): RegistrationFinancialState {
  if (row.financialState) return row.financialState;
  const derived = deriveRegistrationFinancialState({
    paymentStatus: row.paymentStatus,
    isExempt: row.paymentOrigin === "exemption",
    initialAmountCents: row.amountCents,
    pricingType: row.pricingType,
    standardPriceCents: row.standardPriceCents,
    registrationPriceCents: row.registrationPriceCents,
    remainingPriceCents: row.remainingPriceCents,
    confirmedComplementCents: 0,
  });
  if (derived.status !== "legacy") return derived;
  // Rows assembled by older consumers predate the enriched server contract.
  // Keep their presentation stable until they are refreshed from the server.
  if (row.paymentStatus === "pending" && row.amountCents !== null) {
    return { status: "pending", pendingCents: row.amountCents, confirmedPrincipalCents: 0 };
  }
  if (row.paymentStatus === "paid") {
    return {
      status: "paid",
      pendingCents: 0,
      confirmedPrincipalCents: row.paidAmountCents ?? row.amountCents ?? 0,
    };
  }
  return derived;
}

export function summarizeAdminRegistrations(
  rows: Array<
    Pick<
      AdminRegistrationRow,
      | "choirName"
      | "paymentStatus"
      | "amountCents"
      | "paidAmountCents"
      | "pricingType"
      | "standardPriceCents"
      | "registrationPriceCents"
    > &
      Partial<
        Pick<
          AdminRegistrationRow,
          | "manualFeePendingCents"
          | "adminRafflePaidCents"
          | "cancelledAt"
          | "refundCents"
        >
      >
  >,
): AdminRegistrationSummary {
  const summary: AdminRegistrationSummary = {
    rafflePendingCents: 0,
    rafflePendingTickets: 0,
    rafflePaidCents: 0,
    total: rows.length,
    paid: 0,
    pending: 0,
    partiallyPaid: 0,
    legacy: 0,
    cancelled: 0,
    refundedCents: 0,
    receivedCents: 0,
    pendingCents: 0,
    pendingRegentCents: 0,
    expectedCents: 0,
    byChoir: [],
  };
  const choirs = new Map<
    string,
    {
      total: number;
      receivedCents: number;
      pendingCents: number;
      pendingRegentCents: number;
      rafflePendingCents: number;
      rafflePendingTickets: number | null;
      rafflePaidCents: number;
      cancelled: number;
      refundedCents: number;
    }
  >();

  for (const row of rows) {
    const financialState = getAdminFinancialState(row as AdminRegistrationRow);
    const cancelled = Boolean(row.cancelledAt);
    const refundCents = cancelled ? row.refundCents ?? 0 : 0;
    // A cancelled registration keeps the raffle revenue already received, but
    // its obligations and status counters move to the cancelled bucket only.
    const adminRafflePaidCents = cancelled ? 0 : row.adminRafflePaidCents ?? 0;
    if (cancelled) {
      summary.cancelled = (summary.cancelled ?? 0) + 1;
      summary.refundedCents = (summary.refundedCents ?? 0) + refundCents;
    } else if (financialState.status === "partially_paid") {
      summary.partiallyPaid = (summary.partiallyPaid ?? 0) + 1;
    } else if (financialState.status === "exempt") {
      summary.exempt = (summary.exempt ?? 0) + 1;
    } else summary[financialState.status] += 1;
    const choir = choirs.get(row.choirName) ?? {
      rafflePendingCents: 0,
      rafflePendingTickets: 0,
      rafflePaidCents: 0,
      cancelled: 0,
      refundedCents: 0,
      total: 0,
      receivedCents: 0,
      pendingCents: 0,
      pendingRegentCents: 0,
    };
    choir.total += 1;
    if (cancelled) {
      choir.cancelled += 1;
      choir.refundedCents += refundCents;
    }
    const raffle = cancelled ? null : getAdminRafflePending(row as AdminRegistrationRow, financialState);
    if (raffle) {
      summary.rafflePendingCents = (summary.rafflePendingCents ?? 0) + raffle.cents;
      choir.rafflePendingCents += raffle.cents;
      summary.rafflePendingTickets = summary.rafflePendingTickets === null || raffle.tickets === null
        ? null : (summary.rafflePendingTickets ?? 0) + raffle.tickets;
      choir.rafflePendingTickets = choir.rafflePendingTickets === null || raffle.tickets === null
        ? null : choir.rafflePendingTickets + raffle.tickets;
    }

    if (cancelled) {
      // Only the status changes: money already received stays counted, minus
      // any refund the administrator informed, and no pending remains.
      const confirmedCents =
        financialState.status === "paid" || financialState.status === "partially_paid"
          ? financialState.confirmedPrincipalCents
          : 0;
      const raffleRevenueCents = row.adminRafflePaidCents ?? 0;
      const netCents = Math.max(0, confirmedCents + raffleRevenueCents - refundCents);
      summary.receivedCents += netCents;
      choir.receivedCents += netCents;
      if (raffleRevenueCents > 0) {
        summary.rafflePaidCents = (summary.rafflePaidCents ?? 0) + raffleRevenueCents;
        choir.rafflePaidCents += raffleRevenueCents;
      }
      choirs.set(row.choirName, choir);
      continue;
    }

    if (adminRafflePaidCents > 0) {
      summary.receivedCents += adminRafflePaidCents;
      summary.rafflePaidCents = (summary.rafflePaidCents ?? 0) + adminRafflePaidCents;
      choir.receivedCents += adminRafflePaidCents;
      choir.rafflePaidCents += adminRafflePaidCents;
    }

    if (financialState.status === "paid" || financialState.status === "partially_paid") {
      const receivedCents = financialState.confirmedPrincipalCents;
      const pendingRegentCents =
        financialState.status === "partially_paid" ? financialState.pendingCents : 0;

      const feeBalanceCents =
        getAdminRegistrationPendingCents(row as AdminRegistrationRow, financialState) ?? 0;

      summary.receivedCents += receivedCents;
      summary.pendingRegentCents += pendingRegentCents;
      summary.pendingCents += feeBalanceCents;
      choir.receivedCents += receivedCents;
      choir.pendingRegentCents += pendingRegentCents;
      choir.pendingCents += feeBalanceCents;
    } else if (financialState.status === "pending") {
      const pendingCents = getAdminRegistrationPendingCents(row as AdminRegistrationRow, financialState) ?? 0;
      summary.pendingCents += pendingCents;
      choir.pendingCents += pendingCents;
    }

    choirs.set(row.choirName, choir);
  }

  summary.expectedCents = summary.receivedCents + summary.pendingCents + (summary.rafflePendingCents ?? 0);
  summary.byChoir = [...choirs.entries()]
    .map(([choirName, financials]) => ({
      choirName,
      ...financials,
      expectedCents: financials.receivedCents + financials.pendingCents + financials.rafflePendingCents,
    }))
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
  "Nome para o crachá",
  "Nome completo",
  "CPF",
  "Coro/Diocese",
  "E-mail",
  "Telefone",
  "Cidade",
  "Instituição",
  "Função",
  "Situação",
  "Tipo do valor",
  "Valor normal",
  "Valor da inscrição",
  "Valor esperado",
  "Valor pago",
  "Forma de pagamento",
  "Parcelas",
  "Pago em",
  "Restrição alimentar",
  "Usará van",
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

function displayStatus(row: AdminRegistrationRow): string {
  if (row.cancelledAt) return "Cancelada";
  if (row.isFreeRegistration && row.paymentStatus === "pending") return "Aguardando aprovação";
  if ((row.manualDiscountCents ?? 0) > 0) return "Isenção parcial";
  const value = getAdminFinancialState(row).status;
  if (value === "paid" && (row.manualFeePendingCents ?? 0) > 0) return "Parcialmente pago";
  return {
    pending: "Pendente",
    partially_paid: "Parcialmente pago",
    paid: "Pago",
    exempt: "Isenção total",
    legacy: "Histórico",
  }[value];
}

function displayPaymentMethod(value: AdminRegistrationRow["paymentMethod"]): string {
  if (value === "pix") return "Pix";
  if (value === "credit_card") return "Cartão";
  return "Não informado";
}

function displayPricingType(row: AdminRegistrationRow): string {
  if (getAdminFinancialState(row).status === "exempt") return "Isenção total";
  if ((row.manualDiscountCents ?? 0) > 0) return "Isenção parcial";
  if (row.isFreeRegistration && row.paymentStatus === "pending") return "Aguardando aprovação";
  const value = row.pricingType;
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
      getRegistrationDisplayName(row),
      row.name,
      row.cpf,
      row.choirName,
      row.email,
      row.phone,
      row.city,
      displayText(row.institution),
      row.role,
      displayStatus(row),
      displayPricingType(row),
      displayAmount(row.standardPriceCents),
      displayAmount(row.registrationPriceCents),
      displayAmount(
        row.financialState
          ? getAdminFinancialState(row).status === "legacy"
            ? row.amountCents
            : getAdminFinancialState(row).status === "pending"
              ? getAdminFinancialState(row).pendingCents
              : row.standardPriceCents === null
                ? null
                : row.standardPriceCents + (row.manualFeePendingCents ?? 0)
          : row.amountCents,
      ),
      displayAmount(
        getAdminFinancialState(row).status === "pending"
          ? row.paidAmountCents
          : row.financialState
            ? getAdminFinancialState(row).confirmedPrincipalCents
            : row.paidAmountCents,
      ),
      displayPaymentMethod(row.paymentMethod),
      row.installments === null ? "Não informado" : String(row.installments),
      displayDate(row.paidAt),
      row.dietaryRestriction == null ? "Não informado" : row.dietaryRestriction ? "Sim" : "Não",
      row.usesEventVan == null ? "Não informado" : row.usesEventVan ? "Sim" : "Não",
    ]),
  ];

  return {
    fileName: `inscricoes-${dateStamp(now)}.csv`,
    content: `\uFEFF${lines.map((line) => line.map(escapeSpreadsheetCell).join(";")).join("\r\n")}`,
  };
}
