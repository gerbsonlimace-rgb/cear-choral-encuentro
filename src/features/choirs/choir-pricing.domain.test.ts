import { describe, expect, it } from "vitest";

import {
  applyRaffleChoice,
  choirMutationSchema,
  formatCentsForInput,
  parseCurrencyToCents,
  pricingSettingsSchema,
  resolveChoirPrice,
  type AdminChoir,
} from "./choir-pricing.domain";

const baseChoir: AdminChoir = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Coro Diocesano de Quixadá",
  usesPromotionalPrice: false,
  isActive: true,
  createdAt: "2026-09-09T12:00:00.000Z",
  updatedAt: "2026-09-09T12:00:00.000Z",
};

describe("choir pricing domain", () => {
  it("converts Brazilian currency input to integer cents", () => {
    expect(parseCurrencyToCents("300")).toBe(30000);
    expect(parseCurrencyToCents("300,00")).toBe(30000);
    expect(parseCurrencyToCents(" 100,5 ")).toBe(10050);
    expect(parseCurrencyToCents(" ")).toBeNull();
    expect(formatCentsForInput(10050)).toBe("100,50");
    expect(formatCentsForInput(null)).toBe("");
  });

  it("rejects invalid or non-positive monetary input", () => {
    for (const input of ["0", "-10", "10,999", "1.000,00", "abc"]) {
      expect(() => parseCurrencyToCents(input), input).toThrow("Informe um valor válido");
    }
  });

  it("requires the promotional price to be lower than the standard price", () => {
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: 30000,
        promotionalPriceCents: 10000,
      }).success,
    ).toBe(true);
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: 30000,
        promotionalPriceCents: 30000,
      }).success,
    ).toBe(false);
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: null,
        promotionalPriceCents: 10000,
      }).success,
    ).toBe(true);
  });

  it("accepts optional positive prices", () => {
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: 30000,
        promotionalPriceCents: 10000,
      }).success,
    ).toBe(true);
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: 30000,
        promotionalPriceCents: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts a configured promotional balance independent of the discount", () => {
    expect(
      pricingSettingsSchema.safeParse({
        standardPriceCents: 30000,
        promotionalPriceCents: 10000,
        promotionalRemainingPriceCents: 25000,
      }).success,
    ).toBe(true);
  });

  it("normalizes choir names before persistence", () => {
    expect(
      choirMutationSchema.parse({
        name: "  Coro Litúrgico  ",
        usesPromotionalPrice: true,
        isActive: true,
      }),
    ).toEqual({
      name: "Coro Litúrgico",
      usesPromotionalPrice: true,
      isActive: true,
    });
  });

  it("resolves the standard price without requiring a promotional price", () => {
    expect(
      resolveChoirPrice(baseChoir, {
        standardPriceCents: 30000,
        promotionalPriceCents: null,
      }),
    ).toEqual({
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    });
  });

  it("automatically resolves the promotional price for an eligible choir", () => {
    expect(
      resolveChoirPrice(
        { ...baseChoir, usesPromotionalPrice: true },
        { standardPriceCents: 30000, promotionalPriceCents: 10000 },
      ),
    ).toEqual({
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });
  });

  it("propagates the configured promotional remaining balance into the quote", () => {
    expect(
      resolveChoirPrice(
        { ...baseChoir, usesPromotionalPrice: true },
        {
          standardPriceCents: 30000,
          promotionalPriceCents: 10000,
          promotionalRemainingPriceCents: 25000,
        },
      ),
    ).toEqual({
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
      remainingPriceCents: 25000,
    });
  });

  it("applies the participant raffle choice to a promotional quote", () => {
    const promotionalQuote = {
      pricingType: "promotional" as const,
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    };

    expect(applyRaffleChoice(promotionalQuote, "participate")).toEqual(promotionalQuote);
    expect(applyRaffleChoice(promotionalQuote, "full_price")).toEqual({
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    });
  });

  it("rejects raffle participation when the current choir has no promotion", () => {
    expect(() =>
      applyRaffleChoice(
        {
          pricingType: "standard",
          standardPriceCents: 30000,
          registrationPriceCents: 30000,
        },
        "participate",
      ),
    ).toThrow("O programa de rifas não está disponível para este coro.");
  });

  it("hides inactive or incompletely configured choirs", () => {
    expect(
      resolveChoirPrice(
        { ...baseChoir, isActive: false },
        { standardPriceCents: 30000, promotionalPriceCents: 10000 },
      ),
    ).toBeNull();
    expect(
      resolveChoirPrice(
        { ...baseChoir, usesPromotionalPrice: true },
        { standardPriceCents: 30000, promotionalPriceCents: null },
      ),
    ).toBeNull();
    expect(
      resolveChoirPrice(baseChoir, {
        standardPriceCents: null,
        promotionalPriceCents: 10000,
      }),
    ).toBeNull();
  });
});
