import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";

import { AdminCoroAppIntegrationPage } from "./AdminCoroAppIntegrationPage";

const source: CoroAppEventSource = {
  eventId: "22222222-2222-4222-8222-222222222222",
  publicUrl: "https://coroapp.lovable.app/e/22222222-2222-4222-8222-222222222222",
  eventName: "Missa de abertura",
  sortOrder: 0,
  updatedAt: "2026-09-12T20:00:00.000Z",
};

const authorizedAdmin = async () => ({
  status: "authorized" as const,
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
});
const activeSession = async () => ({ data: { session: {} }, error: null });

describe("CoroApp event integration admin page", () => {
  it("shows the official events and saves URLs in their displayed order", async () => {
    const loadSources = vi.fn(async () => [source]);
    const saveSources = vi.fn(async () => [source]);
    render(
      <AdminCoroAppIntegrationPage
        checkAdmin={authorizedAdmin}
        getSession={activeSession}
        loadSources={loadSources}
        saveSources={saveSources}
      />,
    );

    expect(await screen.findByText("Missa de abertura")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const textarea = screen.getByLabelText("URLs públicas dos eventos");
    fireEvent.change(textarea, {
      target: {
        value:
          "https://coroapp.lovable.app/quixada/events/22222222-2222-4222-8222-222222222222\nhttps://coroapp.lovable.app/e/33333333-3333-4333-8333-333333333333",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar eventos" }));

    await waitFor(() =>
      expect(saveSources).toHaveBeenCalledWith({
        data: {
          publicUrls: [
            "https://coroapp.lovable.app/quixada/events/22222222-2222-4222-8222-222222222222",
            "https://coroapp.lovable.app/e/33333333-3333-4333-8333-333333333333",
          ],
        },
      }),
    );
    expect(await screen.findByText("Eventos atualizados com sucesso.")).toBeInTheDocument();
  });

  it("explains that content stays synchronized instead of being copied", async () => {
    render(
      <AdminCoroAppIntegrationPage
        checkAdmin={authorizedAdmin}
        getSession={activeSession}
        loadSources={async () => []}
        saveSources={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/músicas, áudios e partituras continuam vindo do CoroApp/i),
    ).toBeInTheDocument();
  });

  it("redirects before loading protected configuration when admin access is missing", async () => {
    const loadSources = vi.fn();
    const onMissingSession = vi.fn();
    render(
      <AdminCoroAppIntegrationPage
        checkAdmin={async () => ({ status: "forbidden" })}
        getSession={async () => ({ data: { session: null }, error: null })}
        loadSources={loadSources}
        onMissingSession={onMissingSession}
      />,
    );

    await waitFor(() => expect(onMissingSession).toHaveBeenCalledOnce());
    expect(loadSources).not.toHaveBeenCalled();
  });
});
