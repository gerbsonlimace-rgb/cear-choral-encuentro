import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PortalParticipant } from "./regent-payments.domain";
import { RegentParticipantList } from "./RegentParticipantList";

const paidInstallment = {
  id: "payment-paid",
  amountCents: 5_000,
  status: "paid" as const,
  checkoutUrl: null,
  createdAt: "2026-09-10T14:00:00.000Z",
  paidAt: "2026-09-10T14:05:00.000Z",
  initiatedByName: "Regente Ana",
  initiatedAs: "regent" as const,
};

const pendingInstallment = {
  id: "payment-pending",
  amountCents: 4_000,
  status: "pending" as const,
  checkoutUrl: "https://checkout.infinitepay.com.br/complemento-seguro",
  createdAt: "2026-09-11T12:00:00.000Z",
  paidAt: null,
  initiatedByName: "Admin José",
  initiatedAs: "admin" as const,
};

const participants: PortalParticipant[] = [
  {
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
    payments: [paidInstallment],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Bruno Pendente",
    cpf: "98765432100",
    phone: "85999990000",
    whatsappUrl: "https://wa.me/5585999990000",
    photoUrl: "https://example.com/bruno.jpg",
    paymentStatus: "pending",
    pricingType: "promotional",
    standardPriceCents: 30_000,
    registrationPriceCents: 10_000,
    complement: { eligible: false, reason: "awaiting_participant_payment" },
    payments: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Clara Continuidade",
    cpf: "11122233344",
    phone: "88988887777",
    whatsappUrl: "https://wa.me/5588988887777",
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
      openPayment: pendingInstallment,
    },
    payments: [pendingInstallment, paidInstallment],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Davi Histórico",
    cpf: "",
    phone: "88977776666",
    whatsappUrl: "https://wa.me/5588977776666",
    photoUrl: null,
    paymentStatus: "legacy",
    pricingType: null,
    standardPriceCents: null,
    registrationPriceCents: null,
    complement: { eligible: false, reason: "missing_snapshot" },
    payments: [],
  },
];

describe("RegentParticipantList", () => {
  it("shows compact desktop and mobile records with formatted identity and payment actions", () => {
    render(<RegentParticipantList participants={participants} onPay={vi.fn()} />);

    const table = screen.getByRole("table", { name: "Participantes" });
    const cards = screen.getByRole("region", { name: "Cartões de participantes" });
    expect(table.closest(".hidden")).toHaveClass("hidden", "md:block");
    expect(cards).toHaveClass("md:hidden");

    for (const view of [table, cards]) {
      const scope = within(view);
      expect(scope.getByText("123.456.789-01")).toBeInTheDocument();
      expect(scope.getByRole("link", { name: /WhatsApp de Ana Regente/i })).toHaveAttribute(
        "href",
        "https://wa.me/5588999991234",
      );
      expect(scope.getByRole("link", { name: /WhatsApp de Ana Regente/i })).toHaveTextContent(
        "(88) 99999-1234",
      );
      expect(
        scope.getByRole("img", { name: "Foto não disponível para Ana Regente" }),
      ).toHaveTextContent("AR");
      expect(scope.getByRole("img", { name: "Foto de Bruno Pendente" })).toHaveAttribute(
        "src",
        "https://example.com/bruno.jpg",
      );
      expect(scope.getAllByText("Pago").length).toBeGreaterThan(0);
      expect(scope.getByText("Pendente")).toBeInTheDocument();
      expect(scope.getByText("Aguardando pagamento do participante")).toBeInTheDocument();
      expect(scope.getByRole("link", { name: "Continuar pagamento" })).toHaveAttribute(
        "href",
        pendingInstallment.checkoutUrl,
      );
      expect(scope.getByRole("button", { name: "Pagar complemento de Ana Regente" })).toBeEnabled();
      expect(scope.getAllByText("Valor normal: R$ 300,00")).toHaveLength(3);
      expect(scope.getAllByText("Valor da inscrição: R$ 100,00")).toHaveLength(3);
      expect(scope.getByText("Valor normal: Não disponível")).toBeInTheDocument();
      expect(scope.getByText("Valor da inscrição: Não disponível")).toBeInTheDocument();
    }
  });

  it("opens the installment history and delegates a new eligible payment", async () => {
    const onPay = vi.fn();
    const user = userEvent.setup();
    render(<RegentParticipantList participants={participants} onPay={onPay} />);

    const row = within(screen.getByRole("table", { name: "Participantes" })).getByRole("row", {
      name: /Ana Regente/,
    });
    const history = within(row).getByRole("button", { name: "Ver histórico de Ana Regente" });
    expect(history).toHaveAttribute("aria-expanded", "false");
    await user.click(history);
    expect(history).toHaveAttribute("aria-expanded", "true");
    expect(within(row).getByText("R$ 50,00")).toBeInTheDocument();
    expect(row).toHaveTextContent("Regente Ana · 10/09/2026");

    await user.click(within(row).getByRole("button", { name: "Pagar complemento de Ana Regente" }));
    expect(onPay).toHaveBeenCalledExactlyOnceWith(participants[0]);
  });

  it("replaces a participant photo that fails to load with accessible initials", () => {
    render(<RegentParticipantList participants={participants} onPay={vi.fn()} />);
    const table = screen.getByRole("table", { name: "Participantes" });
    const photo = within(table).getByRole("img", { name: "Foto de Bruno Pendente" });

    fireEvent.error(photo);

    expect(
      within(table).getByRole("img", { name: "Foto não disponível para Bruno Pendente" }),
    ).toHaveTextContent("BP");
  });
});
