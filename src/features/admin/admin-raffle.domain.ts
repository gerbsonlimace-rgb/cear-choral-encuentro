import type { AdminRegistrationRow } from "./admin.domain";
import type { RegistrationFinancialState } from "@/features/registration/registration-financial-state.domain";

export const RAFFLE_TICKET_PRICE_CENTS = 1_000;
export const EXEMPT_GROUP_RAFFLE_TICKETS = 20;

export function getAdminRafflePending(
  row: Pick<AdminRegistrationRow, "isFreeRegistration" | "pricingType" | "registrationPriceCents" | "standardPriceCents" | "remainingPriceCents">,
  financial: RegistrationFinancialState,
): { cents: number; tickets: number | null } | null {
  if (row.isFreeRegistration) {
    return { cents: EXEMPT_GROUP_RAFFLE_TICKETS * RAFFLE_TICKET_PRICE_CENTS, tickets: EXEMPT_GROUP_RAFFLE_TICKETS };
  }
  if (row.pricingType !== "promotional" || financial.status === "legacy" || financial.status === "exempt") return null;
  const cents = financial.status === "pending"
    ? row.remainingPriceCents ?? ((row.standardPriceCents ?? 0) - (row.registrationPriceCents ?? 0))
    : financial.pendingCents;
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return { cents, tickets: cents % RAFFLE_TICKET_PRICE_CENTS === 0 ? cents / RAFFLE_TICKET_PRICE_CENTS : null };
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatAdminRafflePending(pending: { cents: number; tickets: number | null }): string {
  const amount = currency.format(pending.cents / 100);
  return pending.tickets === null ? amount : `${pending.tickets} ${pending.tickets === 1 ? "rifa" : "rifas"} · ${amount}`;
}