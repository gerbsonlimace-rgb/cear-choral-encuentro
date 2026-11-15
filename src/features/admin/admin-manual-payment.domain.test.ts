import { describe, expect, it } from "vitest";
import {
  parseReceivedAmount,
  planManualPayment,
  type ManualPaymentSnapshot,
} from "./admin-manual-payment.domain";
import { getAdminRegistrationPendingCents } from "./admin-raffle.domain";

const standardPending: ManualPaymentSnapshot = {
  paymentStatus: "pending",
  paymentOrigin: "infinitepay",
  amountCents: 15000,
  paidAmountCents: null,
  pricingType: "standard",
  standardPriceCents: 15000,
  registrationPriceCents: 15000,
  feePendingCents: null,
  discountCents: null,
};

describe("manual registration-fee payment", () => {
  it("keeps prior receipts counted when waiving only the remaining fee", () => {
    const plan = planManualPayment({
      ...standardPending, paymentStatus: "paid", paymentOrigin: "manual",
      amountCents: 10000, paidAmountCents: 10000,
      registrationPriceCents: 10000, standardPriceCents: 10000, feePendingCents: 5000,
    }, 0, "discount");
    expect(plan.update).toMatchObject({
      amount_cents: 10000, paid_amount_cents: 10000,
      manual_fee_pending_cents: null, manual_discount_cents: 5000,
    });
  });

  it.each(["pending", "paid"])("charges a previously exempt %s registration without carrying forward its old waiver", (paymentStatus) => {
    const plan = planManualPayment({
      ...standardPending, paymentStatus, paymentOrigin: "exemption",
      amountCents: 0, paidAmountCents: 0, originalRegistrationPriceCents: 15000,
      discountCents: 15000,
    }, 10000, "pending");
    expect(plan.update).toMatchObject({
      paid_amount_cents: 10000, manual_fee_pending_cents: 5000, manual_discount_cents: null,
    });
  });

  it("approves a free registration through the same payment configuration", () => {
    const plan = planManualPayment({
      ...standardPending, paymentOrigin: "exemption", amountCents: 0,
      registrationPriceCents: 0, standardPriceCents: 0, originalRegistrationPriceCents: 0,
    }, 0, "discount");
    expect(plan.update.paid_amount_cents).toBe(0);
    expect(plan.update.manual_discount_cents).toBeNull();
  });

  it("settles the full fee when the received amount equals the fee", () => {
    const plan = planManualPayment(standardPending, 15000, "pending");
    expect(plan.pendingCents).toBe(0);
    expect(plan.discountCents).toBe(0);
    expect(plan.update).toMatchObject({
      amount_cents: 15000,
      paid_amount_cents: 15000,
      manual_fee_pending_cents: null,
      manual_discount_cents: null,
    });
  });

  it("leaves the unpaid fee open when the admin chooses to keep it pending", () => {
    const plan = planManualPayment(standardPending, 10000, "pending");
    expect(plan.pendingCents).toBe(5000);
    expect(plan.update).toMatchObject({
      amount_cents: 10000,
      paid_amount_cents: 10000,
      registration_price_cents: 10000,
      standard_price_cents: 10000,
      manual_fee_pending_cents: 5000,
      manual_discount_cents: null,
    });
  });

  it("waives the unpaid fee as a discount when the admin exempts the remainder", () => {
    const plan = planManualPayment(standardPending, 10000, "discount");
    expect(plan.pendingCents).toBe(0);
    expect(plan.discountCents).toBe(5000);
    expect(plan.update).toMatchObject({ manual_fee_pending_cents: null, manual_discount_cents: 5000 });
  });

  it("keeps the raffle complement untouched on promotional registrations", () => {
    const plan = planManualPayment(
      { ...standardPending, pricingType: "promotional", amountCents: 5000, registrationPriceCents: 5000, standardPriceCents: 25000 },
      3000,
      "pending",
    );
    // Promotional difference (raffles) stays R$ 200.
    expect((plan.update.standard_price_cents ?? 0) - (plan.update.registration_price_cents ?? 0)).toBe(20000);
    expect(plan.update.manual_fee_pending_cents).toBe(2000);
  });

  it("collects a later balance and can waive what is still missing", () => {
    const plan = planManualPayment(
      {
        ...standardPending,
        paymentStatus: "paid",
        paymentOrigin: "manual",
        amountCents: 10000,
        paidAmountCents: 10000,
        registrationPriceCents: 10000,
        standardPriceCents: 10000,
        feePendingCents: 5000,
      },
      2000,
      "discount",
    );
    expect(plan.mode).toBe("balance");
    expect(plan.update).toMatchObject({
      amount_cents: 12000,
      paid_amount_cents: 12000,
      manual_fee_pending_cents: null,
      manual_discount_cents: 3000,
    });
  });

  it("rejects a received amount above the pending fee", () => {
    expect(() => planManualPayment(standardPending, 15001)).toThrow(
      "O valor recebido não pode ser maior que o valor pendente.",
    );
  });

  it("counts an open fee balance as pending registration fee in the admin panel", () => {
    expect(
      getAdminRegistrationPendingCents(
        { isFreeRegistration: false, pricingType: "standard", registrationPriceCents: 10000, standardPriceCents: 10000, remainingPriceCents: null, manualFeePendingCents: 5000 },
        { status: "paid", pendingCents: 0, confirmedPrincipalCents: 10000 },
      ),
    ).toBe(5000);
  });

  it("parses Brazilian currency input", () => {
    expect(parseReceivedAmount("150,50")).toBe(15050);
    expect(parseReceivedAmount("1.500,00")).toBe(150000);
    expect(parseReceivedAmount("R$ 80")).toBe(8000);
    expect(parseReceivedAmount("abc")).toBeNull();
  });
});
