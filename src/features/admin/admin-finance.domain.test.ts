import { describe, expect, it } from "vitest";
import type { AdminRegistrationRow } from "./admin.domain";
import { buildFinanceAutoEntries } from "./admin-finance.domain";

const row = (overrides: Partial<AdminRegistrationRow>): AdminRegistrationRow =>
  ({
    id: "registration-1",
    name: "Ana Silva",
    badgeName: null,
    choirName: "Coro Tianguá",
    paidAt: "2026-10-20T12:00:00Z",
    financialState: { status: "paid", confirmedPrincipalCents: 10_000, pendingCents: 0 },
    adminRafflePaidCents: 5_000,
    ...overrides,
  }) as AdminRegistrationRow;

describe("automatic finance entries", () => {
  it("separates confirmed registration and raffle revenue by exact choir name", () => {
    const entries = buildFinanceAutoEntries(
      [
        row({}),
        row({
          id: "registration-2",
          name: "Bia",
          financialState: { status: "pending", confirmedPrincipalCents: 0, pendingCents: 20_000 },
          adminRafflePaidCents: 0,
        }),
        row({
          id: "registration-3",
          name: "Caio",
          choirName: "Outro coro",
          financialState: { status: "paid", confirmedPrincipalCents: 20_000, pendingCents: 0 },
          adminRafflePaidCents: 0,
        }),
      ],
      "2026-11-16",
    );

    expect(entries.map(({ description, amountCents }) => [description, amountCents])).toEqual([
      ["Coro Tianguá · Inscrições", 10_000],
      ["Coro Tianguá · Rifas", 5_000],
      ["Outro coro · Inscrições", 20_000],
      ["Outro coro · Rifas", 0],
    ]);
    expect(entries[0].participants).toEqual([
      { id: "registration-1", name: "Ana Silva", amountCents: 10_000 },
      { id: "registration-2", name: "Bia", amountCents: 0 },
    ]);
  });

  it("keeps cancellation refunds out of the received registration total", () => {
    const entries = buildFinanceAutoEntries(
      [row({ cancelledAt: "2026-11-01T12:00:00Z", refundCents: 3_000 })],
      "2026-11-16",
    );
    expect(entries.map((entry) => entry.amountCents)).toEqual([7_000, 5_000]);
    expect(entries[0].participants?.[0]?.amountCents).toBe(7_000);
  });
});
