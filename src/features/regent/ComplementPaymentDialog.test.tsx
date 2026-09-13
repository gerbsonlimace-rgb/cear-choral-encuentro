import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PortalParticipant } from "./regent-payments.domain";
import { ComplementPaymentDialog } from "./ComplementPaymentDialog";

const participant: PortalParticipant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ana Regente",
  cpf: "12345678901",
  phone: "(88) 99999-1234",
  whatsappUrl: "https://wa.me/5588999991234",
  photoUrl: null,
  paymentStatus: "paid",
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  complement: {
    eligible: true,
    totalCents: 20_000,
    paidCents: 5_000,
    balanceCents: 15_000,
  },
  payments: [],
};

function setup(overrides: Partial<React.ComponentProps<typeof ComplementPaymentDialog>> = {}) {
  const props: React.ComponentProps<typeof ComplementPaymentDialog> = {
    participant,
    open: true,
    onOpenChange: vi.fn(),
    startCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.com.br/complemento",
      orderNsu: "order-1",
    }),
    navigateToCheckout: vi.fn(),
    ...overrides,
  };
  return { user: userEvent.setup(), props, ...render(<ComplementPaymentDialog {...props} />) };
}

describe("ComplementPaymentDialog", () => {
  it("shows the full pending balance without an editable amount", () => {
    setup();

    expect(
      screen.getByText(/pagará o saldo pendente integral de R\$\s*150,00/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Valor do complemento")).not.toBeInTheDocument();
  });

  it("starts checkout with only the registration ID and navigates only to the returned safe checkout", async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole("button", { name: "Pagar complemento" }));

    await waitFor(() =>
      expect(props.startCheckout).toHaveBeenCalledExactlyOnceWith({
        data: { registrationId: participant.id },
      }),
    );
    expect(props.navigateToCheckout).toHaveBeenCalledExactlyOnceWith(
      "https://checkout.infinitepay.com.br/complemento",
    );
  });

  it("prevents a second submit while the first checkout request is pending", async () => {
    let resolve!: (value: { checkoutUrl: string; orderNsu: string }) => void;
    const startCheckout = vi.fn(
      () =>
        new Promise<{ checkoutUrl: string; orderNsu: string }>((done) => {
          resolve = done;
        }),
    );
    const { user } = setup({ startCheckout });
    const submit = screen.getByRole("button", { name: "Pagar complemento" });
    await user.dblClick(submit);

    expect(startCheckout).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Abrindo pagamento…" })).toBeDisabled();
    await act(async () =>
      resolve({
        checkoutUrl: "https://checkout.infinitepay.com.br/complemento",
        orderNsu: "order-1",
      }),
    );
  });

  it("rejects an unsafe checkout URL without navigating", async () => {
    const navigateToCheckout = vi.fn();
    const { user } = setup({
      navigateToCheckout,
      startCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: "https://example.com/phishing",
        orderNsu: "order-1",
      }),
    });
    await user.click(screen.getByRole("button", { name: "Pagar complemento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir o pagamento. Tente novamente.",
    );
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });

  it("disables checkout for an ineligible participant without calling the server", () => {
    const ineligibleParticipant: PortalParticipant = {
      ...participant,
      complement: { eligible: false, reason: "settled" },
    };
    const { props } = setup({ participant: ineligibleParticipant });

    expect(screen.getByText("Selecione um participante elegível.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar complemento" })).toBeDisabled();
    expect(props.startCheckout).not.toHaveBeenCalled();
  });
});
