import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminChoirsPage } from "./AdminChoirsPage";
import type { AdminChoirPricing } from "@/features/choirs/choir-pricing.server";

vi.mock("@/lib/regent.functions", () => ({
  listAdminRegents: vi.fn(async () => []),
  searchAdminRegentCandidates: vi.fn(async () => []),
  createAdminRegent: vi.fn(),
  replaceAdminRegent: vi.fn(),
  linkExistingAdminRegent: vi.fn(),
  replaceAdminRegentWithExistingUser: vi.fn(),
  revokeAdminRegent: vi.fn(),
  resetAdminRegentPassword: vi.fn(),
}));
vi.mock("@/lib/coroapp-event-source.functions", () => ({
  getAdminCoroAppEventSources: vi.fn(async () => []),
  replaceAdminCoroAppEventSources: vi.fn(async () => []),
}));

const emptyData: AdminChoirPricing = {
  settings: {
    standardPriceCents: null,
    promotionalPriceCents: null,
  },
  choirs: [],
};

const promotionalChoir = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Coro Diocesano de Quixadá",
  diocese: "Diocese de Quixadá" as const,
  usesPromotionalPrice: true,
  isActive: true,
  createdAt: "2026-09-09T12:00:00.000Z",
  updatedAt: "2026-09-09T12:00:00.000Z",
};

