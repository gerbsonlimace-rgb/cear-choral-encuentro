import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalParticipant } from "./regent-payments.domain";
import { RegentParticipantList } from "./RegentParticipantList";

const base: PortalParticipant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ana Costa", cpf: "12345678901", phone: "(88) 99999-1234",
  whatsappUrl: "https://wa.me/5588999991234", photoUrl: null,
  paymentStatus: "paid", initialAmountCents: 30_000, pricingType: "standard",
  standardPriceCents: 30_000, registrationPriceCents: 30_000,
  financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 },
  complement: { eligible: false, reason: "standard_price" }, payments: [],
  registrationPendingCents: 0, rafflePendingCents: 0,
};

describe("RegentParticipantList", () => {
  it("shows compact photo cards with separate registration and raffle balances", () => {
    render(<RegentParticipantList onPay={vi.fn()} participants={[
      base,
      { ...base, id: "bruno", name: "Bruno Lima", rafflePendingCents: 20_000, photoUrl: "https://example.com/bruno.jpg" },
      { ...base, id: "clara", name: "Clara Santos", financialState: { status: "pending", pendingCents: 10_000, confirmedPrincipalCents: 0 }, registrationPendingCents: 10_000 },
    ]} />);
    const cards = screen.getByRole("region", { name: "Cartões de participantes" });
    expect(cards).toHaveClass("grid-cols-1", "min-[370px]:grid-cols-2", "xl:grid-cols-4");
    expect(within(cards).getByText("Pagamento integral")).toBeInTheDocument();
    expect(within(cards).getByText("Aguardando rifas")).toBeInTheDocument();
    expect(within(cards).getAllByText("Inscrição pendente").length).toBeGreaterThan(0);
    expect(within(cards).getByText(/R\$\s*200,00/)).toBeInTheDocument();
    expect(within(cards).getByRole("img", { name: "Foto de Bruno Lima" })).toHaveAttribute("src", "https://example.com/bruno.jpg");
  });

  it("keeps contact, history and payment action inside each card", async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    const partial: PortalParticipant = {
      ...base, registrationPendingCents: 0, rafflePendingCents: 15_000,
      financialState: { status: "partially_paid", pendingCents: 15_000, confirmedPrincipalCents: 15_000 },
      complement: { eligible: true, totalCents: 20_000, paidCents: 5_000, balanceCents: 15_000 },
      payments: [{ id: "payment-1", amountCents: 5_000, status: "paid", checkoutUrl: null, createdAt: "2026-09-10T14:00:00Z", paidAt: "2026-09-10T14:05:00Z", initiatedByName: "Regente", initiatedAs: "regent" }],
    };
    render(<RegentParticipantList participants={[partial]} onPay={onPay} />);
    await user.click(screen.getByText("Contato e detalhes"));
    expect(screen.getByText("123.456.789-01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp de Ana Costa/ })).toHaveAttribute("href", base.whatsappUrl);
    await user.click(screen.getByRole("button", { name: "Ver histórico de Ana Costa" }));
    expect(screen.getByText(/Regente · 10\/09\/2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Pagar saldo de R\$\s*150,00/ }));
    expect(onPay).toHaveBeenCalledWith(partial);
  });

  it("uses initials when a signed participant photo fails", () => {
    render(<RegentParticipantList participants={[{ ...base, photoUrl: "https://example.com/broken.jpg" }]} onPay={vi.fn()} />);
    fireEvent.error(screen.getByRole("img", { name: "Foto de Ana Costa" }));
    expect(screen.getByRole("img", { name: "Foto não disponível para Ana Costa" })).toHaveTextContent("AC");
  });
});
