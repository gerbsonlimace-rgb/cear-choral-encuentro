import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { UnifiedPortalAccess } from "./portal-access.domain";
import { UnifiedPortalLoginPage } from "./UnifiedPortalLoginPage";

vi.mock("@/lib/portal-access.functions", () => ({ getUnifiedPortalAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

type LoginDependencies = Pick<
  ComponentProps<typeof UnifiedPortalLoginPage>,
  "signIn" | "checkAccess" | "signOut" | "getSession"
>;

function setup(overrides: LoginDependencies = {}) {
  const signIn = vi.fn(overrides.signIn ?? (async () => ({ error: null })));
  const checkAccess = vi.fn(
    overrides.checkAccess ??
      (async (): Promise<UnifiedPortalAccess> => ({
        status: "authorized",
        destination: "/participante",
      })),
  );
  const signOut = vi.fn(overrides.signOut ?? (async () => ({ error: null })));
  const getSession = vi.fn(
    overrides.getSession ?? (async () => ({ data: { session: null }, error: null })),
  );
  const onAuthorized = vi.fn();
  const view = render(
    <UnifiedPortalLoginPage
      signIn={signIn}
      checkAccess={checkAccess}
      signOut={signOut}
      getSession={getSession}
      onAuthorized={onAuthorized}
    />,
  );

  return {
    ...view,
    user: userEvent.setup(),
    signIn,
    checkAccess,
    signOut,
    getSession,
    onAuthorized,
  };
}

async function enter(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("E-mail"), "  pessoa@example.com  ");
  await user.type(screen.getByLabelText("Senha"), "SenhaSegura123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("UnifiedPortalLoginPage", () => {
  it.each(["/admin/inscricoes", "/regente/alterar-senha", "/regente", "/participante"] as const)(
    "navigates to an authorized %s destination",
    async (destination) => {
      const { user, signIn, checkAccess, onAuthorized } = setup({
        checkAccess: vi.fn().mockResolvedValue({ status: "authorized", destination }),
      });

      await enter(user);

      expect(signIn).toHaveBeenCalledExactlyOnceWith({
        email: "pessoa@example.com",
        password: "SenhaSegura123",
      });
      expect(checkAccess).toHaveBeenCalledOnce();
      expect(onAuthorized).toHaveBeenCalledExactlyOnceWith(destination);
      expect(screen.getByLabelText("Senha")).toHaveValue("");
    },
  );

  it("renders the event identity and accessible login controls without a profile selector", () => {
    setup();

    expect(
      screen.getByText(
        "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acessar portal" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao evento" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps invalid credentials generic, clears the password, and stops before access checks", async () => {
    const { user, checkAccess, signOut, onAuthorized } = setup({
      signIn: vi.fn().mockResolvedValue({ error: new Error("USER_NOT_FOUND PRIVATE_DETAIL") }),
    });

    await enter(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique seu e-mail e senha.",
    );
    expect(document.body).not.toHaveTextContent(/USER_NOT_FOUND|PRIVATE_DETAIL/);
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(checkAccess).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("closes a signed-in session when portal access is unavailable", async () => {
    const { user, signOut, onAuthorized } = setup({
      checkAccess: vi.fn().mockResolvedValue({ status: "unavailable" }),
    });

    await enter(user);

    expect(signOut).toHaveBeenCalledOnce();
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível acessar o portal.");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("attempts sign-out after an access-check failure and hides internal details", async () => {
    const { user, signOut, onAuthorized } = setup({
      checkAccess: vi.fn().mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL")),
      signOut: vi.fn().mockRejectedValue(new Error("PRIVATE_SIGNOUT_DETAIL")),
    });

    await enter(user);

    expect(signOut).toHaveBeenCalledOnce();
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível verificar seu acesso. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent(/PRIVATE_DATABASE_DETAIL|PRIVATE_SIGNOUT_DETAIL/);
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("prevents duplicate submissions while authentication is pending", async () => {
    let resolveSignIn: ((result: { error: null }) => void) | undefined;
    const { user, signIn, onAuthorized } = setup({
      signIn: () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSignIn = resolve;
        }),
    });
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.com");
    await user.type(screen.getByLabelText("Senha"), "SenhaSegura123");
    const form = screen.getByRole("button", { name: "Entrar" }).closest("form");
    if (!form) throw new Error("Login form not found");

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(signIn).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();

    await act(async () => resolveSignIn?.({ error: null }));
    await waitFor(() => expect(onAuthorized).toHaveBeenCalledOnce());
  });

  it("changes only the password input type when showing and hiding the password", async () => {
    const { user } = setup();
    const email = screen.getByLabelText("E-mail");
    const password = screen.getByLabelText("Senha");
    await user.type(email, "pessoa@example.com");
    await user.type(password, "SenhaSegura123");

    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveValue("pessoa@example.com");
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("SenhaSegura123");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("SenhaSegura123");
  });

  it("routes an existing session without requesting credentials", async () => {
    const { signIn, checkAccess, onAuthorized } = setup({
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "authenticated-user" } } },
        error: null,
      }),
      checkAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        destination: "/admin/inscricoes",
      }),
    });

    await waitFor(() => expect(onAuthorized).toHaveBeenCalledExactlyOnceWith("/admin/inscricoes"));
    expect(checkAccess).toHaveBeenCalledOnce();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("leaves the form ready when there is no existing session", async () => {
    const { getSession, signIn, checkAccess } = setup();

    await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
    expect(checkAccess).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.getByLabelText("E-mail")).toBeEnabled();
    expect(screen.getByLabelText("Senha")).toBeEnabled();
  });

  it("does not continue authentication or navigate after unmount", async () => {
    let resolveSignIn: ((result: { error: null }) => void) | undefined;
    const { user, unmount, signIn, checkAccess, onAuthorized } = setup({
      signIn: () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSignIn = resolve;
        }),
    });
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.com");
    await user.type(screen.getByLabelText("Senha"), "SenhaSegura123");
    void user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledOnce());

    unmount();
    await act(async () => resolveSignIn?.({ error: null }));

    expect(checkAccess).not.toHaveBeenCalled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});
