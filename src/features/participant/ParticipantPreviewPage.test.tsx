import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ParticipantPreviewPage } from "./ParticipantPreviewPage";

describe("ParticipantPreviewPage", () => {
  it("shows only fictitious participant information after admin authorization", async () => {
    const onReturnAdmin = vi.fn();
    const user = userEvent.setup();
    render(
      <ParticipantPreviewPage
        checkAccess={vi.fn().mockResolvedValue({ status: "authorized", userId: "admin-1", email: null })}
        onUnauthorized={vi.fn()}
        onReturnAdmin={onReturnAdmin}
      />,
    );

    expect(await screen.findByText("Prévia do participante.")).toBeInTheDocument();
    expect(screen.getByText(/dados fictícios/i)).toBeInTheDocument();
    expect(screen.getByText("Participante Exemplo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /pagar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar à administração" }));
    expect(onReturnAdmin).toHaveBeenCalledOnce();
  });

  it("does not display the preview to a user without admin access", async () => {
    const onUnauthorized = vi.fn();
    render(
      <ParticipantPreviewPage
        checkAccess={vi.fn().mockResolvedValue({ status: "forbidden" })}
        onUnauthorized={onUnauthorized}
        onReturnAdmin={vi.fn()}
      />,
    );

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByText("Participante Exemplo")).not.toBeInTheDocument();
  });

  it("previews partial raffle payments and sales beyond the initial target without charging", async () => {
    const user = userEvent.setup();
    render(
      <ParticipantPreviewPage
        checkAccess={vi.fn().mockResolvedValue({ status: "authorized", userId: "admin-1", email: null })}
        onUnauthorized={vi.fn()}
        onReturnAdmin={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Rifas" }));
    expect(screen.getByText("20 rifas")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    await user.clear(screen.getByRole("spinbutton", { name: "Quantas rifas você vendeu?" }));
    await user.type(screen.getByRole("spinbutton", { name: "Quantas rifas você vendeu?" }), "23");
    expect(screen.getByText("R$ 230,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagamento indisponível na prévia/ })).toBeDisabled();
  });
});
