import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminChoirsPage } from "./AdminChoirsPage";
import type { AdminChoirPricing } from "@/features/choirs/choir-pricing.server";

vi.mock("@/lib/regent.functions", () => ({
  listAdminRegents: vi.fn(async () => []),
  createAdminRegent: vi.fn(),
  replaceAdminRegent: vi.fn(),
  revokeAdminRegent: vi.fn(),
  resetAdminRegentPassword: vi.fn(),
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
  it("includes regent management using loaded choir options and the public portal link", async () => {
    setup({ loadData: vi.fn(async () => ({ ...emptyData, choirs: [promotionalChoir] })) });
    expect(await screen.findByRole("heading", { name: "Regentes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Coro")).toHaveTextContent("Coro Diocesano de Quixadá");
    expect(screen.getByRole("link", { name: "Área dos regentes" })).toHaveAttribute(
      "href",
      "/regente",
    );
  });
  it("shows unconfigured global prices and an empty choir state", async () => {
    setup();

    expect(await screen.findByLabelText("Valor normal")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Coros e valores" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valor promocional")).toHaveValue("");
    expect(screen.getAllByPlaceholderText("Não configurado")).toHaveLength(2);
    expect(screen.getByText("Nenhum coro cadastrado.")).toBeInTheDocument();
  });

  it("converts and saves all global currency values", async () => {
    const saveSettings = vi.fn(async ({ data }) => data);
    const { user } = setup({ saveSettings });

    await user.type(await screen.findByLabelText("Valor normal"), "300,00");
    await user.type(screen.getByLabelText("Valor promocional"), "100,00");
    await user.click(screen.getByRole("button", { name: "Salvar valores" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        data: {
          standardPriceCents: 30000,
          promotionalPriceCents: 10000,
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
    await user.click(screen.getByRole("checkbox", { name: "Aplicar valor promocional" }));
    await user.click(screen.getByRole("button", { name: "Salvar coro" }));

    await waitFor(() =>
      expect(createChoir).toHaveBeenCalledWith({
        data: {
          name: "Coro Litúrgico",
          usesPromotionalPrice: true,
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
