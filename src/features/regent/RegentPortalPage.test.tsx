import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AdminChoir } from "@/features/choirs/choir-pricing.domain";
import type { PortalParticipantPage } from "./regent-portal.server";
import type { PortalSummary } from "./regent-payments.domain";
import { RegentPortalPage } from "./RegentPortalPage";
import { getRegentPortalRedirect, shouldCheckRegentPortalAccess } from "@/routes/regente";

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
        ? { status: "authorized", role: "admin" }
        : { status: "authorized", role: "regent", choirId: choir.id },
    loadParticipants: vi.fn().mockResolvedValue(emptyPage),
    loadSummary: vi.fn().mockResolvedValue(summary),
    loadAdminChoirs: vi.fn().mockResolvedValue([choir]),
    ...overrides,
  };
  render(<RegentPortalPage {...props} />);
  return { props, user: userEvent.setup() };
}

describe("RegentPortalPage", () => {
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
  });

  it("lets an administrator select a choir before loading server-authorized data", async () => {
    const { props } = setup({}, "admin");

    const selector = await screen.findByRole("combobox", { name: "Coro" });
    expect(selector).toHaveTextContent("Coro Diocesano de Quixadá");
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

  it("maps every non-ready access state to the protected route destination", () => {
    expect(getRegentPortalRedirect({ status: "unauthenticated" })).toBe("/regente/login");
    expect(getRegentPortalRedirect({ status: "forbidden" })).toBe("/regente/login");
    expect(
      getRegentPortalRedirect({
        status: "password_change_required",
        role: "regent",
        choirId: choir.id,
      }),
    ).toBe("/regente/alterar-senha");
    expect(getRegentPortalRedirect({ status: "authorized", role: "admin" })).toBeNull();
  });

  it("protects only the portal itself without intercepting its login and recovery children", () => {
    expect(shouldCheckRegentPortalAccess("/regente")).toBe(true);
    expect(shouldCheckRegentPortalAccess("/regente/")).toBe(true);
    expect(shouldCheckRegentPortalAccess("/regente/login")).toBe(false);
    expect(shouldCheckRegentPortalAccess("/regente/alterar-senha")).toBe(false);
    expect(shouldCheckRegentPortalAccess("/regente/pagamento")).toBe(false);
  });
});
