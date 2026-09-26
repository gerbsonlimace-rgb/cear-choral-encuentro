export type RegistrationFinancialStatus =
  "legacy" | "pending" | "partially_paid" | "paid" | "exempt";

export type RegistrationFinancialState =
  | { status: "legacy"; pendingCents: null; confirmedPrincipalCents: null }
  | {
      status: Exclude<RegistrationFinancialStatus, "legacy">;
      pendingCents: number;
      confirmedPrincipalCents: number;
    };

export interface RegistrationFinancialStateInput {
  paymentStatus: "legacy" | "pending" | "paid";
  isExempt?: boolean;
  initialAmountCents: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  remainingPriceCents?: number | null;
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
  if (input.isExempt) {
    return { status: input.paymentStatus === "pending" ? "pending" : "exempt", pendingCents: 0, confirmedPrincipalCents: 0 };
  }
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

  const derivedComplementDueCents = input.standardPriceCents - input.registrationPriceCents;
  const complementDueCents = input.remainingPriceCents ?? derivedComplementDueCents;
  const coherentPriceSnapshots =
    (input.pricingType === "standard" && complementDueCents === 0) ||
    (input.pricingType === "promotional" &&
      complementDueCents > 0 &&
      Number.isSafeInteger(complementDueCents));
  if (!coherentPriceSnapshots || input.confirmedComplementCents > complementDueCents) {
    return legacyState();
  }

  if (input.paymentStatus === "pending") {
    // An unconfirmed checkout has not paid any principal yet, so the configured
    // initial payment and remaining balance both remain outstanding.
    return input.confirmedComplementCents === 0
      ? {
          status: "pending",
          pendingCents: input.registrationPriceCents + complementDueCents,
          confirmedPrincipalCents: 0,
        }
      : legacyState();
  }

  const confirmedPrincipalCents = input.registrationPriceCents + input.confirmedComplementCents;
  const pendingCents = complementDueCents - input.confirmedComplementCents;
  if (pendingCents === 0) {
    return { status: "paid", pendingCents, confirmedPrincipalCents };
  }

  return { status: "partially_paid", pendingCents, confirmedPrincipalCents };
}
