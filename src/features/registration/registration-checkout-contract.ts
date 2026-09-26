import type { DisplayedQuote } from "@/features/choirs/choir-pricing.domain";
import { normalizeInfinitePayPhoneNumber } from "./infinitepay.server";
import {
  buildCheckoutItems,
  type CheckoutItem,
  type RegistrationInput,
} from "./registration.domain";

export type RegistrationCheckoutContract = {
  customer: { name: string; email: string; phoneNumber?: string };
  items: CheckoutItem[];
  amountCents: number;
  pricingType: "standard" | "promotional";
  standardPriceCents: number;
  registrationPriceCents: number;
  remainingPriceCents: number | null;
};

export function buildRegistrationCheckoutContract(
  input: RegistrationInput,
  appliedQuote: DisplayedQuote,
  trustedQuote: DisplayedQuote,
): RegistrationCheckoutContract {
  if (appliedQuote.pricingType === "free" || trustedQuote.pricingType === "free") {
    throw new Error("Inscrições gratuitas não possuem checkout.");
  }
  const items = buildCheckoutItems(input, appliedQuote);
  const phoneNumber = normalizeInfinitePayPhoneNumber(input.phone);

  return {
    customer: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      ...(phoneNumber ? { phoneNumber } : {}),
    },
    items,
    amountCents: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    pricingType: appliedQuote.pricingType,
    standardPriceCents: trustedQuote.standardPriceCents,
    registrationPriceCents: appliedQuote.registrationPriceCents,
    remainingPriceCents:
      appliedQuote.pricingType === "promotional"
        ? (trustedQuote.remainingPriceCents ?? null)
        : null,
  };
}

export function registrationCheckoutContractsMatch(
  left: RegistrationCheckoutContract,
  right: RegistrationCheckoutContract,
): boolean {
  return (
    left.customer.name === right.customer.name &&
    left.customer.email === right.customer.email &&
    left.customer.phoneNumber === right.customer.phoneNumber &&
    left.amountCents === right.amountCents &&
    left.pricingType === right.pricingType &&
    left.standardPriceCents === right.standardPriceCents &&
    left.registrationPriceCents === right.registrationPriceCents &&
    left.remainingPriceCents === right.remainingPriceCents &&
    JSON.stringify(left.items) === JSON.stringify(right.items)
  );
}
