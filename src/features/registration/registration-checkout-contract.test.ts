import { describe, expect, it } from "vitest";
import type { DisplayedQuote } from "@/features/choirs/choir-pricing.domain";
import type { RegistrationInput } from "./registration.domain";
import {
  buildRegistrationCheckoutContract,
  registrationCheckoutContractsMatch,
} from "./registration-checkout-contract";

const standardQuote: DisplayedQuote = {
  pricingType: "standard",
  standardPriceCents: 30_000,
  registrationPriceCents: 30_000,
};

const promotionalQuote: DisplayedQuote = {
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  remainingPriceCents: 25_000,
};

const baseInput: RegistrationInput = {
  name: "Maria da Silva",
  badgeName: "Maria",
  cpf: "52998224725",
  email: "maria@example.com",
  phone: "(85) 99999-9999",
  birthDate: "1990-05-20",
  diocese: "Diocese de Quixadá",
  choirId: "22222222-2222-4222-8222-222222222222",
  otherChoirName: null,
  musicalProfile: "coralista",
  voicePart: "soprano",
  photo: { contentType: "image/jpeg", dataBase64: "cGhvdG8=" },
  raffleChoice: "participate",
  displayedQuote: promotionalQuote,
};

describe("registration checkout contract", () => {
  it("compares the phone exactly as InfinitePay receives it", () => {
    const formatted = buildRegistrationCheckoutContract(
      { ...baseInput, phone: "(85) 99999-9999" },
      standardQuote,
      standardQuote,
    );
    const international = buildRegistrationCheckoutContract(
      { ...baseInput, phone: "+55 85 99999-9999" },
      standardQuote,
      standardQuote,
    );

    expect(formatted.customer.phoneNumber).toBe("+5585999999999");
    expect(registrationCheckoutContractsMatch(formatted, international)).toBe(true);
  });

  it.each([
    ["name", { name: "Outro Nome" }],
    ["email", { email: "outra@example.com" }],
    ["phone", { phone: "(85) 98888-7777" }],
  ])("detects a changed provider %s", (_label, change) => {
    const current = buildRegistrationCheckoutContract(
      baseInput,
      promotionalQuote,
      promotionalQuote,
    );
    const next = buildRegistrationCheckoutContract(
      { ...baseInput, ...change },
      promotionalQuote,
      promotionalQuote,
    );

    expect(registrationCheckoutContractsMatch(current, next)).toBe(false);
  });

  it("detects a changed amount or pricing snapshot when customer data is unchanged", () => {
    const promotional = buildRegistrationCheckoutContract(
      baseInput,
      promotionalQuote,
      promotionalQuote,
    );
    const standard = buildRegistrationCheckoutContract(
      { ...baseInput, raffleChoice: "full_price", displayedQuote: standardQuote },
      standardQuote,
      standardQuote,
    );

    expect(registrationCheckoutContractsMatch(promotional, standard)).toBe(false);
  });

  it("detects a changed remaining balance even when the checkout amount stays equal", () => {
    const current = buildRegistrationCheckoutContract(
      baseInput,
      promotionalQuote,
      promotionalQuote,
    );
    const changedTerms = buildRegistrationCheckoutContract(
      baseInput,
      promotionalQuote,
      { ...promotionalQuote, remainingPriceCents: 20_000 },
    );

    expect(registrationCheckoutContractsMatch(current, changedTerms)).toBe(false);
  });
});
