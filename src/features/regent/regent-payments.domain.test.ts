import { describe, expect, it } from "vitest";
import {
  buildBrazilWhatsAppUrl,
  calculateComplementState,
  complementCheckoutSchema,
  formatComplementCents,
  type ComplementPaymentRow,
} from "./regent-payments.domain";

const paidPromotionalRegistration = {
  paymentStatus: "paid",
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  confirmedComplementCents: 5_000,
  openPayment: null,
} as const;

describe("complement balance", () => {
  it("calculates the promotional balance from the standard-registration difference", () => {
    expect(calculateComplementState(paidPromotionalRegistration)).toEqual({
      eligible: true,
      totalCents: 20_000,
      paidCents: 5_000,
      balanceCents: 15_000,
    });
  });

  it("uses the promotional remaining snapshot when configured", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        remainingPriceCents: 15_000,
        confirmedComplementCents: 2_000,
      }),
    ).toMatchObject({ totalCents: 15_000, balanceCents: 13_000 });
  });

  it("requires a paid promotional registration", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        pricingType: "standard",
        registrationPriceCents: 30_000,
        confirmedComplementCents: 0,
      }),
    ).toEqual({ eligible: false, reason: "standard_price" });
    expect(
      calculateComplementState({ ...paidPromotionalRegistration, paymentStatus: "pending" }),
    ).toEqual({ eligible: false, reason: "awaiting_participant_payment" });
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        pricingType: "promotional",
        registrationPriceCents: 30_000,
      }),
    ).toEqual({ eligible: false, reason: "missing_snapshot" });
  });

  it("fails closed for invalid or overpaid snapshots", () => {
    for (const override of [
      { standardPriceCents: null },
      { registrationPriceCents: null },
      { standardPriceCents: 9_999, registrationPriceCents: 10_000 },
      { standardPriceCents: 30_000.5 },
      { confirmedComplementCents: -1 },
      { confirmedComplementCents: 20_001 },
    ]) {
      expect(calculateComplementState({ ...paidPromotionalRegistration, ...override })).toEqual({
        eligible: false,
        reason: "missing_snapshot",
      });
    }
  });

  it("settles an exactly paid complement and does not subtract an open checkout", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        confirmedComplementCents: 20_000,
      }),
    ).toEqual({ eligible: false, reason: "settled" });
    const openPayment: ComplementPaymentRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amountCents: 12_000,
      status: "pending",
      checkoutUrl: "https://checkout.infinitepay.io/example",
      createdAt: "2026-09-11T12:00:00.000Z",
      paidAt: null,
      initiatedByName: "Ana Silva",
      initiatedAs: "regent",
    };
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        confirmedComplementCents: 2_000,
        openPayment,
      }),
    ).toMatchObject({ totalCents: 20_000, paidCents: 2_000, balanceCents: 18_000, openPayment });
  });
});

describe("complement checkout and presentation", () => {
  it("accepts only a strict UUID and positive integer cents", () => {
    const registrationId = "11111111-1111-4111-8111-111111111111";
    expect(complementCheckoutSchema.safeParse({ registrationId, amountCents: 1 }).success).toBe(
      true,
    );
    expect(complementCheckoutSchema.safeParse({ registrationId, amountCents: 0 }).success).toBe(
      false,
    );
    expect(complementCheckoutSchema.safeParse({ registrationId, amountCents: 1.5 }).success).toBe(
      false,
    );
    expect(
      complementCheckoutSchema.safeParse({ registrationId: "registration-1", amountCents: 1 })
        .success,
    ).toBe(false);
    expect(complementCheckoutSchema.safeParse({ registrationId, amountCents: -1 }).success).toBe(
      false,
    );
  });

  it("formats complement cents in Brazilian currency", () => {
    expect(formatComplementCents(1_234_567)).toBe("R$ 12.345,67");
    expect(formatComplementCents(0)).toBe("R$ 0,00");
  });

  it("builds Brazilian WhatsApp URLs only for valid numbers", () => {
    expect(buildBrazilWhatsAppUrl("(88) 99999-1234")).toBe("https://wa.me/5588999991234");
    expect(buildBrazilWhatsAppUrl("+55 (88) 99999-1234")).toBeNull();
    expect(buildBrazilWhatsAppUrl("889999912345")).toBeNull();
  });
});
