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
    initialAmountCents: 10_000,
    pricingType: "promotional",
    standardPriceCents: 30_000,
    registrationPriceCents: 10_000,
    financialState: {
      status: "partially_paid",
      pendingCents: 15_000,
      confirmedPrincipalCents: 15_000,
    },
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
    initialAmountCents: 10_000,
    pricingType: "promotional",
    standardPriceCents: 30_000,
    registrationPriceCents: 10_000,
    financialState: {
      status: "pending",
      pendingCents: 10_000,
      confirmedPrincipalCents: 0,
    },
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
    initialAmountCents: 10_000,
    pricingType: "promotional",
    standardPriceCents: 30_000,
    registrationPriceCents: 10_000,
    financialState: {
      status: "partially_paid",
      pendingCents: 15_000,
      confirmedPrincipalCents: 15_000,
    },
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
    initialAmountCents: null,
    pricingType: null,
    standardPriceCents: null,
    registrationPriceCents: null,
    financialState: {
      status: "legacy",
      pendingCents: null,
      confirmedPrincipalCents: null,
    },
    complement: { eligible: false, reason: "missing_snapshot" },
    payments: [],
  },
];

describe("RegentParticipantList", () => {
  it("uses derived financial labels, pending values, and balance actions", () => {
    const financialParticipants = [
      {
        ...participants[0],
        name: "Ana Parcial",
        initialAmountCents: 10_000,
        financialState: {
          status: "partially_paid" as const,
          pendingCents: 12_000,
          confirmedPrincipalCents: 18_000,
        },
        complement: {
          eligible: true as const,
          totalCents: 20_000,
          paidCents: 8_000,
          balanceCents: 12_000,
        },
      },
      {
        ...participants[1],
        name: "Bruno Inicial",
        initialAmountCents: 10_000,
        financialState: {
          status: "pending" as const,
          pendingCents: 10_000,
          confirmedPrincipalCents: 0,
        },
      },
      {
        ...participants[0],
        id: "55555555-5555-4555-8555-555555555555",
        name: "Clara Quitada",
        initialAmountCents: 10_000,
        financialState: {
          status: "paid" as const,
          pendingCents: 0,
          confirmedPrincipalCents: 30_000,
        },
        complement: { eligible: false as const, reason: "settled" as const },
      },
      {
        ...participants[0],
        id: "66666666-6666-4666-8666-666666666666",
        name: "Davi Integral",
        pricingType: "standard" as const,
        initialAmountCents: 30_000,
        standardPriceCents: 30_000,
        registrationPriceCents: 30_000,
        financialState: {
          status: "paid" as const,
          pendingCents: 0,
          confirmedPrincipalCents: 30_000,
        },
        complement: { eligible: false as const, reason: "standard_price" as const },
      },
      {
        ...participants[3],
        initialAmountCents: null,
        financialState: {
          status: "legacy" as const,
          pendingCents: null,
          confirmedPrincipalCents: null,
        },
      },
    ] as PortalParticipant[];

    render(<RegentParticipantList participants={financialParticipants} onPay={vi.fn()} />);

    const table = screen.getByRole("table", { name: "Participantes" });
    expect(within(table).getByText("Parcialmente pago")).toBeInTheDocument();
    expect(within(table).getAllByText("Valor pendente")).not.toHaveLength(0);
    expect(within(table).getAllByText(/R\$\s*120,00/)).not.toHaveLength(0);
    expect(
      within(table).getByRole("button", { name: /Pagar saldo de R\$\s*120,00/ }),
    ).toBeEnabled();

    const initialRow = within(table).getByRole("row", { name: /Bruno Inicial/ });
    expect(initialRow).toHaveTextContent("Pendente");
    expect(initialRow).toHaveTextContent(/R\$\s*100,00/);
    expect(
      within(initialRow).queryByRole("button", { name: /Pagar saldo/ }),
    ).not.toBeInTheDocument();

    for (const name of ["Clara Quitada", "Davi Integral"]) {
      const row = within(table).getByRole("row", { name: new RegExp(name) });
      expect(row).toHaveTextContent("Pago");
      expect(row).toHaveTextContent(/R\$\s*0,00/);
    }
    const historicalRow = within(table).getByRole("row", { name: /Davi Histórico/ });
    expect(historicalRow).toHaveTextContent("Histórico");
    expect(historicalRow).toHaveTextContent("Não disponível");
  });

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
      expect(scope.getAllByText("Parcialmente pago").length).toBeGreaterThan(0);
      expect(scope.getByText("Pendente")).toBeInTheDocument();
      expect(scope.getByRole("link", { name: "Continuar pagamento" })).toHaveAttribute(
        "href",
        pendingInstallment.checkoutUrl,
      );
      expect(scope.getByRole("button", { name: /Pagar saldo de R\$\s*150,00/ })).toBeEnabled();
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

    await user.click(within(row).getByRole("button", { name: /Pagar saldo de R\$\s*150,00/ }));
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
