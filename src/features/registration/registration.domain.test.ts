import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DIOCESES,
  buildCheckoutItems,
  calculateOrderAmountCents,
  dioceseSchema,
  paymentLookupSchema,
  registrationSchema,
} from "./registration.domain";

const baseInput = {
  name: "Maria da Silva",
  email: "maria@example.com",
  phone: "85999999999",
  birthDate: "1990-05-20",
  diocese: "Diocese de Quixadá" as const,
  includeShirt: false,
  shirtSize: "" as const,
};

describe("registration domain", () => {
  afterEach(() => vi.useRealTimers());

  it("charges only registration without a shirt", () => {
    expect(calculateOrderAmountCents(baseInput)).toBe(100);
    expect(buildCheckoutItems(baseInput)).toEqual([
      { quantity: 1, price: 100, description: "Inscrição — II Encontro de Coros" },
    ]);
  });

  it("adds the selected shirt", () => {
    const input = { ...baseInput, includeShirt: true, shirtSize: "M" as const };
    expect(calculateOrderAmountCents(input)).toBe(110);
    expect(buildCheckoutItems(input)[1]).toEqual({
      quantity: 1,
      price: 10,
      description: "Camisa oficial — tamanho M",
    });
  });

  it("rejects a registration with a shirt but no size", () => {
    const result = registrationSchema.safeParse({
      ...baseInput,
      includeShirt: true,
      shirtSize: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized shirt size", () => {
    const result = registrationSchema.safeParse({
      ...baseInput,
      includeShirt: true,
      shirtSize: "XXL",
    });

    expect(result.success).toBe(false);
  });

  it("accepts exactly the nine approved dioceses", () => {
    expect(DIOCESES).toEqual([
      "Arquidiocese de Fortaleza",
      "Diocese do Crato",
      "Diocese de Crateús",
      "Diocese de Iguatu",
      "Diocese de Itapipoca",
      "Diocese de Limoeiro do Norte",
      "Diocese de Quixadá",
      "Diocese de Sobral",
      "Diocese de Tianguá",
    ]);
    expect(DIOCESES.every((diocese) => dioceseSchema.safeParse(diocese).success)).toBe(true);
    expect(dioceseSchema.safeParse("Diocese de Fortaleza").success).toBe(false);
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
