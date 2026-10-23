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
  registration: { choirName: "Coral", raffleOnlinePaymentEnabled: true },
  payment: {
    status: "paid",
    financialState: {
      status: "partially_paid",
      pendingCents: 8000,
      confirmedPrincipalCents: 32000,
    },
  },
  raffles: { totalCents: 10_000, paidCents: 2_000, pendingCents: 8_000, totalTickets: 10, paidTickets: 2, pendingTickets: 8 },
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
    const pay = await screen.findByRole("button", { name: "Pagar 1 rifa" });
    expect(screen.getAllByText(/80,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("10 rifas")).toBeInTheDocument();
    expect(screen.getByText(/Pix ou cartão/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantas rifas você vendeu?" }), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: "Pagar 3 rifas" })).toBeInTheDocument();
    fireEvent.click(pay);
    fireEvent.click(pay);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(3);
    finish({ ok: true, checkoutUrl: "https://checkout.infinitepay.com.br/pay", orderNsu: "order" });
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith("https://checkout.infinitepay.com.br/pay"),
    );
  });
  it("does not offer a charge when the raffle balance cannot be verified", async () => {
    render(<ParticipantBalancePaymentPage loadRegistration={vi.fn().mockResolvedValue({ ...view, raffles: null })} />);
    await screen.findByText("Saldo indisponível");
    expect(screen.queryByRole("button", { name: /Pagar .* rifas/ })).not.toBeInTheDocument();
  });
  it("shows the balance without payment controls for a choir with online payments disabled", async () => {
    const start = vi.fn();
    render(<ParticipantBalancePaymentPage
      loadRegistration={vi.fn().mockResolvedValue({ ...view, registration: { ...view.registration, raffleOnlinePaymentEnabled: false } })}
      startCheckout={start}
    />);
    expect(await screen.findByText(/pagamento online das rifas ainda não está disponível/)).toBeInTheDocument();
    expect(screen.getAllByText(/80,00/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });
  it("lets a participant register extra raffles after reaching the original target", async () => {
    const start = vi.fn().mockResolvedValue({ ok: true, checkoutUrl: "https://checkout.infinitepay.com.br/extra", orderNsu: "extra" });
    render(<ParticipantBalancePaymentPage
      loadRegistration={vi.fn().mockResolvedValue({ ...view, raffles: { ...view.raffles!, paidCents: 10_000, pendingCents: 0, paidTickets: 10, pendingTickets: 0 } })}
      startCheckout={start}
      openCheckout={vi.fn()}
    />);
    expect(await screen.findByText("Rifas quitadas")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantas rifas você vendeu?" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Pagar 5 rifas" }));
    await waitFor(() => expect(start).toHaveBeenCalledWith(5));
  });
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
    fireEvent.click(await screen.findByRole("button", { name: "Pagar 1 rifa" }));
    expect(await screen.findByRole("status")).toHaveTextContent("pagamento em andamento");
    expect(screen.queryByRole("button", { name: /Pagar .* rifas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });
  it("offers to continue a different quantity already awaiting payment", async () => {
    const open = vi.fn();
    render(<ParticipantBalancePaymentPage
      loadRegistration={vi.fn().mockResolvedValue(view)}
      startCheckout={vi.fn().mockResolvedValue({ ok: true, checkoutUrl: "https://checkout.infinitepay.com.br/three", orderNsu: "open", existingRaffleTickets: 3 })}
      openCheckout={open}
    />);
    fireEvent.click(await screen.findByRole("button", { name: "Pagar 1 rifa" }));
    expect(await screen.findByText(/pagamento de 3 rifas em andamento/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar pagamento" }));
    expect(open).toHaveBeenCalledWith("https://checkout.infinitepay.com.br/three");
  });
});
