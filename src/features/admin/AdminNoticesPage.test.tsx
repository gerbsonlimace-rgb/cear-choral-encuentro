import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminNoticesPage, type AdminNoticesPageProps } from "./AdminNoticesPage";

const eventId = "22222222-2222-4222-8222-222222222222";
const notice = {
  id: "44444444-4444-4444-8444-444444444444",
  eventId,
  eventName: "Grande Concerto",
  title: "Ensaio geral",
  body: "Chegue às 18h.",
  isPublished: true,
  createdAt: "2026-09-13T12:00:00.000Z",
  updatedAt: "2026-09-13T12:00:00.000Z",
};
const events = [
  {
    eventId,
    eventName: "Grande Concerto",
    publicUrl: `https://example.test/e/${eventId}`,
    sortOrder: 0,
    updatedAt: notice.createdAt,
  },
];

function setup(overrides: Partial<AdminNoticesPageProps> = {}) {
  const props: AdminNoticesPageProps = {
    loadBootstrap: async () => ({ notices: [], events }),
    createNotice: async ({ data }) => ({ ...notice, ...data }),
    updateNotice: async ({ data }) => ({ ...notice, ...data }),
    getSession: async () => ({ data: { session: {} }, error: null }),
    onMissingSession: vi.fn(),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<AdminNoticesPage {...props} />) };
}

describe("AdminNoticesPage", () => {
  it("publishes an event notice and displays the persisted result", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Novo aviso" }));
    await user.type(screen.getByLabelText("Título"), "Ensaio geral");
    await user.type(screen.getByLabelText("Mensagem"), "Chegue às 18h.");
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));
    expect(await screen.findByRole("heading", { name: "Ensaio geral" })).toBeInTheDocument();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText("Chegue às 18h.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits and withdraws a notice without losing its content", async () => {
    const { user } = setup({ loadBootstrap: async () => ({ notices: [notice], events }) });
    await user.click(await screen.findByRole("button", { name: "Editar Ensaio geral" }));
    await user.clear(screen.getByLabelText("Mensagem"));
    await user.type(screen.getByLabelText("Mensagem"), "Novo horário: 19h.");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Novo horário: 19h.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retirar Ensaio geral" }));
    expect(await screen.findByText("Retirado")).toBeInTheDocument();
    expect(screen.getByText("Novo horário: 19h.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar Ensaio geral" }));
    expect(await screen.findByText("Publicado")).toBeInTheDocument();
  });

  it("keeps the draft when publication fails and never claims success", async () => {
    const { user } = setup({
      createNotice: async () => {
        throw new Error("Não foi possível salvar o aviso.");
      },
    });
    await user.click(await screen.findByRole("button", { name: "Novo aviso" }));
    await user.type(screen.getByLabelText("Título"), "Ensaio geral");
    await user.type(screen.getByLabelText("Mensagem"), "Chegue às 18h.");
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar o aviso.");
    expect(screen.getByLabelText("Mensagem")).toHaveValue("Chegue às 18h.");
    expect(screen.queryByText("Aviso publicado.")).not.toBeInTheDocument();
  });

  it("requires a session and does not load administrative data without one", async () => {
    const loadBootstrap = vi.fn();
    const { props } = setup({
      loadBootstrap,
      getSession: async () => ({ data: { session: null }, error: null }),
    });
    await waitFor(() => expect(props.onMissingSession).toHaveBeenCalledOnce());
    expect(loadBootstrap).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Novo aviso" })).not.toBeInTheDocument();
  });

  it("disables publication until an event is configured", async () => {
    setup({ loadBootstrap: async () => ({ notices: [], events: [] }) });
    expect(await screen.findByRole("button", { name: "Novo aviso" })).toBeDisabled();
  });
});
