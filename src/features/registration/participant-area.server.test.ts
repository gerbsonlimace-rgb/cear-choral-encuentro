import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { toParticipantView } from "./participant-area.server";

const baseRow = {
  name: "Maria",
  email: "maria@example.com",
  cpf: "52998224725",
  birth_date: "1990-05-12",
  choir_name: "Coro",
  payment_status: "pending",
  payment_method: null,
  installments: null,
  amount_cents: 10000,
  paid_amount_cents: null,
  paid_at: null,
  order_nsu: "order-1",
  receipt_url: null,
  checkout_url: "https://checkout.infinitepay.io/pay",
};

describe("participant area checkout URL boundary", () => {
  it("returns a pending checkout only for an allowed InfinitePay HTTPS URL", () => {
    expect(toParticipantView(baseRow).checkoutUrl).toBe(baseRow.checkout_url);
  });

  it.each([
    "https://evil.example/checkout",
    "https://pending.invalid/creating/order-1/9999999999999",
    "https://pending.invalid/creating/order-1/0",
  ])("does not expose an external, fresh-claim, or stale-claim URL: %s", (checkoutUrl) => {
    expect(
      toParticipantView({ ...baseRow, checkout_url: checkoutUrl }).checkoutUrl,
    ).toBeUndefined();
  });
});
