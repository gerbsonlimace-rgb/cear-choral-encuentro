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
  raffles: { totalCents: 10_000, paidCents: 2_000, pendingCents: 8_000, totalTickets: 10, paidTickets: 2, pendingTickets: 8 },
};

describe("ChoristerHomeTab welcome", () => {
  it("shows sold raffle progress, outstanding balance, and the payment action on Home", () => {
    render(<ChoristerHomeTab participant={participant} />);
    const raffle = screen.getByRole("region", { name: "Suas rifas" });
    expect(within(raffle).getByText("Meta inicial")).toBeInTheDocument();
    expect(within(raffle).getByText("10 rifas no total")).toBeInTheDocument();
    expect(within(raffle).getByText("2 já pagas")).toBeInTheDocument();
    expect(within(raffle).getByText("8 pendentes")).toBeInTheDocument();
    expect(within(raffle).getByText(/80,00/)).toBeInTheDocument();
    expect(within(raffle).getByRole("link", { name: /Informar rifas vendidas e pagar/ })).toHaveAttribute("href", "/participante/pagamento");
  });

  it("celebrates raffle sales beyond the initial target", () => {
    render(<ChoristerHomeTab participant={{ ...participant, raffles: {
      totalCents: 10_000, paidCents: 12_000, pendingCents: 0,
      totalTickets: 10, paidTickets: 12, pendingTickets: 0, extraTickets: 2,
    } }} />);
    expect(screen.getByText(/2 rifas além da meta/)).toBeInTheDocument();
  });

  it("renders compact shortcut cards on Home", () => {
    render(<ChoristerHomeTab participant={participant} onNavigate={() => undefined} />);

    expect(screen.getByRole("button", { name: "Explorar cantos" })).toHaveClass("min-h-28");
  });

  it("links Home to the event WhatsApp group", () => {
    render(<ChoristerHomeTab participant={participant} />);

    const group = screen.getByRole("link", { name: "Entrar no grupo do encontro no WhatsApp" });
    expect(group).toHaveAttribute(
      "href",
      "https://chat.whatsapp.com/DMasqDLthuP1HmhJzHxqxw",
    );
    expect(group).toHaveAttribute("target", "_blank");
    expect(group).toHaveAttribute("rel", "noopener noreferrer");
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
      "/euvou",
    );
  });
  it("does not show settled payment status on Home", () => {
    render(
      <ChoristerHomeTab
        participant={{
          ...participant,
          payment: {
            status: "paid",
            financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 40000 },
          },
          raffles: { totalCents: 10_000, paidCents: 10_000, pendingCents: 0, totalTickets: 10, paidTickets: 10, pendingTickets: 0 },
        }}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "Boas-vindas e inscrição" })).queryByRole("status"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Rifas quitadas/)).toBeInTheDocument();
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
          raffles: null,
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
          raffles: null,
        }}
      />,
    );
    expect(screen.queryByText("Saldo indisponível")).not.toBeInTheDocument();
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
    expect(screen.queryByText("Pago")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
