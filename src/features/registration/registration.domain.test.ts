import { afterEach, describe, expect, it, vi } from "vitest";
import {
  birthDateSchema,
  buildCheckoutItems,
  calculateOrderAmountCents,
  cpfSchema,
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
  badgeName: "Maria Silva",
  cpf: "52998224725",
  email: "maria@example.com",
  phone: "85999999999",
  birthDate: "1990-05-20",
  choirId: "11111111-1111-4111-8111-111111111111",
  voicePart: "soprano" as const,
  photo: { contentType: "image/jpeg" as const, dataBase64: "cGhvdG8=" },
  raffleChoice: "full_price" as const,
  displayedQuote: standardQuote,
};

describe("registration domain", () => {
  afterEach(() => vi.useRealTimers());

  it("requires a valid CPF and normalizes its punctuation", () => {
    const parsed = registrationSchema.safeParse({ ...baseInput, cpf: "529.982.247-25" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.cpf).toBe("52998224725");
    expect(registrationSchema.safeParse({ ...baseInput, cpf: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...baseInput, cpf: "111.111.111-11" }).success).toBe(
      false,
    );
  });

  it("requires a short badge name separate from the certificate name", () => {
    expect(registrationSchema.safeParse({ ...baseInput, badgeName: "Antonio Lima" }).success).toBe(
      true,
    );
    expect(registrationSchema.safeParse({ ...baseInput, badgeName: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...baseInput, badgeName: "A" }).success).toBe(false);
  });

  it("normalizes the CPF and validates the birth date used to resume a registration", () => {
    expect(
      registrationResumeSchema.parse({ cpf: "529.982.247-25", birthDate: "1990-05-12" }),
    ).toEqual({ cpf: "52998224725", birthDate: "1990-05-12" });
    expect(() =>
      registrationResumeSchema.parse({ cpf: "111.111.111-11", birthDate: "1990-05-12" }),
    ).toThrow("Informe um CPF válido.");

    expect(cpfSchema.parse("529.982.247-25")).toBe("52998224725");
    expect(birthDateSchema.parse("1990-05-12")).toBe("1990-05-12");
  });

  it("builds checkout with the trusted registration price", () => {
    expect(calculateOrderAmountCents(baseInput, standardQuote)).toBe(30000);
    expect(buildCheckoutItems(baseInput, standardQuote)).toEqual([
      { quantity: 1, price: 30000, description: "Inscrição — II Encontro de Coros" },
    ]);
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

  it("requires the displayed quote to match the raffle choice", () => {
    const promotionalQuote = {
      pricingType: "promotional" as const,
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    };

    expect(
      registrationSchema.safeParse({
        ...baseInput,
        raffleChoice: "participate",
        displayedQuote: promotionalQuote,
      }).success,
    ).toBe(true);
    expect(
      registrationSchema.safeParse({
        ...baseInput,
        raffleChoice: "participate",
        displayedQuote: standardQuote,
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        ...baseInput,
        raffleChoice: "full_price",
        displayedQuote: promotionalQuote,
      }).success,
    ).toBe(false);
  });

  it("accepts only the supported musical profiles", () => {
    for (const voicePart of ["soprano", "contralto", "tenor", "baixo", "nao_sei_informar"]) {
      expect(registrationSchema.safeParse({ ...baseInput, voicePart }).success).toBe(true);
    }
    expect(registrationSchema.safeParse({ ...baseInput, voicePart: "baritono" }).success).toBe(
      false,
    );
  });

  it("requires a supported participant photo", () => {
    expect(registrationSchema.safeParse({ ...baseInput, photo: undefined }).success).toBe(false);
    expect(
      registrationSchema.safeParse({
        ...baseInput,
        photo: { contentType: "image/gif", dataBase64: "cGhvdG8=" },
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

  it("accepts only supported musical profiles and participant photos", () => {
    const photo = { contentType: "image/jpeg" as const, dataBase64: "cGhvdG8=" };

    for (const voicePart of ["soprano", "contralto", "tenor", "baixo", "nao_sei_informar"]) {
      expect(registrationSchema.safeParse({ ...baseInput, voicePart, photo }).success).toBe(true);
    }
    expect(
      registrationSchema.safeParse({ ...baseInput, voicePart: "baritono", photo }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...baseInput, voicePart: "soprano", photo: undefined })
        .success,
    ).toBe(false);
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
