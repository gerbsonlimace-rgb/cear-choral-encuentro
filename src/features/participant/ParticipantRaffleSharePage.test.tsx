import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

import { ParticipantRaffleSharePage } from "./ParticipantRaffleSharePage";
import type { ParticipantRegistrationView } from "./participant.domain";

const participant = {
  identity: { name: "Maria Silva de Souza", cpf: "***.***.***-25", birthDate: "1990-01-15" },
  registration: { choirName: "Coro Santa Cecília", diocese: "Quixadá" },
  payment: { status: "paid" },
  raffles: { totalCents: 20_000, paidCents: 0, pendingCents: 20_000, totalTickets: 20, paidTickets: 0, pendingTickets: 20 },
} as ParticipantRegistrationView;

describe("ParticipantRaffleSharePage", () => {
  it("does not show Pix or card generation to a participant without assigned raffles", async () => {
    render(<ParticipantRaffleSharePage loadRegistration={async () => ({ ...participant, raffles: null })} />);
    expect(await screen.findByText(/disponível apenas para participantes com rifas para vender/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Chave Pix")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar imagem|Baixar imagem/ })).not.toBeInTheDocument();
  });

  it("uses the participant's full name and only asks for the Pix key", async () => {
    const renderArt = vi.fn().mockResolvedValue(new File(["image"], "rifa.png", { type: "image/png" }));
    render(<ParticipantRaffleSharePage loadRegistration={async () => participant} renderArt={renderArt} />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Coro Santa Cecília/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar imagem/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Baixar imagem/ })).toBeDisabled();

    expect(screen.queryByLabelText("Nome para exibição")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Chave Pix"), "pix@exemplo.com");
    await user.click(screen.getByRole("button", { name: /Gerar imagem/ }));

    await waitFor(() => expect(renderArt).toHaveBeenCalledWith({
      choirName: "Coro Santa Cecília",
      displayName: "Maria Silva de Souza",
      pixKey: "pix@exemplo.com",
      city: "Quixadá",
    }));
    expect(await screen.findByRole("img", { name: /Arte da rifa beneficente/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar imagem/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Chave Pix"), ".br");
    expect(screen.queryByRole("img", { name: /Arte da rifa beneficente/ })).not.toBeInTheDocument();
  });
});
