import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdminFinancialState, type AdminRegistrationRow } from "./admin.domain";
import { getAdminRafflePending, getAdminRegistrationPendingCents } from "./admin-raffle.domain";
import {
  planAdminRaffleSettlement,
  type AdminChoirRaffleRow,
} from "./admin-raffle-settlement.domain";
import { getAdminRegistrationService } from "./admin-registration.server";

export type { AdminChoirRaffleRow };

export type AdminChoirRosterRow = {
  registrationId: string;
  badgeName: string;
  name: string;
  email: string;
  phone: string;
  status: "paid" | "pending" | "partially_paid" | "exempt" | "legacy";
  registrationValueCents: number | null;
  registrationPendingCents: number;
  rafflePendingCents: number | null;
  rafflePendingTickets: number | null;
};

export type AdminChoirRoster = {
  rows: AdminChoirRosterRow[];
  total: number;
  pendingFeeCents: number;
  rafflePendingCents: number;
  rafflePendingTickets: number | null;
  receivedCents: number;
  rafflePaidCents: number;
};

export type AdminChoirRaffleSettlement = {
  /** Total raffle amount recorded for the choir after the operation. */
  settledCents: number;
  /** Amount recorded above the current pending balance (extra raffle sales). */
  leftoverCents: number;
  /** Raffle balance still open for the choir. */
  remainingCents: number;
  settledCount: number;
  totalPendingCents: number;
  totalPaidCents: number;
};

function raffleForRow(row: AdminRegistrationRow) {
  return getAdminRafflePending(row, getAdminFinancialState(row));
}

async function loadChoirRows(choirName: string): Promise<AdminRegistrationRow[]> {
  const page = await getAdminRegistrationService().list(
    {
      search: "",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 1000,
    },
    false,
  );
  return page.rows.filter((row) => row.choirName === choirName);
}

function toChoirRaffleRow(row: AdminRegistrationRow): AdminChoirRaffleRow | null {
  const raffle = raffleForRow(row);
  if (!raffle) return null;
  return {
    registrationId: row.id,
    name: row.name,
    pendingCents: raffle.cents,
    pendingTickets: raffle.tickets,
    paidCents: row.adminRafflePaidCents ?? null,
  };
}

export async function listAdminChoirRaffles(choirName: string): Promise<{
  rows: AdminChoirRaffleRow[];
  totalPendingCents: number;
  totalPaidCents: number;
}> {
  const rows = (await loadChoirRows(choirName))
    .map(toChoirRaffleRow)
    .filter((row): row is AdminChoirRaffleRow => row !== null)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  return {
    rows,
    totalPendingCents: rows.reduce((total, row) => total + row.pendingCents, 0),
    totalPaidCents: rows.reduce((total, row) => total + (row.paidCents ?? 0), 0),
  };
}

/**
 * Loads the per-chorister detail shown in the summary modal, mirroring the
 * columns of the registrations PDF without generating a file.
 */
export async function getAdminChoirRoster(choirName: string): Promise<{
  rows: AdminRegistrationRow[];
  total: number;
  pendingFeeCents: number;
  rafflePendingCents: number;
  rafflePendingTickets: number | null;
  receivedCents: number;
  rafflePaidCents: number;
}> {
  const registrationRows = (await loadChoirRows(choirName)).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
  let pendingFeeCents = 0;
  let rafflePendingCents = 0;
  let rafflePendingTickets: number | null = 0;
  let receivedCents = 0;
  let rafflePaidCents = 0;

  for (const row of registrationRows) {
    const state = getAdminFinancialState(row);
    pendingFeeCents += getAdminRegistrationPendingCents(row, state) ?? 0;
    if (state.status === "paid" || state.status === "partially_paid") {
      receivedCents += state.confirmedPrincipalCents;
    }
    receivedCents += row.adminRafflePaidCents ?? 0;
    rafflePaidCents += row.adminRafflePaidCents ?? 0;
    const raffle = getAdminRafflePending(row, state);
    if (raffle) {
      rafflePendingCents += raffle.cents;
      rafflePendingTickets =
        rafflePendingTickets === null || raffle.tickets === null
          ? null
          : rafflePendingTickets + raffle.tickets;
    }
  }

  return {
    rows: registrationRows,
    total: registrationRows.length,
    pendingFeeCents,
    rafflePendingCents,
    rafflePendingTickets,
    receivedCents,
    rafflePaidCents,
  };
}

async function applyPaidCents(
  rows: Array<{ registrationId: string; nextPaidCents: number }>,
) {
  for (const row of rows) {
    const { error } = await supabaseAdmin
      .from("registrations")
      .update({ admin_raffle_paid_cents: row.nextPaidCents })
      .eq("id", row.registrationId);
    if (error) throw new Error("Não foi possível registrar as rifas quitadas.");
  }
}

/**
 * Records the raffle amount received for a choir.
 *
 * With `totalCents` the informed amount becomes the choir's total raffle
 * revenue: the difference from what was already recorded is distributed over
 * the open balances and, when it exceeds them, kept as extra raffle sales.
 * Without it the administrator settles every open balance.
 *
 * Only the admin-only raffle column is written, so checkout eligibility and
 * the shared registration financial state stay unchanged.
 */
export async function setAdminRegistrationRafflePaid(input: {
  registrationId: string;
  rafflePaidCents: number | null;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("registrations")
    .update({ admin_raffle_paid_cents: input.rafflePaidCents })
    .eq("id", input.registrationId);
  if (error) throw new Error("Não foi possível registrar o pagamento das rifas.");
}
export async function settleAdminChoirRaffles(input: {
  choirName: string;
  totalCents?: number;
}): Promise<AdminChoirRaffleSettlement> {
  const { rows, totalPendingCents } = await listAdminChoirRaffles(input.choirName);
  const plan = planAdminRaffleSettlement(rows, input.totalCents);

  await applyPaidCents(plan.updates);

  const after = await listAdminChoirRaffles(input.choirName);
  return {
    settledCents: after.totalPaidCents,
    leftoverCents: plan.extraCents,
    remainingCents: after.totalPendingCents,
    settledCount: plan.updates.length,
    totalPendingCents,
    totalPaidCents: after.totalPaidCents,
  };
}
