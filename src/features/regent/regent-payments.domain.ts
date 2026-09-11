import { z } from "zod";

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
  | "standard_price"
  | "awaiting_participant_payment"
  | "missing_snapshot"
  | "settled";

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
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  complement: ComplementEligibility;
  payments: ComplementPaymentRow[];
}

export interface PortalSummary {
  totalParticipants: number;
  eligibleComplementCents: number;
  confirmedComplementCents: number;
  outstandingComplementCents: number;
}

export const complementCheckoutSchema = z
  .object({
    registrationId: z.string().uuid(),
    amountCents: z.number().int().positive().safe(),
  })
  .strict();

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

  const totalCents = input.standardPriceCents - input.registrationPriceCents;
  if (
    (input.pricingType === "standard" && totalCents !== 0) ||
    (input.pricingType === "promotional" && totalCents <= 0) ||
    input.confirmedComplementCents > totalCents
  ) {
    return { eligible: false, reason: "missing_snapshot" };
  }

  if (input.pricingType === "standard") {
    return { eligible: false, reason: "standard_price" };
  }

  if (input.paymentStatus !== "paid") {
    return { eligible: false, reason: "awaiting_participant_payment" };
  }

  if (input.confirmedComplementCents === totalCents) {
    return { eligible: false, reason: "settled" };
  }

  return {
    eligible: true,
    totalCents,
    paidCents: input.confirmedComplementCents,
    balanceCents: totalCents - input.confirmedComplementCents,
    ...(input.openPayment?.status === "creating" || input.openPayment?.status === "pending"
      ? { openPayment: input.openPayment }
      : {}),
  };
}

export function buildBrazilWhatsAppUrl(phone: string): string | null {
  if (!/^[\d ()-]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (!/^[1-9]\d{9,10}$/.test(digits)) return null;
  return `https://wa.me/55${digits}`;
}
