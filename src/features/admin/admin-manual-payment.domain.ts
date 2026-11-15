/**
 * Manual (administrative) registration-fee payments.
 *
 * The administrator records how much of the registration fee was received.
 * Any remaining fee is either left open (tracked only for the admin panel) or
 * waived as a discount. Raffle complements (`remaining_price_cents`) are never
 * touched here, so raffle tracking and checkout eligibility stay unchanged.
 */

export type ManualPaymentRemainder = "pending" | "discount";

export type ManualPaymentSnapshot = {
  paymentStatus: string;
  paymentOrigin: string | null;
  amountCents: number | null;
  paidAmountCents: number | null;
  pricingType: string | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  feePendingCents: number | null;
  discountCents: number | null;
  originalRegistrationPriceCents?: number | null;
};

export type ManualPaymentUpdate = {
  amount_cents: number;
  paid_amount_cents: number;
  registration_price_cents?: number;
  standard_price_cents?: number;
  manual_fee_pending_cents: number | null;
  manual_discount_cents: number | null;
};

export type ManualPaymentPlan = {
  mode: "initial" | "balance";
  dueCents: number;
  receivedCents: number;
  pendingCents: number;
  discountCents: number;
  update: ManualPaymentUpdate;
};

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Registration-fee amount an administrator may still record manually. */
export function getManualPaymentDue(
  snapshot: ManualPaymentSnapshot,
): { mode: "initial" | "balance"; dueCents: number; canSplit: boolean } | null {
  if (snapshot.paymentStatus === "pending" && snapshot.paymentOrigin !== "exemption") {
    if (!isPositive(snapshot.amountCents)) return null;
    // Historical rows whose amount differs from the fee snapshot (e.g. the
    // removed shirt add-on) can only be settled in full.
    const canSplit =
      snapshot.registrationPriceCents === null ||
      snapshot.registrationPriceCents === snapshot.amountCents;
    return { mode: "initial", dueCents: snapshot.amountCents, canSplit };
  }
  if (
    snapshot.paymentStatus === "paid" &&
    snapshot.paymentOrigin === "manual" &&
    isPositive(snapshot.feePendingCents)
  ) {
    return { mode: "balance", dueCents: snapshot.feePendingCents, canSplit: true };
  }
  if (
    (snapshot.paymentStatus === "paid" || snapshot.paymentStatus === "pending") &&
    snapshot.paymentOrigin === "exemption" &&
    typeof snapshot.originalRegistrationPriceCents === "number" &&
    Number.isSafeInteger(snapshot.originalRegistrationPriceCents) &&
    snapshot.originalRegistrationPriceCents >= 0
  ) {
    return { mode: "initial", dueCents: snapshot.originalRegistrationPriceCents, canSplit: true };
  }
  return null;
}

export function planManualPayment(
  snapshot: ManualPaymentSnapshot,
  receivedCents: number | undefined,
  remainder: ManualPaymentRemainder = "pending",
): ManualPaymentPlan {
  const due = getManualPaymentDue(snapshot);
  if (!due) throw new Error("Esta inscrição não tem taxa de inscrição a receber.");
  const received = receivedCents ?? due.dueCents;
  const isFullExemption = received === 0 && remainder === "discount";
  if (!isPositive(received) && !isFullExemption) {
    throw new Error("Informe um valor recebido ou isente o valor total.");
  }
  if (received > due.dueCents) {
    throw new Error("O valor recebido não pode ser maior que o valor pendente.");
  }
  const leftover = due.dueCents - received;
  if (leftover > 0 && !due.canSplit && !isFullExemption) {
    throw new Error("Esta inscrição só pode ser quitada pelo valor total.");
  }
  const pendingCents = remainder === "pending" ? leftover : 0;
  const newDiscount = remainder === "discount" ? leftover : 0;
  const previousDiscount = snapshot.paymentOrigin === "exemption" ? 0 : snapshot.discountCents ?? 0;
  const discountCents = previousDiscount + newDiscount;

  const update: ManualPaymentUpdate = {
    amount_cents: 0,
    paid_amount_cents: 0,
    manual_fee_pending_cents: pendingCents > 0 ? pendingCents : null,
    manual_discount_cents:
      due.mode === "initial" && isFullExemption ? null : discountCents > 0 ? discountCents : null,
  };

  if (due.mode === "initial") {
    const shift = due.dueCents - received;
    update.amount_cents = received;
    update.paid_amount_cents = received;
    if (snapshot.registrationPriceCents !== null) {
      update.registration_price_cents = snapshot.registrationPriceCents - shift;
    }
    if (snapshot.standardPriceCents !== null) {
      update.standard_price_cents = snapshot.standardPriceCents - shift;
    }
  } else {
    update.amount_cents = (snapshot.amountCents ?? 0) + received;
    update.paid_amount_cents = (snapshot.paidAmountCents ?? snapshot.amountCents ?? 0) + received;
    if (snapshot.registrationPriceCents !== null) {
      update.registration_price_cents = snapshot.registrationPriceCents + received;
    }
    if (snapshot.standardPriceCents !== null) {
      update.standard_price_cents = snapshot.standardPriceCents + received;
    }
  }

  return {
    mode: due.mode,
    dueCents: due.dueCents,
    receivedCents: received,
    pendingCents,
    discountCents: newDiscount,
    update,
  };
}

/** Parses "150", "150,50", "1.500,00" or "150.5" into cents. */
export function parseReceivedAmount(value: string): number | null {
  let normalized = value.replace(/R\$/gi, "").replace(/\s+/g, "");
  if (!normalized) return null;
  if (normalized.includes(",")) normalized = normalized.replaceAll(".", "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [reais, decimal = ""] = normalized.split(".");
  const cents = Number(reais) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}
