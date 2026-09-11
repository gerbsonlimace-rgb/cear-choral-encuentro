import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { RegentAccess } from "@/features/regent/regent.domain";
import { routeTree } from "@/routeTree.gen";

const server = vi.hoisted(() => ({
  getRegentAccess: vi.fn(),
  listParticipants: vi.fn(),
  loadSummary: vi.fn(),
  verifyPayment: vi.fn(),
  loadAdminChoirs: vi.fn(),
}));

vi.mock("@/lib/regent.functions", () => ({
  getRegentAccess: server.getRegentAccess,
  listRegentPortalParticipants: server.listParticipants,
  getRegentPortalSummary: server.loadSummary,
  startComplementCheckout: vi.fn(),
  verifyComplementPayment: server.verifyPayment,
  changeRegentPassword: vi.fn(),
  completeRegentPasswordChange: vi.fn(),
  listAdminRegents: vi.fn(),
  createAdminRegent: vi.fn(),
  replaceAdminRegent: vi.fn(),
  revokeAdminRegent: vi.fn(),
  resetAdminRegentPassword: vi.fn(),
}));

vi.mock("@/lib/choir-pricing.functions", () => ({
  getAdminChoirPricing: server.loadAdminChoirs,
  getPublicRegistrationConfiguration: vi.fn(),
  saveAdminPricingSettings: vi.fn(),
  createAdminChoir: vi.fn(),
  updateAdminChoir: vi.fn(),
  setAdminChoirActive: vi.fn(),
}));

const choirId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authorized: RegentAccess = {
  status: "authorized",
  role: "regent",
  choirId,
  choirName: "Coro Diocesano de Quixadá",
  name: "Ana Regente",
  email: "ana@example.com",
};

async function renderRoute(path: string, access: RegentAccess = authorized) {
  server.getRegentAccess.mockResolvedValue(access);
  server.listParticipants.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 });
  server.loadSummary.mockResolvedValue({
    totalParticipants: 0,
    eligibleComplementCents: 0,
    confirmedComplementCents: 0,
    outstandingComplementCents: 0,
  });
  server.verifyPayment.mockResolvedValue({ status: "pending" });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { router, user };
}

beforeAll(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => vi.clearAllMocks());

describe("/regente route behavior", () => {
  it.each<RegentAccess>([{ status: "unauthenticated" }, { status: "forbidden" }])(
    "redirects $status access to unified access",
    async (access) => {
      const { router } = await renderRoute("/regente", access);
      await waitFor(() => expect(router.state.location.pathname).toBe("/acessar"));
      expect(screen.getByRole("heading", { name: "Acessar portal" })).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    },
  );

  it("redirects a pending password change to the required form", async () => {
    const { router } = await renderRoute("/regente", {
      status: "password_change_required",
      role: "regent",
      choirId,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/regente/alterar-senha"));
    expect(screen.getByRole("heading", { name: "Crie uma nova senha" })).toBeInTheDocument();
  });

  it("renders the authorized portal through the real route", async () => {
    const { router } = await renderRoute("/regente");
    expect(router.state.location.pathname).toBe("/regente");
    expect(screen.getByRole("heading", { name: "Área do regente" })).toBeInTheDocument();
    expect(await screen.findByText("Coro ativo: Coro Diocesano de Quixadá")).toBeInTheDocument();
  });

  it("keeps the payment child accessible through the actual parent outlet", async () => {
    const { router } = await renderRoute("/regente/pagamento");
    expect(router.state.location.pathname).toBe("/regente/pagamento");
    expect(
      screen.getByRole("heading", { name: "Não foi possível identificar este pagamento." }),
    ).toBeInTheDocument();
  });

  it("navigates from the payment child back to the portal without a redirect loop", async () => {
    const { router, user } = await renderRoute("/regente/pagamento");
    await user.click(screen.getByRole("link", { name: "Voltar à área do regente" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/regente"));
    expect(screen.getByRole("heading", { name: "Área do regente" })).toBeInTheDocument();
    expect(server.getRegentAccess).toHaveBeenCalledTimes(2);
  });
});
