import { describe, expect, it } from "vitest";
import {
  planAdminRaffleSettlement,
  type AdminChoirRaffleRow,
} from "./admin-raffle-settlement.domain";

function row(
  registrationId: string,
  pendingCents: number,
  paidCents: number | null = null,
): AdminChoirRaffleRow {
  return {
    registrationId,
    name: registrationId,
    pendingCents,
    pendingTickets: pendingCents > 0 ? pendingCents / 1000 : null,
    paidCents,
  };
}

const updatesOf = (updates: Array<{ registrationId: string; nextPaidCents: number }>) =>
  Object.fromEntries(updates.map(({ registrationId, nextPaidCents }) => [registrationId, nextPaidCents]));

describe("planAdminRaffleSettlement", () => {
  it("settles every open balance when no total is informed", () => {
    const plan = planAdminRaffleSettlement([row("a", 20000), row("b", 20000)]);

    expect(updatesOf(plan.updates)).toEqual({ a: 20000, b: 20000 });
    expect(plan.coveredPendingCents).toBe(40000);
    expect(plan.extraCents).toBe(0);
  });

  it("records the surplus above the pending balance as extra raffle revenue", () => {
    const plan = planAdminRaffleSettlement(
      [row("a", 0, 20000), row("b", 0, 20000), row("c", 0, 20000)],
      364000,
    );

    // Already recorded 600.00 and nothing pending; the whole 3,640.00 target is
    // the recorded total, so the difference is extra revenue.
    expect(plan.extraCents).toBe(304000);
    expect(updatesOf(plan.updates)).toEqual({ a: 324000 });
  });

  it("covers open balances first and records only the remainder as extra", () => {
    const plan = planAdminRaffleSettlement([row("a", 30000), row("b", 20000)], 60000);

    expect(updatesOf(plan.updates)).toEqual({ a: 40000, b: 20000 });
    expect(plan.coveredPendingCents).toBe(50000);
    expect(plan.extraCents).toBe(10000);
  });

  it("keeps already settled balances when the total is reduced", () => {
    // a holds an extra 1,840.00 over its 200.00 baseline; correcting the choir
    // total must remove the excess before touching the other choristers.
    const plan = planAdminRaffleSettlement(
      [row("a", 0, 204000), row("b", 0, 20000), row("c", 0, 20000)],
      240000,
    );

    expect(updatesOf(plan.updates)).toEqual({ a: 200000 });
    expect(plan.coveredPendingCents).toBe(0);
  });

  it("does nothing when the total matches the settled amount", () => {
    const plan = planAdminRaffleSettlement(
      [row("a", 0, 20000), row("b", 0, 20000), row("c", 0, 20000)],
      60000,
    );

    expect(plan.updates).toEqual([]);
    expect(plan.coveredPendingCents).toBe(0);
    expect(plan.extraCents).toBe(0);
  });
});