function setup(overrides: Partial<React.ComponentProps<typeof AdminChoirsPage>> = {}) {
  const props: React.ComponentProps<typeof AdminChoirsPage> = {
    onSignedOut: vi.fn(),
    onMissingSession: vi.fn(),
    checkAdmin: vi.fn(async () => ({
      status: "authorized" as const,
      userId: "admin-1",
      email: "admin@example.com",
    })),
    loadData: vi.fn(async () => emptyData),
    saveSettings: vi.fn(async ({ data }) => data),
    createChoir: vi.fn(async ({ data }) => ({
      id: "22222222-2222-4222-8222-222222222222",
      ...data,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    })),
    updateChoir: vi.fn(),
    setChoirActive: vi.fn(),
    getSession: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
  return { user: userEvent.setup(), props, ...render(<AdminChoirsPage {...props} />) };
}

describe("AdminChoirsPage", () => {
  it("renders an aggregated initial payload without repeating authorization or reads", async () => {
    const checkAdmin = vi.fn();
    const loadData = vi.fn();
    const loadInitialData = vi.fn().mockResolvedValue({
      access: { status: "authorized", userId: "admin-1", email: "admin@example.com" },
      data: emptyData,
    });

    setup({ checkAdmin, loadData, loadInitialData });

    expect(await screen.findByText("Nenhum coro cadastrado.")).toBeInTheDocument();
    expect(loadInitialData).toHaveBeenCalledOnce();
    expect(checkAdmin).not.toHaveBeenCalled();
    expect(loadData).not.toHaveBeenCalled();
  });

  it("opens the regent registration from the selected choir", async () => {
    setup({ loadData: vi.fn(async () => ({ ...emptyData, choirs: [promotionalChoir] })) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Gerenciar regente" }));
    const dialog = screen.getByRole("dialog", {
      name: "Regente de Coro Diocesano de Quixadá",
    });
    expect(within(dialog).getByText("Coro Diocesano de Quixadá")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Coro")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cadastrar regente" })).toBeInTheDocument();
  });
  it("shows unconfigured global prices and an empty choir state", async () => {
    setup({ section: "settings" });

    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Valor normal")).toHaveValue("");
    expect(screen.getByLabelText("Valor promocional")).toHaveValue("");
    expect(screen.getAllByPlaceholderText("Não configurado")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Eventos do CoroApp" })).toBeInTheDocument();
  });

  it("converts and saves all global currency values", async () => {
    const saveSettings = vi.fn(async ({ data }) => data);
    const { user } = setup({ saveSettings, section: "settings" });

    await user.type(await screen.findByLabelText("Valor normal"), "300,00");
    await user.type(screen.getByLabelText("Valor promocional"), "100,00");
    await user.type(screen.getByLabelText("Valor restante promocional"), "250,00");
    await user.click(screen.getByRole("button", { name: "Salvar valores" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        data: {
          standardPriceCents: 30000,
          promotionalPriceCents: 10000,
          promotionalRemainingPriceCents: 25000,
        },
      }),
    );
    expect(await screen.findByText("Valores do evento salvos.")).toBeInTheDocument();
  });

  it("creates a promotional choir from the administrative dialog", async () => {
    const createChoir = vi.fn(async ({ data }) => ({
      id: "22222222-2222-4222-8222-222222222222",
      ...data,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    }));
    const { user } = setup({ createChoir });

    await user.click(await screen.findByRole("button", { name: "Cadastrar coro" }));
    await user.type(screen.getByLabelText("Nome do coro"), "Coro Litúrgico");
    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Sobral");
    await user.click(screen.getByRole("checkbox", { name: "Aplicar valor promocional" }));
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));

    await waitFor(() =>
      expect(createChoir).toHaveBeenCalledWith({
        data: {
          name: "Coro Litúrgico",
          diocese: "Diocese de Sobral",
          usesPromotionalPrice: true,
          isFree: false,
          raffleOnlinePaymentsEnabled: false,
          isActive: true,
        },
      }),
    );
  });

  it("allows the admin to mark a choir as free", async () => {
    const createChoir = vi.fn(async ({ data }) => ({ ...promotionalChoir, ...data }));
    const { user } = setup({ createChoir });
    await user.click(await screen.findByRole("button", { name: "Cadastrar coro" }));
    await user.type(screen.getByLabelText("Nome do coro"), "Coro Gratuito");
    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Quixadá");
    await user.click(screen.getByRole("checkbox", { name: "Inscrição gratuita com aprovação do administrador" }));
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));
    await waitFor(() => expect(createChoir).toHaveBeenCalledWith({ data: expect.objectContaining({
      name: "Coro Gratuito", isFree: true, usesPromotionalPrice: false,
    }) }));
  });

  it("requires a diocese from the official list and displays the saved affiliation", async () => {
    const createChoir = vi.fn();
    const { user } = setup({
      createChoir,
      loadData: vi.fn(async () => ({ ...emptyData, choirs: [promotionalChoir] })),
    });

    expect(await screen.findByText("Diocese de Quixadá")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cadastrar coro" }));

    const diocese = screen.getByLabelText("Diocese");
    expect(diocese).toBeRequired();
    expect(within(diocese).getAllByRole("option")).toHaveLength(11);
    expect(
      within(diocese).queryByRole("option", { name: "Diocese de Canindé" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome do coro"), "Coro Litúrgico");
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));
    expect(createChoir).not.toHaveBeenCalled();
  });

  it("preselects and updates the diocese of an existing choir", async () => {
    const updateChoir = vi.fn(async ({ data }) => ({
      ...promotionalChoir,
      ...data,
    }));
    const { user } = setup({
      updateChoir,
      loadData: vi.fn(async () => ({ ...emptyData, choirs: [promotionalChoir] })),
    });

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Diocese")).toHaveValue("Diocese de Quixadá");

    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Sobral");
    await user.click(screen.getByRole("checkbox", { name: "Permitir pagamento online de rifas" }));
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));

    await waitFor(() =>
      expect(updateChoir).toHaveBeenCalledWith({
        data: {
          id: promotionalChoir.id,
          name: promotionalChoir.name,
          diocese: "Diocese de Sobral",
          usesPromotionalPrice: true,
          isFree: false,
          raffleOnlinePaymentsEnabled: true,
          isActive: true,
        },
      }),
    );
  });

  it("warns when a promotional choir is hidden by missing prices", async () => {
    setup({
      loadData: vi.fn(async () => ({ ...emptyData, choirs: [promotionalChoir] })),
    });

    expect(
      await screen.findByText("Oculto: configure os valores normal e promocional."),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before inactivating a choir", async () => {
    const setChoirActive = vi.fn(async ({ data }) => ({ ...promotionalChoir, ...data }));
    const { user } = setup({
      loadData: vi.fn(async () => ({
        settings: {
          standardPriceCents: 30000,
          promotionalPriceCents: 10000,
        },
        choirs: [promotionalChoir],
      })),
      setChoirActive,
    });

    await user.click(await screen.findByRole("button", { name: "Inativar" }));
    expect(setChoirActive).not.toHaveBeenCalled();
    expect(screen.getByText("Inativar este coro?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar inativação" }));
    await waitFor(() =>
      expect(setChoirActive).toHaveBeenCalledWith({
        data: { id: promotionalChoir.id, isActive: false },
      }),
    );
  });

  it("keeps the choir draft when saving fails", async () => {
    const { user } = setup({
      createChoir: vi.fn(async () => {
        throw new Error("duplicate");
      }),
    });

    await user.click(await screen.findByRole("button", { name: "Cadastrar coro" }));
    await user.type(screen.getByLabelText("Nome do coro"), "Coro Litúrgico");
    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Quixadá");
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar o coro.");
    expect(screen.getByLabelText("Nome do coro")).toHaveValue("Coro Litúrgico");
  });

  it("shows the safe duplicate-name message", async () => {
    const { user } = setup({
      createChoir: vi.fn(async () => {
        throw new Error("Já existe um coro com esse nome.");
      }),
    });

    await user.click(await screen.findByRole("button", { name: "Cadastrar coro" }));
    await user.type(screen.getByLabelText("Nome do coro"), "Coro Litúrgico");
    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Quixadá");
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um coro com esse nome.");
  });

  it("retries the initial administrative load", async () => {
    const user = userEvent.setup();
    const loadData = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(emptyData);
    setup({ loadData });

    await screen.findByText("Não foi possível carregar os coros e valores.");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Nenhum coro cadastrado.")).toBeInTheDocument();
    expect(loadData).toHaveBeenCalledTimes(2);
  });
});
