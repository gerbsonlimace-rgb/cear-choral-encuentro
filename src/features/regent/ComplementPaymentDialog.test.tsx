import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ComplementPaymentDialog } from "./ComplementPaymentDialog";
import type { PortalParticipant } from "./regent-payments.domain";

const participant: PortalParticipant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Maria Silva",
  cpf: "",
  phone: "",
  whatsappUrl: null,
  photoUrl: null,
  paymentStatus: "paid",
  pricingType: "promotional",
  standardPriceCents: 30000,
  registrationPriceCents: 20000,
  complement: { eligible: true, totalCents: 10000, paidCents: 0, balanceCents: 10000 },
  payments: [],
};

describe("ComplementPaymentDialog", () => {
  it("converts BRL to cents and submits only once", async () => {
    const user = userEvent.setup();
    const checkout = vi.fn(() => new Promise<{ checkoutUrl: string }>(() => undefined));
    render(
      <ComplementPaymentDialog
        participant={participant}
        onClose={vi.fn()}
        startCheckout={checkout}
      />,
    );
    await user.type(screen.getByLabelText("Valor"), "10,50");
    await user.click(screen.getByRole("button", { name: "Pagar complemento" }));
    await user.click(screen.getByRole("button", { name: "Pagar complemento" }));
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith({ registrationId: participant.id, amountCents: 1050 });
  });

  it("blocks an amount over the balance", async () => {
    const user = userEvent.setup();
    const checkout = vi.fn();
    render(
      <ComplementPaymentDialog
        participant={participant}
        onClose={vi.fn()}
        startCheckout={checkout}
      />,
    );
    await user.type(screen.getByLabelText("Valor"), "100,01");
    await user.click(screen.getByRole("button", { name: "Pagar complemento" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valor máximo");
    expect(checkout).not.toHaveBeenCalled();
  });
});
