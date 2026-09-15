import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route as loginRoute } from "./acessar";
import { Route as participantRoute } from "./participante.index";

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUnifiedPortalAccess: vi.fn(),
  getParticipantAccess: vi.fn(),
  getParticipantRegistration: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: api } }));
vi.mock("@/lib/portal-access.functions", () => ({
  getUnifiedPortalAccess: api.getUnifiedPortalAccess,
}));
vi.mock("@/lib/participant.functions", () => ({
  getParticipantAccess: api.getParticipantAccess,
  getParticipantRegistration: api.getParticipantRegistration,
}));
vi.mock("@/lib/chorister-app.functions", () => ({ getChoristerPortalCollection: vi.fn() }));

async function openLogin(path = "/acessar") {
  const root = createRootRoute({ component: Outlet });
  const routeTree = root.addChildren([
    loginRoute.update({ path: "/acessar", getParentRoute: () => root } as never),
    participantRoute.update({ path: "/participante", getParentRoute: () => root } as never),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  window.scrollTo = vi.fn();
  api.getSession.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
  api.getUnifiedPortalAccess.mockResolvedValue({
    status: "authorized",
    destination: "/participante",
  });
  api.signInWithPassword.mockResolvedValue({ error: null });
  api.signOut.mockResolvedValue({ error: null });
});

describe("login return after participant access rejection", () => {
  it.each(["unauthenticated", "unavailable"])(
    "stops automatic navigation after the participant probe returns %s",
    async (status) => {
      // A second probe stays pending so a regression cannot create an unbounded loop in the test.
      api.getParticipantAccess
        .mockResolvedValueOnce({ status })
        .mockImplementation(() => new Promise(() => {}));
      await openLogin();

      await waitFor(() => expect(api.getParticipantAccess).toHaveBeenCalledOnce());
      await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
      expect(screen.getByRole("heading", { name: "Acessar portal" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
      expect(api.getUnifiedPortalAccess).toHaveBeenCalledOnce();
      expect(api.getParticipantAccess).toHaveBeenCalledOnce();
      expect(api.getParticipantRegistration).not.toHaveBeenCalled();
    },
  );

  it("requires an explicit sign-in after a rejected return, including a page reload", async () => {
    api.getParticipantAccess.mockImplementation(() => new Promise(() => {}));
    await openLogin("/acessar?reautenticar=true");
    await act(async () => {});

    expect(api.getSession).not.toHaveBeenCalled();
    expect(api.getUnifiedPortalAccess).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-de-teste");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(api.getParticipantAccess).toHaveBeenCalledOnce());
    expect(api.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: "pessoa@example.com",
      password: "senha-de-teste",
    });
    expect(api.getUnifiedPortalAccess).toHaveBeenCalledOnce();
  });
});
