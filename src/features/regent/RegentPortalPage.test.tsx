import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AdminChoir } from "@/features/choirs/choir-pricing.domain";
import type { PortalParticipantPage } from "./regent-portal.server";
import type { PortalSummary } from "./regent-payments.domain";
import { RegentPortalPage } from "./RegentPortalPage";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
});

const choir: AdminChoir = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Coro Diocesano de Quixadá",
  usesPromotionalPrice: true,
  isActive: true,
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
};

const summary: PortalSummary = {
  totalParticipants: 23,
  eligibleComplementCents: 46_000,
  confirmedComplementCents: 15_000,
  outstandingComplementCents: 31_000,
};

const emptyPage: PortalParticipantPage = { rows: [], total: 0, page: 1, pageSize: 20 };

function setup(
  overrides: Partial<React.ComponentProps<typeof RegentPortalPage>> = {},
  role: "admin" | "regent" = "regent",
) {
  const props: React.ComponentProps<typeof RegentPortalPage> = {
    access:
      role === "admin"
        ? { status: "authorized", role: "admin", email: "admin@example.com" }
        : {
            status: "authorized",
            role: "regent",
            choirId: choir.id,
            choirName: choir.name,
            name: "Ana Regente",
            email: "ana@example.com",
          },
    loadParticipants: vi.fn().mockResolvedValue(emptyPage),
    loadSummary: vi.fn().mockResolvedValue(summary),
    loadAdminChoirs: vi.fn().mockResolvedValue([choir]),
    ...overrides,
  };
  render(<RegentPortalPage {...props} />);
  return { props, user: userEvent.setup() };
}

describe("RegentPortalPage", () => {
  it("uses the shared black-and-gold shell across desktop and mobile navigation", async () => {
    const { user } = setup({
      initialData: {
        access: {
          status: "authorized",
          role: "regent",
          choirId: choir.id,
          choirName: choir.name,
          name: "Ana Regente",
          email: "ana@example.com",
        },
        choirs: [],
        selectedChoirId: choir.id,
        summary,
        participants: emptyPage,
      },
    });

    expect(screen.getByTestId("internal-topbar")).toHaveClass("bg-brand-ink");
    const navigation = screen.getByRole("navigation", { name: "Navegação de Regente" });
    expect(navigation).toHaveTextContent("Resumo");
    expect(navigation).toHaveTextContent("Coralistas");
    expect(navigation).toHaveTextContent("Meu perfil");
    expect(screen.getAllByTestId("internal-mobile-primary-item")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Coralistas" }));
    expect(screen.getByRole("region", { name: "Participantes do coro" })).toHaveClass("block");
  });

  it("renders the aggregated initial payload without repeating portal reads", async () => {
    const loadParticipants = vi.fn();
    const loadSummary = vi.fn();
    const loadAdminChoirs = vi.fn();
    setup({
      loadParticipants,
      loadSummary,
      loadAdminChoirs,
      initialData: {
        access: {
          status: "authorized",
          role: "regent",
          choirId: choir.id,
          choirName: choir.name,
          name: "Ana Regente",
          email: "ana@example.com",
        },
        choirs: [],
        selectedChoirId: choir.id,
        summary,
        participants: emptyPage,
      },
    });

    expect(await screen.findByText("23")).toBeInTheDocument();
    expect(loadParticipants).not.toHaveBeenCalled();
    expect(loadSummary).not.toHaveBeenCalled();
    expect(loadAdminChoirs).not.toHaveBeenCalled();
  });

  it("shows four financial summary cards and keeps the choir fixed for a regent", async () => {
    setup();

    expect(await screen.findByText("Total de participantes")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Complemento total")).toBeInTheDocument();
    expect(screen.getByText("R$ 460,00")).toBeInTheDocument();
    expect(screen.getByText("Complemento confirmado")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("Saldo a receber")).toBeInTheDocument();
    expect(screen.getByText("R$ 310,00")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Coro" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana Regente")).toHaveLength(2);
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText(`Coro ativo: ${choir.name}`)).toBeInTheDocument();
  });

  it("lets an administrator select a choir before loading server-authorized data", async () => {
    const { props } = setup({}, "admin");

    const selector = await screen.findByRole("combobox", { name: "Coro" });
    expect(selector).toHaveTextContent("Coro Diocesano de Quixadá");
    expect(screen.getAllByText("Administrador · admin@example.com")).toHaveLength(2);
    expect(screen.getByText(`Coro ativo: ${choir.name}`)).toBeInTheDocument();
    await waitFor(() =>
      expect(props.loadParticipants).toHaveBeenCalledWith({
        data: { choirId: choir.id, search: "", page: 1, pageSize: 20 },
      }),
    );
    expect(props.loadSummary).toHaveBeenCalledWith({ data: { choirId: choir.id } });
  });

  it("submits an in-memory search, resets the page, and paginates without changing the URL", async () => {
    const loadParticipants = vi.fn().mockImplementation(async ({ data }) => ({
      ...emptyPage,
      total: 45,
      page: data.page,
    }));
    const { user } = setup({ loadParticipants });
    await screen.findByText("Página 1 de 3");
    const initialUrl = window.location.href;

    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pesquisar participantes"), "  Ana  ");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    await waitFor(() =>
      expect(loadParticipants).toHaveBeenLastCalledWith({
        data: { search: "Ana", page: 1, pageSize: 20 },
      }),
    );
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(window.location.href).toBe(initialUrl);
  });

  it("retries a failed first page with the same unchanged search", async () => {
    const loadParticipants = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(emptyPage);
    const { user } = setup({ loadParticipants });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os participantes. Tente novamente.",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Nenhum participante encontrado.")).toBeInTheDocument();
    expect(loadParticipants).toHaveBeenCalledTimes(2);
    expect(loadParticipants.mock.calls[0][0]).toEqual({
      data: { search: "", page: 1, pageSize: 20 },
    });
    expect(loadParticipants.mock.calls[1][0]).toEqual(loadParticipants.mock.calls[0][0]);
  });

  it("refreshes participants and summary when the portal becomes visible again", async () => {
    const { props } = setup();
    await screen.findByText("Nenhum participante encontrado.");

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(props.loadParticipants).toHaveBeenCalledTimes(2);
      expect(props.loadSummary).toHaveBeenCalledTimes(2);
    });
  });
});
