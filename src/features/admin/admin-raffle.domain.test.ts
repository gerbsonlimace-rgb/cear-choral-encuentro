import { describe, expect, it } from "vitest";
import { getAdminRafflePending } from "./admin-raffle.domain";
import { summarizeAdminRegistrations, type AdminRegistrationRow } from "./admin.domain";

const row: AdminRegistrationRow = {
  id: "isento", createdAt: "2026-10-18", name: "Inscrito", badgeName: null,
  cpf: "52998224725", birthDate: "1990-01-01", diocese: "Quixadá", choirName: "Coro isento",
  otherChoirName: null, email: "teste@example.com", phone: "85999999999", city: "Quixadá",
  institution: null, role: "singer", voicePart: null, observations: null, includeShirt: false,
  shirtSize: null, shirtPriceCents: null, paymentStatus: "paid", amountCents: 0,
  paidAmountCents: 0, paymentMethod: null, installments: null, paidAt: null,
  paymentOrigin: "exemption", isFreeRegistration: true, pricingType: "standard",
  standardPriceCents: 0, registrationPriceCents: 0, remainingPriceCents: 0, photoUrl: null, regentName: null,
};
const exempt = { status: "exempt", pendingCents: 0, confirmedPrincipalCents: 0 } as const;
const promotional = { ...row, isFreeRegistration: false, paymentOrigin: "infinitepay" as const,
  pricingType: "promotional" as const, standardPriceCents: 30_000, registrationPriceCents: 10_000,
  remainingPriceCents: 20_000, amountCents: 10_000 };

describe("admin raffle tracking", () => {
  it("assigns 20 tickets worth R$ 200 per exempt-group participant", () => {
    expect(getAdminRafflePending(row, exempt)).toEqual({ cents: 20_000, tickets: 20 });
  });
  it("assigns the same obligation before approval without granting paid access", () => {
    const pendingRow = { ...row, paymentStatus: "pending" as const };
    expect(getAdminRafflePending(pendingRow, { status: "pending", pendingCents: 0, confirmedPrincipalCents: 0 })).toEqual({ cents: 20_000, tickets: 20 });
    expect(summarizeAdminRegistrations([pendingRow]).pending).toBe(1);
  });
  it("totals two exempt participants as 40 tickets and R$ 400 without counting revenue", () => {
    const summary = summarizeAdminRegistrations([row, { ...row, id: "outro" }]);
    expect(summary).toMatchObject({ rafflePendingCents: 40_000, rafflePendingTickets: 40, receivedCents: 0, pendingCents: 0 });
    expect(summary.byChoir[0]).toMatchObject({ rafflePendingCents: 40_000, rafflePendingTickets: 40 });
  });
  it("does not count an unpaid R$ 100 entry as raffle tickets", () => {
    expect(getAdminRafflePending(promotional, { status: "pending", pendingCents: 30_000, confirmedPrincipalCents: 0 })).toEqual({ cents: 20_000, tickets: 20 });
  });
  it("reduces the raffle balance by confirmed complements", () => {
    expect(getAdminRafflePending(promotional, { status: "partially_paid", pendingCents: 12_000, confirmedPrincipalCents: 18_000 })).toEqual({ cents: 12_000, tickets: 12 });
  });
  it("does not impose the group rule on individual exemptions", () => {
    expect(getAdminRafflePending({ ...row, isFreeRegistration: false }, exempt)).toBeNull();
  });
  it("does not round a balance that is not a multiple of R$ 10", () => {
    expect(getAdminRafflePending(promotional, { status: "partially_paid", pendingCents: 12_500, confirmedPrincipalCents: 17_500 })).toEqual({ cents: 12_500, tickets: null });
  });
  it("does not invent raffle balances for historical registrations", () => {
    expect(getAdminRafflePending(promotional, { status: "legacy", pendingCents: null, confirmedPrincipalCents: null })).toBeNull();
  });
});