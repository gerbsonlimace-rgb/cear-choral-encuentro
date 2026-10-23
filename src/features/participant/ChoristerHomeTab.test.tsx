import type { ComponentProps } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    raffleOnlinePaymentEnabled: true,
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
    expect(within(raffle).getByRole("link", { name: "Pagar agora via Pix ou cartão de crédito" })).toHaveAttribute("href", "/participante/pagamento");
  });

  it("hides the balance card but keeps the sharing card visible when online payment is disabled", () => {
    render(<ChoristerHomeTab participant={{ ...participant, registration: { ...participant.registration, raffleOnlinePaymentEnabled: false } }} />);
    expect(screen.queryByRole("region", { name: "Suas rifas" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Sua chave Pix" })).toBeInTheDocument();
  });

  it("celebrates raffle sales beyond the initial target", () => {
    render(<ChoristerHomeTab participant={{ ...participant, raffles: {
      totalCents: 10_000, paidCents: 12_000, pendingCents: 0,
      totalTickets: 10, paidTickets: 12, pendingTickets: 0, extraTickets: 2,
    } }} />);
    expect(screen.getByText(/2 rifas além da meta/)).toBeInTheDocument();
  });

  it("shows the raffle card with its Pix field and generation action", () => {
    render(<ChoristerHomeTab participant={participant} />);
    const sharing = screen.getByRole("region", { name: "Compartilhe a rifa" });
    expect(within(sharing).getByLabelText("Prévia da rifa do Coral Santa Cecília")).toBeInTheDocument();
    expect(within(sharing).queryByText(/Coro Santa Cecília/i)).not.toBeInTheDocument();
    expect(within(sharing).queryByText(/chave Pix da prévia/i)).not.toBeInTheDocument();
    expect(within(sharing).getByRole("textbox", { name: "Sua chave Pix" })).toBeInTheDocument();
    expect(within(sharing).getByRole("button", { name: "Gerar card" })).toBeDisabled();
    expect(within(sharing).queryByRole("link", { name: "Mensagem no WhatsApp" })).not.toBeInTheDocument();
  });

  it("generates a raffle card from the Pix key on Home", async () => {
    const user = userEvent.setup();
    const renderArt = vi.fn().mockResolvedValue(new File(["image"], "rifa.png", { type: "image/png" }));
    render(<ChoristerHomeTab participant={participant} renderRaffleArt={renderArt} />);
    const sharing = screen.getByRole("region", { name: "Compartilhe a rifa" });

    await user.type(within(sharing).getByRole("textbox", { name: "Sua chave Pix" }), "pix@exemplo.com");
    await user.click(within(sharing).getByRole("button", { name: "Gerar card" }));

    await waitFor(() => expect(renderArt).toHaveBeenCalledWith({
      choirName: "Coral Santa Cecília",
      displayName: "Maria da Silva",
      pixKey: "pix@exemplo.com",
      city: "Quixadá",
    }));
    expect(within(sharing).getByRole("img", { name: "Seu card da rifa com QR Code Pix" })).toBeInTheDocument();
    expect(within(sharing).getByRole("link", { name: "Baixar imagem" })).toBeInTheDocument();
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
    expect(screen.queryByRole("region", { name: "Compartilhe a rifa" })).not.toBeInTheDocument();
  });
  it("does not offer raffle sharing without an assigned raffle target", () => {
    render(<ChoristerHomeTab participant={{ ...participant, raffles: {
      totalCents: 0, paidCents: 0, pendingCents: 0, totalTickets: 0, paidTickets: 0, pendingTickets: 0,
    } }} />);
    expect(screen.queryByRole("region", { name: "Compartilhe a rifa" })).not.toBeInTheDocument();
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
