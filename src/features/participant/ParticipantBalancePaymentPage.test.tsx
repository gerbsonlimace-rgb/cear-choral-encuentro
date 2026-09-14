import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));
vi.mock("@/lib/participant.functions", () => ({ getParticipantRegistration: vi.fn() }));
vi.mock("@/lib/participant-payment.functions", () => ({
  startParticipantBalanceCheckout: vi.fn(),
}));
import { ParticipantBalancePaymentPage } from "./ParticipantBalancePaymentPage";
import type { ParticipantRegistrationView } from "./participant.domain";
const view = {
  identity: { name: "Maria" },
  registration: { choirName: "Coral" },
  payment: {
    status: "paid",
    financialState: {
      status: "partially_paid",
      pendingCents: 8000,
      confirmedPrincipalCents: 32000,
    },
  },
} as ParticipantRegistrationView;

describe("ParticipantBalancePaymentPage", () => {
  it("shows the confirmed balance and opens the same provider checkout once", async () => {
    const load = vi.fn().mockResolvedValue(view);
    let finish!: (value: { ok: true; checkoutUrl: string; orderNsu: string }) => void;
    const start = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const open = vi.fn();
    render(
      <ParticipantBalancePaymentPage
        loadRegistration={load}
        startCheckout={start}
        openCheckout={open}
      />,
    );
    const pay = await screen.findByRole("button", { name: "Pagar saldo restante" });
    expect(screen.getByText(/80,00/)).toBeInTheDocument();
    expect(screen.getByText(/320,00/)).toBeInTheDocument();
    expect(screen.getByText(/Pix ou cartão/)).toBeInTheDocument();
    fireEvent.click(pay);
    fireEvent.click(pay);
    expect(start).toHaveBeenCalledTimes(1);
    finish({ ok: true, checkoutUrl: "https://checkout.infinitepay.com.br/pay", orderNsu: "order" });
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith("https://checkout.infinitepay.com.br/pay"),
    );
  });
  it.each([null, { status: "paid", pendingCents: 0, confirmedPrincipalCents: 40000 }])(
    "does not offer a charge for unavailable or settled balances",
    async (financialState) => {
      render(
        <ParticipantBalancePaymentPage
          loadRegistration={vi
            .fn()
            .mockResolvedValue({ ...view, payment: { ...view.payment, financialState } })}
        />,
      );
      await screen.findByText(financialState ? "Inscrição quitada" : "Saldo indisponível");
      expect(
        screen.queryByRole("button", { name: "Pagar saldo restante" }),
      ).not.toBeInTheDocument();
    },
  );
  it("shows a recoverable checkout error without navigating", async () => {
    const open = vi.fn();
    render(
      <ParticipantBalancePaymentPage
        loadRegistration={vi.fn().mockResolvedValue(view)}
        startCheckout={vi.fn().mockResolvedValue({
          ok: false,
          code: "open_payment",
          message: "Já existe um pagamento em aberto.",
        })}
        openCheckout={open}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Pagar saldo restante" }));
    expect(await screen.findByRole("status")).toHaveTextContent("pagamento em andamento");
    expect(screen.queryByRole("button", { name: "Pagar saldo restante" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });
});
