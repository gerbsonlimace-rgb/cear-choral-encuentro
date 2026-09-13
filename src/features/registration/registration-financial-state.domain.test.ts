import { describe, expect, it } from "vitest";
import { deriveRegistrationFinancialState } from "./registration-financial-state.domain";

const promotionalRegistration = {
  paymentStatus: "paid" as const,
  initialAmountCents: 10_000,
  pricingType: "promotional" as const,
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  confirmedComplementCents: 8_000,
};

describe("deriveRegistrationFinancialState", () => {
  it("keeps a pending checkout amount pending without treating it as confirmed principal", () => {
    expect(
      deriveRegistrationFinancialState({
        paymentStatus: "pending",
        initialAmountCents: 10_000,
        pricingType: "promotional",
        standardPriceCents: 30_000,
        registrationPriceCents: 10_000,
        confirmedComplementCents: 0,
      }),
    ).toEqual({ status: "pending", pendingCents: 10_000, confirmedPrincipalCents: 0 });
  });

  it("combines the paid promotional principal with confirmed complement principal", () => {
    expect(deriveRegistrationFinancialState(promotionalRegistration)).toEqual({
      status: "partially_paid",
      pendingCents: 12_000,
      confirmedPrincipalCents: 18_000,
    });
  });

  it("marks a standard registration paid when its confirmed initial principal matches its snapshot", () => {
    expect(
      deriveRegistrationFinancialState({
        paymentStatus: "paid",
        initialAmountCents: 30_000,
        pricingType: "standard",
        standardPriceCents: 30_000,
        registrationPriceCents: 30_000,
        confirmedComplementCents: 0,
      }),
    ).toEqual({ status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 });
  });

  it("marks a fully settled promotional registration paid", () => {
    expect(
      deriveRegistrationFinancialState({ ...promotionalRegistration, confirmedComplementCents: 20_000 }),
    ).toEqual({ status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 });
  });

  it("returns legacy when trusted price snapshots are missing or inconsistent", () => {
    for (const input of [
      { ...promotionalRegistration, pricingType: null },
      { ...promotionalRegistration, standardPriceCents: null },
      { ...promotionalRegistration, registrationPriceCents: null },
      { ...promotionalRegistration, initialAmountCents: 9_999 },
      { ...promotionalRegistration, standardPriceCents: 10_000 },
      { ...promotionalRegistration, pricingType: "standard" as const },
    ]) {
      expect(deriveRegistrationFinancialState(input)).toEqual({
        status: "legacy",
        pendingCents: null,
        confirmedPrincipalCents: null,
      });
    }
  });

  it("returns legacy for overpayment or unsafe money values instead of creating a balance", () => {
    for (const input of [
      { ...promotionalRegistration, confirmedComplementCents: 20_001 },
      { ...promotionalRegistration, confirmedComplementCents: Number.MAX_SAFE_INTEGER + 1 },
      { ...promotionalRegistration, initialAmountCents: Number.MAX_SAFE_INTEGER + 1 },
      { ...promotionalRegistration, confirmedComplementCents: -1 },
    ]) {
      expect(deriveRegistrationFinancialState(input)).toEqual({
        status: "legacy",
        pendingCents: null,
        confirmedPrincipalCents: null,
      });
    }
  });

  it("does not count a complement against an unconfirmed checkout", () => {
    expect(
      deriveRegistrationFinancialState({
        ...promotionalRegistration,
        paymentStatus: "pending",
        confirmedComplementCents: 8_000,
      }),
    ).toEqual({ status: "legacy", pendingCents: null, confirmedPrincipalCents: null });
  });
});
