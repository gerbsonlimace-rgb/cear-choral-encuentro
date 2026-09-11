import { describe, expect, it } from "vitest";
import {
  buildBrazilWhatsAppUrl,
  calculateComplementState,
  complementCheckoutSchema,
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
  it("subtracts only confirmed complement principal from the snapshotted price difference", () => {
    expect(calculateComplementState(paidPromotionalRegistration)).toEqual({
      eligible: true,
      totalCents: 20_000,
      paidCents: 5_000,
      balanceCents: 15_000,
    });
  });

  it("marks a standard-price registration as ineligible", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        pricingType: "standard",
        registrationPriceCents: 30_000,
        confirmedComplementCents: 0,
      }),
    ).toEqual({ eligible: false, reason: "standard_price" });
  });

  it("blocks a promotional complement until the participant payment is confirmed", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        paymentStatus: "pending",
      }),
    ).toEqual({ eligible: false, reason: "awaiting_participant_payment" });
  });

  it("fails closed on overpayment even while the participant payment is still pending", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        paymentStatus: "pending",
        confirmedComplementCents: 20_001,
      }),
    ).toEqual({ eligible: false, reason: "missing_snapshot" });
  });

  it.each([
    { standardPriceCents: null },
    { registrationPriceCents: null },
    { standardPriceCents: -30_000 },
    { registrationPriceCents: -10_000 },
    { standardPriceCents: 10_000, registrationPriceCents: 10_000 },
    { standardPriceCents: 9_999, registrationPriceCents: 10_000 },
    { pricingType: "standard", confirmedComplementCents: 0 },
    { standardPriceCents: 30_000.5 },
    { standardPriceCents: Number.MAX_SAFE_INTEGER + 1 },
    { registrationPriceCents: Number.MAX_SAFE_INTEGER + 1 },
    { confirmedComplementCents: -1 },
    { confirmedComplementCents: Number.MAX_SAFE_INTEGER + 1 },
    { confirmedComplementCents: 20_001 },
  ])("fails closed for an incomplete or inconsistent snapshot %#", (override) => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        ...override,
      }),
    ).toEqual({ eligible: false, reason: "missing_snapshot" });
  });

  it("marks a fully paid complement as settled", () => {
    expect(
      calculateComplementState({
        ...paidPromotionalRegistration,
        confirmedComplementCents: 20_000,
      }),
    ).toEqual({ eligible: false, reason: "settled" });
  });

  it("exposes an open checkout without subtracting its amount from the accounting balance", () => {
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
    ).toEqual({
      eligible: true,
      totalCents: 20_000,
      paidCents: 2_000,
      balanceCents: 18_000,
      openPayment,
    });
  });
});

describe("complement checkout input", () => {
  const registrationId = "11111111-1111-4111-8111-111111111111";

  it("accepts only a strict UUID and positive integer cents", () => {
    expect(complementCheckoutSchema.parse({ registrationId, amountCents: 1 })).toEqual({
      registrationId,
      amountCents: 1,
    });

    for (const input of [
      { registrationId: "registration-1", amountCents: 1 },
      { registrationId, amountCents: 0 },
      { registrationId, amountCents: -1 },
      { registrationId, amountCents: 1.5 },
      { registrationId, amountCents: "5000" },
      { registrationId, amountCents: 5_000, choirId: registrationId },
    ]) {
      expect(complementCheckoutSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("Brazilian WhatsApp URL", () => {
  it.each([
    ["(88) 99999-1234", "https://wa.me/5588999991234"],
    ["88 3333-1234", "https://wa.me/558833331234"],
  ])("normalizes %s", (phone, expected) => {
    expect(buildBrazilWhatsAppUrl(phone)).toBe(expected);
  });

  it.each([
    "",
    "9999-1234",
    "088 99999-1234",
    "+55 (88) 99999-1234",
    "123456789012",
    "(88) 99999-1234 ramal A",
  ])("does not generate a link for invalid Brazilian number %s", (phone) => {
    expect(buildBrazilWhatsAppUrl(phone)).toBeNull();
  });
});
