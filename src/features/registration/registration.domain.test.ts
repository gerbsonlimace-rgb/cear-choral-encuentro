import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  paymentLookupSchema,
  registrationResumeSchema,
  registrationSchema,
} from "./registration.domain";

const standardQuote = {
  pricingType: "standard" as const,
  standardPriceCents: 30000,
  registrationPriceCents: 30000,
};

const baseInput = {
  name: "Maria da Silva",
  cpf: "52998224725",
  email: "maria@example.com",
  phone: "85999999999",
  birthDate: "1990-05-20",
  choirId: "11111111-1111-4111-8111-111111111111",
  displayedQuote: standardQuote,
  displayedShirtPriceCents: 5000,
  includeShirt: false,
  shirtSize: "" as const,
};

describe("registration domain", () => {
  afterEach(() => vi.useRealTimers());

  it("builds checkout with the trusted registration price", () => {
    expect(calculateOrderAmountCents(baseInput, standardQuote, 5000)).toBe(30000);
    expect(buildCheckoutItems(baseInput, standardQuote, 5000)).toEqual([
      { quantity: 1, price: 30000, description: "Inscrição — II Encontro de Coros" },
    ]);
  });

  it("adds the trusted shirt price", () => {
    const input = { ...baseInput, includeShirt: true, shirtSize: "M" as const };
    expect(calculateOrderAmountCents(input, standardQuote, 5000)).toBe(35000);
    expect(buildCheckoutItems(input, standardQuote, 5000)[1]).toEqual({
      quantity: 1,
      price: 5000,
      description: "Camisa oficial — tamanho M",
    });
  });

  it("rejects a shirt when its displayed price is unavailable", () => {
    const result = registrationSchema.safeParse({
      ...baseInput,
      includeShirt: true,
      shirtSize: "M",
      displayedShirtPriceCents: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a registration with a shirt but no size", () => {
    expect(registrationSchema.safeParse({ ...baseInput, includeShirt: true }).success).toBe(false);
  });

  it("rejects an unrecognized shirt size", () => {
    expect(
      registrationSchema.safeParse({ ...baseInput, includeShirt: true, shirtSize: "XXL" }).success,
    ).toBe(false);
  });

  it("requires a valid CPF and normalizes its punctuation", () => {
    const parsed = registrationSchema.safeParse({ ...baseInput, cpf: "529.982.247-25" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.cpf).toBe("52998224725");
    expect(registrationSchema.safeParse({ ...baseInput, cpf: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...baseInput, cpf: "111.111.111-11" }).success).toBe(
      false,
    );
  });

  it("validates and normalizes the identity used to resume a registration", () => {
    expect(
      registrationResumeSchema.parse({ cpf: "529.982.247-25", birthDate: "1990-05-12" }),
    ).toEqual({ cpf: "52998224725", birthDate: "1990-05-12" });
    expect(() =>
      registrationResumeSchema.parse({ cpf: "111.111.111-11", birthDate: "1990-05-12" }),
    ).toThrow("Informe um CPF válido.");
  });

  it("requires a valid choir id and a coherent displayed quote", () => {
    expect(registrationSchema.safeParse({ ...baseInput, choirId: "not-an-id" }).success).toBe(
      false,
    );
    expect(
      registrationSchema.safeParse({
        ...baseInput,
        displayedQuote: { ...standardQuote, registrationPriceCents: 10000 },
      }).success,
    ).toBe(false);
  });

  it("rejects impossible and future birth dates", () => {
    expect(registrationSchema.safeParse({ ...baseInput, birthDate: "2026-02-30" }).success).toBe(
      false,
    );
    expect(registrationSchema.safeParse({ ...baseInput, birthDate: "2999-01-01" }).success).toBe(
      false,
    );
  });

  it("uses the Fortaleza calendar day after UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T01:30:00.000Z"));
    expect(registrationSchema.safeParse({ ...baseInput, birthDate: "2026-09-08" }).success).toBe(
      false,
    );
    expect(registrationSchema.safeParse({ ...baseInput, birthDate: "2026-09-07" }).success).toBe(
      true,
    );
  });

  it("requires a valid email for checkout prefill", () => {
    expect(registrationSchema.safeParse({ ...baseInput, email: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...baseInput, email: "email-invalido" }).success).toBe(
      false,
    );
    expect(registrationSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects an invalid payment return identifier", () => {
    expect(
      paymentLookupSchema.safeParse({
        orderNsu: "not-a-uuid",
        transactionNsu: "transaction",
        slug: "invoice",
      }).success,
    ).toBe(false);
  });
});
