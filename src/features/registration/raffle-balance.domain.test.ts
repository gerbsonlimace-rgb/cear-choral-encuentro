import { describe, expect, it } from "vitest";
import { deriveRaffleBalance } from "./raffle-balance.domain";

describe("raffle balance", () => {
  it("counts promotional raffles and confirmed partial payments", () => {
    expect(deriveRaffleBalance({
      isFreeRegistration: false,
      paymentStatus: "paid",
      pricingType: "promotional",
      remainingPriceCents: 20_000,
      confirmedRaffleCents: 3_000,
    })).toEqual({
      totalCents: 20_000,
      paidCents: 3_000,
      pendingCents: 17_000,
      totalTickets: 20,
      paidTickets: 3,
      pendingTickets: 17,
    });
  });

  it("counts twenty raffles for approved free registrations", () => {
    expect(deriveRaffleBalance({
      isFreeRegistration: true,
      paymentStatus: "paid",
      pricingType: "standard",
      remainingPriceCents: 0,
      confirmedRaffleCents: 5_000,
    })).toMatchObject({ totalTickets: 20, paidTickets: 5, pendingTickets: 15 });
  });

  it("keeps the target paid and reports additional sales beyond it", () => {
    expect(deriveRaffleBalance({
      isFreeRegistration: true,
      paymentStatus: "paid",
      pricingType: "standard",
      remainingPriceCents: 0,
      confirmedRaffleCents: 25_000,
    })).toMatchObject({ paidTickets: 25, pendingTickets: 0, pendingCents: 0, extraTickets: 5 });
  });

  it("does not invent a ticket count for irregular money or old records", () => {
    expect(deriveRaffleBalance({
      isFreeRegistration: false,
      paymentStatus: "paid",
      pricingType: "promotional",
      remainingPriceCents: 20_000,
      confirmedRaffleCents: 250,
    })).toMatchObject({ pendingCents: 19_750, pendingTickets: null });
    expect(deriveRaffleBalance({
      isFreeRegistration: false,
      paymentStatus: "paid",
      pricingType: "standard",
      remainingPriceCents: 0,
      confirmedRaffleCents: 0,
    })).toBeNull();
  });
});
