export const RAFFLE_TICKET_PRICE_CENTS = 1_000;
export const FREE_GROUP_RAFFLE_TICKETS = 20;

export type RaffleBalance = {
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  totalTickets: number | null;
  paidTickets: number | null;
  pendingTickets: number | null;
  extraTickets?: number | null;
};

type Input = {
  isFreeRegistration: boolean;
  paymentStatus: string;
  pricingType: string | null;
  remainingPriceCents: number | null;
  confirmedRaffleCents: number;
};

function ticketCount(cents: number): number | null {
  return cents % RAFFLE_TICKET_PRICE_CENTS === 0
    ? cents / RAFFLE_TICKET_PRICE_CENTS
    : null;
}

export function deriveRaffleBalance(input: Input): RaffleBalance | null {
  if (input.paymentStatus !== "paid") return null;
  const totalCents = input.isFreeRegistration
    ? FREE_GROUP_RAFFLE_TICKETS * RAFFLE_TICKET_PRICE_CENTS
    : input.pricingType === "promotional"
      ? input.remainingPriceCents
      : null;
  if (
    totalCents === null ||
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0 ||
    !Number.isSafeInteger(input.confirmedRaffleCents) ||
    input.confirmedRaffleCents < 0
  ) return null;

  const pendingCents = Math.max(0, totalCents - input.confirmedRaffleCents);
  const extraCents = Math.max(0, input.confirmedRaffleCents - totalCents);
  return {
    totalCents,
    paidCents: input.confirmedRaffleCents,
    pendingCents,
    totalTickets: ticketCount(totalCents),
    paidTickets: ticketCount(input.confirmedRaffleCents),
    pendingTickets: ticketCount(pendingCents),
    ...(extraCents > 0 ? { extraTickets: ticketCount(extraCents) } : {}),
  };
}
