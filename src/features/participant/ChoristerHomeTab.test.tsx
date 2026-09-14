import type { ComponentProps } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoristerHomeTab } from "./ChoristerHomeTab";
import type { ParticipantRegistrationView } from "./participant.domain";

const participant: ParticipantRegistrationView = {
  identity: {
    name: "Maria da Silva",
    cpf: "***.***.***-25" as ParticipantRegistrationView["identity"]["cpf"],
    birthDate: "1990-01-15",
  },
  registration: {
    choirName: "Coral Santa Cecília",
    diocese: "Quixadá",
    voicePart: "soprano",
    pricingType: "promotional",
    regentNames: ["João de Souza"],
  },
  payment: {
    status: "paid",
    financialState: {
      status: "partially_paid",
      pendingCents: 8000,
      confirmedPrincipalCents: 32000,
    },
  },
};

describe("ChoristerHomeTab welcome", () => {
  it("keeps only the outstanding balance and current status in a compact row", () => {
    render(<ChoristerHomeTab participant={participant} />);
    const card = screen.getByRole("region", { name: "Situação da inscrição" });
    expect(within(card).getByText("Valor pendente")).toBeInTheDocument();
    expect(within(card).getByText("R$ 80,00")).toBeInTheDocument();
    expect(within(card).queryByRole("status")).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Pagar" })).toHaveAttribute(
      "href",
      "/participante/pagamento",
    );
    expect(within(card).getByText("R$ 80,00")).toHaveClass("text-red-600");
    expect(within(card).queryByText("Parcialmente pago")).not.toBeInTheDocument();
    expect(within(card).queryByText("Programa de rifas")).not.toBeInTheDocument();
    expect(within(card).queryByText("Pago")).not.toBeInTheDocument();
    expect(within(card).queryByText("Total")).not.toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(card).queryByText("Vaga confirmada após a quitação.")).not.toBeInTheDocument();
  });

  it("keeps identity details in the welcome card", () => {
    render(<ChoristerHomeTab participant={participant} />);
    const welcome = screen.getByRole("region", { name: "Boas-vindas e inscrição" });
    for (const text of ["Maria da Silva", "Coral Santa Cecília"]) {
      expect(within(welcome).getByText(text)).toBeInTheDocument();
    }
    expect(within(welcome).queryByText("João de Souza")).not.toBeInTheDocument();
    expect(within(welcome).queryByText("Soprano")).not.toBeInTheDocument();
    expect(within(welcome).queryByText("Regente")).not.toBeInTheDocument();
    expect(within(welcome).queryByText("Meu naipe")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Crie sua foto do encontro/ })).toHaveAttribute(
      "href",
      "/participante/minha-foto",
    );
  });
  it("shows a settled raffle registration", () => {
    render(
      <ChoristerHomeTab
        participant={{
          ...participant,
          payment: {
            status: "paid",
            financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 40000 },
          },
        }}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "Boas-vindas e inscrição" })).getByRole("status"),
    ).toHaveTextContent("Pago");
    expect(screen.queryByText("Rifas quitadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("does not label standard registrations as raffles", () => {
    render(
      <ChoristerHomeTab
        participant={{
          ...participant,
          registration: { ...participant.registration, pricingType: "standard" },
          payment: {
            status: "paid",
            financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 40000 },
          },
        }}
      />,
    );
    expect(screen.queryByText("Inscrição integral")).not.toBeInTheDocument();
    expect(screen.queryByText("Programa de rifas")).not.toBeInTheDocument();
  });
  it("does not invent missing financial or profile data", () => {
    render(
      <ChoristerHomeTab
        participant={{
          ...participant,
          registration: { choirName: "Coral", diocese: "Quixadá" },
          payment: { status: "paid" },
        }}
      />,
    );
    expect(screen.getByText("Saldo indisponível")).toBeInTheDocument();
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
    expect(screen.queryByText("Pago")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
