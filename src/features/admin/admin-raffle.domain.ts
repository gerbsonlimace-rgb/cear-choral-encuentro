import type { AdminRegistrationRow } from "./admin.domain";
import type { RegistrationFinancialState } from "@/features/registration/registration-financial-state.domain";
import { FREE_GROUP_RAFFLE_TICKETS, RAFFLE_TICKET_PRICE_CENTS } from "@/features/registration/raffle-balance.domain";

export { RAFFLE_TICKET_PRICE_CENTS } from "@/features/registration/raffle-balance.domain";
export const EXEMPT_GROUP_RAFFLE_TICKETS = FREE_GROUP_RAFFLE_TICKETS;

export function getAdminRafflePending(
  row: Pick<AdminRegistrationRow, "isFreeRegistration" | "pricingType" | "registrationPriceCents" | "standardPriceCents" | "remainingPriceCents" | "rafflePaidCents" | "adminRafflePaidCents">,
  financial: RegistrationFinancialState,
): { cents: number; tickets: number | null } | null {
  if (row.isFreeRegistration) {
    const paid = (row.rafflePaidCents ?? 0) + (row.adminRafflePaidCents ?? 0);
    const total = EXEMPT_GROUP_RAFFLE_TICKETS * RAFFLE_TICKET_PRICE_CENTS;
    if (!Number.isSafeInteger(paid) || paid < 0) return null;
    const cents = Math.max(0, total - paid);
    return { cents, tickets: cents % RAFFLE_TICKET_PRICE_CENTS === 0 ? cents / RAFFLE_TICKET_PRICE_CENTS : null };
  }
  if (row.pricingType !== "promotional" || financial.status === "legacy" || financial.status === "exempt") return null;
  const baseCents = financial.status === "pending"
    ? row.remainingPriceCents ?? ((row.standardPriceCents ?? 0) - (row.registrationPriceCents ?? 0))
    : financial.pendingCents;
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) return null;
  const paid = (row.rafflePaidCents ?? 0) + (row.adminRafflePaidCents ?? 0);
  if (!Number.isSafeInteger(paid) || paid < 0) return null;
  const cents = Math.max(0, baseCents - paid);
  return { cents, tickets: cents % RAFFLE_TICKET_PRICE_CENTS === 0 ? cents / RAFFLE_TICKET_PRICE_CENTS : null };
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function getAdminRegistrationPendingCents(
  row: Parameters<typeof getAdminRafflePending>[0] & Partial<Pick<AdminRegistrationRow, "manualFeePendingCents">>,
  financial: RegistrationFinancialState,
): number | null {
  // A fee balance left open by an administrator is tracked only here, apart
  // from raffle complements and from the shared registration financial state.
  const feeBalance =
    (financial.status === "paid" || financial.status === "partially_paid") &&
    Number.isSafeInteger(row.manualFeePendingCents) &&
    (row.manualFeePendingCents ?? 0) > 0
      ? (row.manualFeePendingCents as number)
      : 0;
  const raffle = getAdminRafflePending(row, financial);
  if (financial.pendingCents === null) return feeBalance > 0 ? feeBalance : null;
  if (!raffle || row.isFreeRegistration) return financial.pendingCents + feeBalance;
  // The raffle portion of a promotional registration is part of the bundled
  // registration fee, so it is reported separately. It must use the original
  // raffle base (not the admin-paid-adjusted value) so administrative raffle
  // payments never change the registration fee pending.
  const baseRaffleCents =
    financial.status === "pending"
      ? row.remainingPriceCents ?? ((row.standardPriceCents ?? 0) - (row.registrationPriceCents ?? 0))
      : financial.pendingCents;
  const safeBaseRaffleCents = Number.isSafeInteger(baseRaffleCents) && baseRaffleCents > 0 ? baseRaffleCents : 0;
  return Math.max(0, financial.pendingCents - safeBaseRaffleCents) + feeBalance;
}

export function formatAdminRafflePending(pending: { cents: number; tickets: number | null }): string {
  const amount = currency.format(pending.cents / 100);
  return pending.tickets === null ? amount : `${pending.tickets} ${pending.tickets === 1 ? "rifa" : "rifas"} · ${amount}`;
}
