import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { RegentAccess } from "@/features/regent/regent.domain";
import { routeTree } from "@/routeTree.gen";

const server = vi.hoisted(() => ({
  getRegentAccess: vi.fn(),
}));

vi.mock("@/lib/regent.functions", () => ({
  getRegentAccess: server.getRegentAccess,
  getRegentPortalBootstrap: async () => ({
    access: await server.getRegentAccess(),
    participants: [],
    payment: null,
  }),
}));

vi.mock("@/features/access/UnifiedPortalLoginPage", () => ({
  UnifiedPortalLoginPage: ({
    onAuthorized,
  }: {
    onAuthorized: (
      destination: "/admin/resumo" | "/regente/alterar-senha" | "/regente" | "/participante",
    ) => void;
  }) => (
    <>
      <button onClick={() => onAuthorized("/admin/resumo")}>Resolve admin</button>
      <button onClick={() => onAuthorized("/regente/alterar-senha")}>
        Resolve password change
      </button>
      <button onClick={() => onAuthorized("/regente")}>Resolve regent</button>
      <button onClick={() => onAuthorized("/participante")}>Resolve participant</button>
    </>
  ),
}));

vi.mock("@/features/admin/AdminRegistrationsPage", () => ({
  AdminRegistrationsPage: ({
    onSignedOut,
    onMissingSession,
  }: {
    onSignedOut: () => void;
    onMissingSession: () => void;
  }) => (
    <>
      <button onClick={onSignedOut}>Sign out from registrations</button>
      <button onClick={onMissingSession}>Expire registrations session</button>
    </>
  ),
}));

vi.mock("@/features/admin/AdminChoirsPage", () => ({
  AdminChoirsPage: ({
    onSignedOut,
    onMissingSession,
  }: {
    onSignedOut: () => void;
    onMissingSession: () => void;
  }) => (
    <>
      <button onClick={onSignedOut}>Sign out from choirs</button>
      <button onClick={onMissingSession}>Expire choirs session</button>
    </>
  ),
}));

vi.mock("@/features/admin/AdminSummaryPage", () => ({
  AdminSummaryPage: () => <h1>Authorized admin summary</h1>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test" } } }),
    },
  },
}));

vi.mock("@/features/regent/RegentPasswordChangePage", () => ({
  RegentPasswordChangePage: ({ onLoginRequired }: { onLoginRequired: () => void }) => (
    <button onClick={onLoginRequired}>Require regent login</button>
  ),
}));

vi.mock("@/features/regent/RegentPortalPage", () => ({
  RegentPortalPage: () => <h1>Authorized regent portal</h1>,
}));

vi.mock("@/features/regent/ComplementPaymentConfirmationPage", () => ({
  ComplementPaymentConfirmationPage: () => <h1>Authorized regent payment</h1>,
}));

vi.mock("@/features/participant/ParticipantPortalPage", () => ({
  ParticipantPortalPage: ({
    onMissingAccess,
    onSignedOut,
  }: {
    onMissingAccess: () => void;
    onSignedOut: () => void;
  }) => (
    <>
      <button onClick={onMissingAccess}>Deny participant access</button>
      <button onClick={onSignedOut}>Sign out participant</button>
    </>
  ),
}));

vi.mock("@/features/photo-art/PhotoArtEditor", () => ({
  PhotoArtEditor: () => <h1>Escolha uma arte</h1>,
}));

const authorizedRegent: RegentAccess = {
  status: "authorized",
  role: "regent",
  choirId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  choirName: "Coro Diocesano de Quixadá",
  name: "Ana Regente",
  email: "ana@example.com",
};

async function renderRoute(path: string, access: RegentAccess = authorizedRegent) {
  server.getRegentAccess.mockResolvedValue(access);
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return { history, router, user: userEvent.setup() };
}

beforeAll(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => vi.clearAllMocks());

describe("unified portal routes", () => {
  it.each([
    ["Resolve admin", "/admin/resumo"],
    ["Resolve password change", "/regente/alterar-senha"],
    ["Resolve regent", "/regente"],
    ["Resolve participant", "/participante"],
  ] as const)(
    "navigates the closed %s callback through the real router",
    async (button, destination) => {
      const { router, user } = await renderRoute("/acessar");

      await user.click(screen.getByRole("button", { name: button }));

      await waitFor(() => expect(router.state.location.pathname).toBe(destination));
    },
  );

  it.each(["/admin/login", "/regente/login", "/participante/login"])(
    "replaces the legacy %s location with unified access",
    async (legacyPath) => {
      const { history, router } = await renderRoute(legacyPath);

      await waitFor(() => expect(router.state.location.pathname).toBe("/acessar"));
      expect(history.length).toBe(1);
    },
  );

  it("redirects the administrative home to the summary", async () => {
    const { router } = await renderRoute("/admin");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/resumo"));
  });

  it("opens the Eu Vou editor without participant access", async () => {
    const { router } = await renderRoute("/euvou");

    expect(router.state.location.pathname).toBe("/euvou");
    expect(screen.getByRole("heading", { name: "Escolha uma arte" })).toBeInTheDocument();
  });

  it("redirects the old participant photo link to Eu Vou", async () => {
    const { history, router } = await renderRoute("/participante/minha-foto");

    await waitFor(() => expect(router.state.location.pathname).toBe("/euvou"));
    expect(history.length).toBe(1);
  });

  it.each([
    ["/admin/inscricoes", "Sign out from registrations"],
    ["/admin/inscricoes", "Expire registrations session"],
    ["/admin/coros", "Sign out from choirs"],
    ["/admin/coros", "Expire choirs session"],
    ["/regente/alterar-senha", "Require regent login"],
    ["/participante", "Deny participant access"],
    ["/participante", "Sign out participant"],
  ] as const)("routes the %s access fallback to unified access", async (path, action) => {
    const { router, user } = await renderRoute(path);

    await user.click(screen.getByRole("button", { name: action }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/acessar"));
  });

  it.each<RegentAccess>([{ status: "unauthenticated" }, { status: "forbidden" }])(
    "routes $status regent parent access to unified access",
    async (access) => {
      const { router } = await renderRoute("/regente", access);

      await waitFor(() => expect(router.state.location.pathname).toBe("/acessar"));
    },
  );

  it.each<RegentAccess>([{ status: "unauthenticated" }, { status: "forbidden" }])(
    "routes $status regent payment access to unified access",
    async (access) => {
      const { router } = await renderRoute("/regente/pagamento", access);

      await waitFor(() => expect(router.state.location.pathname).toBe("/acessar"));
    },
  );
});
