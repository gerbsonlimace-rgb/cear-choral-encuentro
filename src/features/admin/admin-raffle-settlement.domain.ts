export type AdminChoirRaffleRow = {
  registrationId: string;
  name: string;
  pendingCents: number;
  pendingTickets: number | null;
  paidCents: number | null;
};

export type AdminRaffleSettlementPlan = {
  updates: Array<{ registrationId: string; nextPaidCents: number }>;
  coveredPendingCents: number;
  extraCents: number;
};

/**
 * Plans a choir raffle settlement.
 *
 * With `totalCents` the informed amount becomes the choir's total raffle
 * revenue: the difference from what was already recorded covers the open
 * balances first and, when it exceeds them, the surplus is kept as extra
 * raffle sales. Without it every open balance is settled.
 */
export function planAdminRaffleSettlement(
  rows: AdminChoirRaffleRow[],
  totalCents?: number,
): AdminRaffleSettlementPlan {
  const updates = new Map<string, number>();
  const totalPaidCents = rows.reduce((total, row) => total + (row.paidCents ?? 0), 0);
  let coveredPendingCents = 0;
  let extraCents = 0;

  if (totalCents === undefined) {
    for (const row of rows) {
      if (row.pendingCents <= 0) continue;
      updates.set(row.registrationId, (row.paidCents ?? 0) + row.pendingCents);
      coveredPendingCents += row.pendingCents;
    }
  } else {
    const delta = totalCents - totalPaidCents;
    if (delta > 0) {
      let budget = delta;
      for (const row of rows) {
        if (budget <= 0) break;
        if (row.pendingCents <= 0) continue;
        const allocation = Math.min(row.pendingCents, budget);
        budget -= allocation;
        coveredPendingCents += allocation;
        updates.set(row.registrationId, (row.paidCents ?? 0) + allocation);
      }
      if (budget > 0) {
        // Everything beyond the open balances is extra raffle revenue.
        extraCents = budget;
        const target = rows[0];
        if (target) {
          updates.set(
            target.registrationId,
            (updates.get(target.registrationId) ?? target.paidCents ?? 0) + extraCents,
          );
        } else {
          throw new Error("Nenhum coralista com rifas para registrar o valor recebido.");
        }
      }
    } else if (delta < 0) {
      let reduction = -delta;
      // Correct the excess first so reducing the choir total never reopens
      // balances that were already settled.
      const candidates = [...rows].sort(
        (left, right) => (right.paidCents ?? 0) - (left.paidCents ?? 0),
      );
      for (const row of candidates) {
        if (reduction <= 0) break;
        const paid = row.paidCents ?? 0;
        if (paid <= 0) continue;
        const removed = Math.min(paid, reduction);
        reduction -= removed;
        updates.set(row.registrationId, paid - removed);
      }
    }
  }

  return {
    updates: [...updates.entries()].map(([registrationId, nextPaidCents]) => ({
      registrationId,
      nextPaidCents,
    })),
    coveredPendingCents,
    extraCents,
  };
}
