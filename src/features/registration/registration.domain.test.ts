import { describe, expect, it } from "vitest";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  registrationSchema,
} from "./registration.domain";

const baseInput = {
  name: "Maria da Silva",
  email: "maria@example.com",
  phone: "85999999999",
  city: "Quixadá",
  institution: "Coro Paroquial",
  role: "singer" as const,
  includeShirt: false,
  shirtSize: "" as const,
  observations: "",
};

describe("registration domain", () => {
  it("charges only registration without a shirt", () => {
    expect(calculateOrderAmountCents(baseInput)).toBe(10000);
    expect(buildCheckoutItems(baseInput)).toEqual([
      { quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" },
    ]);
  });

  it("adds the selected shirt", () => {
    const input = { ...baseInput, includeShirt: true, shirtSize: "M" as const };
    expect(calculateOrderAmountCents(input)).toBe(13990);
    expect(buildCheckoutItems(input)[1]).toEqual({
      quantity: 1,
      price: 3990,
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
});
