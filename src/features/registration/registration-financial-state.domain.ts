export type RegistrationFinancialStatus = "legacy" | "pending" | "partially_paid" | "paid";

export type RegistrationFinancialState =
  | { status: "legacy"; pendingCents: null; confirmedPrincipalCents: null }
  | {
      status: Exclude<RegistrationFinancialStatus, "legacy">;
      pendingCents: number;
      confirmedPrincipalCents: number;
    };

export interface RegistrationFinancialStateInput {
  paymentStatus: "legacy" | "pending" | "paid";
  initialAmountCents: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  confirmedComplementCents: number;
}

const legacyState = (): RegistrationFinancialState => ({
  status: "legacy",
  pendingCents: null,
  confirmedPrincipalCents: null,
});

function isPositiveSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function deriveRegistrationFinancialState(
  input: RegistrationFinancialStateInput,
): RegistrationFinancialState {
  if (
    !isPositiveSafeInteger(input.initialAmountCents) ||
    !isNonNegativeSafeInteger(input.confirmedComplementCents)
  ) {
    return legacyState();
  }

  if (
    input.paymentStatus === "legacy" ||
    (input.pricingType !== "standard" && input.pricingType !== "promotional") ||
    !isPositiveSafeInteger(input.standardPriceCents) ||
    !isPositiveSafeInteger(input.registrationPriceCents) ||
    input.initialAmountCents !== input.registrationPriceCents
  ) {
    return legacyState();
  }

  const complementDueCents = input.standardPriceCents - input.registrationPriceCents;
  const coherentPriceSnapshots =
    (input.pricingType === "standard" && complementDueCents === 0) ||
    (input.pricingType === "promotional" && complementDueCents > 0);
  if (!coherentPriceSnapshots || input.confirmedComplementCents > complementDueCents) {
    return legacyState();
  }

  if (input.paymentStatus === "pending") {
    // An unconfirmed checkout has not paid any principal yet, so the full
    // trusted registration price remains outstanding in administrative totals.
    return input.confirmedComplementCents === 0
      ? { status: "pending", pendingCents: input.standardPriceCents, confirmedPrincipalCents: 0 }
      : legacyState();
  }

  const confirmedPrincipalCents = input.registrationPriceCents + input.confirmedComplementCents;
  const pendingCents = input.standardPriceCents - confirmedPrincipalCents;
  if (pendingCents === 0) {
    return { status: "paid", pendingCents, confirmedPrincipalCents };
  }

  return { status: "partially_paid", pendingCents, confirmedPrincipalCents };
}
