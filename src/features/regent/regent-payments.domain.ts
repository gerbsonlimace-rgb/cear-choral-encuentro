import { z } from "zod";
import {
  deriveRegistrationFinancialState,
  type RegistrationFinancialState,
} from "../registration/registration-financial-state.domain";

export type ComplementPaymentStatus = "creating" | "pending" | "paid" | "failed" | "expired";

export interface ComplementPaymentRow {
  id: string;
  amountCents: number;
  status: ComplementPaymentStatus;
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  initiatedByName: string;
  initiatedAs: "regent" | "admin";
}

export type ComplementIneligibilityReason =
  "standard_price" | "awaiting_participant_payment" | "missing_snapshot" | "settled";

export type ComplementEligibility =
  | {
      eligible: true;
      totalCents: number;
      paidCents: number;
      balanceCents: number;
      openPayment?: ComplementPaymentRow;
    }
  | { eligible: false; reason: ComplementIneligibilityReason };

export interface PortalParticipant {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  whatsappUrl: string | null;
  photoUrl: string | null;
  paymentStatus: "legacy" | "pending" | "paid";
  initialAmountCents: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  financialState: RegistrationFinancialState;
  complement: ComplementEligibility;
  payments: ComplementPaymentRow[];
  // Optional presentation snapshots retained for consumers that expose them.
  voicePart?: string | null;
  receiptUrl?: string | null;
  includeShirt?: boolean;
  shirtPriceCents?: number | null;
}

export type BalancePaymentTarget = {
  id: string;
  name: string;
  balanceCents: number;
};

export interface PortalSummary {
  totalParticipants: number;
  eligibleComplementCents: number;
  confirmedComplementCents: number;
  outstandingComplementCents: number;
}

export const complementCheckoutSchema = z.object({ registrationId: z.string().uuid() }).strict();

export type ComplementCheckoutInput = z.infer<typeof complementCheckoutSchema>;

export interface CalculateComplementStateInput {
  paymentStatus: string;
  pricingType: string | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  confirmedComplementCents: number;
  openPayment: ComplementPaymentRow | null;
}

function isPositiveSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

export function calculateComplementState(
  input: CalculateComplementStateInput,
): ComplementEligibility {
  if (input.pricingType !== "standard" && input.pricingType !== "promotional") {
    return { eligible: false, reason: "missing_snapshot" };
  }
  if (
    !isPositiveSafeInteger(input.standardPriceCents) ||
    !isPositiveSafeInteger(input.registrationPriceCents) ||
    !Number.isSafeInteger(input.confirmedComplementCents) ||
    input.confirmedComplementCents < 0
  ) {
    return { eligible: false, reason: "missing_snapshot" };
  }

  // Shirt/add-on prices are deliberately not part of this calculation: the
  // snapshots represent the registration base prices, and the complement is
  // only the difference between those two bases.
  const totalCents = input.standardPriceCents - input.registrationPriceCents;
  if (
    (input.pricingType === "standard" && totalCents !== 0) ||
    (input.pricingType === "promotional" && totalCents <= 0) ||
    input.confirmedComplementCents > totalCents
  ) {
    return { eligible: false, reason: "missing_snapshot" };
  }
  if (input.pricingType === "standard") return { eligible: false, reason: "standard_price" };
  if (input.paymentStatus !== "paid") {
    return { eligible: false, reason: "awaiting_participant_payment" };
  }

  const financialState = deriveRegistrationFinancialState({
    paymentStatus: "paid",
    initialAmountCents: input.registrationPriceCents,
    pricingType: input.pricingType,
    standardPriceCents: input.standardPriceCents,
    registrationPriceCents: input.registrationPriceCents,
    confirmedComplementCents: input.confirmedComplementCents,
  });
  if (financialState.status === "legacy") {
    return { eligible: false, reason: "missing_snapshot" };
  }
  if (financialState.status === "paid") return { eligible: false, reason: "settled" };

  return {
    eligible: true,
    totalCents,
    paidCents: input.confirmedComplementCents,
    balanceCents: financialState.pendingCents,
    ...(input.openPayment?.status === "creating" || input.openPayment?.status === "pending"
      ? { openPayment: input.openPayment }
      : {}),
  };
}

export function formatComplementCents(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Valor complementar inválido.");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function buildBrazilWhatsAppUrl(phone: string): string | null {
  if (/[^0-9() -]/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (!/^[1-9]\d{9,10}$/.test(digits)) return null;
  return `https://wa.me/55${digits}`;
}
