import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ParticipantAccess } from "./participant-auth.server";
import { ParticipantLoginPage } from "./ParticipantLoginPage";

vi.mock("@/lib/participant.functions", () => ({ getParticipantAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

type LoginOverrides = Partial<{
  signIn: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  checkAccess: () => Promise<ParticipantAccess>;
  signOut: () => Promise<{ error: unknown }>;
  onAuthorized: () => void;
}>;

function setup(overrides: LoginOverrides = {}) {
  const props = {
    signIn: vi.fn().mockResolvedValue({ error: null }),
    checkAccess: vi.fn().mockResolvedValue({
      status: "authorized",
      accountId: "11111111-1111-4111-8111-111111111111",
      registrationId: "22222222-2222-4222-8222-222222222222",
      userId: "33333333-3333-4333-8333-333333333333",
    } satisfies ParticipantAccess),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthorized: vi.fn(),
    ...overrides,
  };
  render(<ParticipantLoginPage {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function enter(
  user: ReturnType<typeof userEvent.setup>,
  email = "  participante@example.com  ",
  password = "5299822472515011990",
) {
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("ParticipantLoginPage", () => {
  it("signs in with the trimmed email and navigates only after authorized access", async () => {
    const { user, signIn, checkAccess, signOut, onAuthorized } = setup();

    await enter(user);

    expect(signIn).toHaveBeenCalledExactlyOnceWith({
      email: "participante@example.com",
      password: "5299822472515011990",
    });
    expect(checkAccess).toHaveBeenCalledOnce();
    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("keeps invalid credentials generic, clears the password, and does not probe access", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: new Error("USER_NOT_FOUND") });
    const { user, checkAccess, signOut, onAuthorized } = setup({ signIn });

    await enter(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique seu e-mail e senha.",
    );
    expect(document.body).not.toHaveTextContent("USER_NOT_FOUND");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(checkAccess).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it.each<ParticipantAccess>([{ status: "unavailable" }, { status: "unauthenticated" }])(
    "signs out a new session without participant access and clears the password",
    async (access) => {
      const { user, signOut, onAuthorized } = setup({
        checkAccess: vi.fn().mockResolvedValue(access),
      });

      await enter(user);

      expect(signOut).toHaveBeenCalledOnce();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível acessar a área do participante.",
      );
      expect(screen.getByLabelText("Senha")).toHaveValue("");
      expect(onAuthorized).not.toHaveBeenCalled();
    },
  );

  it("signs out after an access-probe error and keeps the failure generic", async () => {
    const checkAccess = vi.fn().mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL"));
    const signOut = vi.fn().mockRejectedValue(new Error("PRIVATE_SIGNOUT_DETAIL"));
    const { user, onAuthorized } = setup({ checkAccess, signOut });

    await enter(user);

    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível verificar seu acesso. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent(/PRIVATE_DATABASE_DETAIL|PRIVATE_SIGNOUT_DETAIL/);
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("prevents a second submission while authentication is pending", async () => {
    let resolveSignIn: ((result: { error: null }) => void) | undefined;
    const signIn = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const { user, onAuthorized } = setup({ signIn });
    await user.type(screen.getByLabelText("E-mail"), "participante@example.com");
    await user.type(screen.getByLabelText("Senha"), "5299822472515011990");
    const form = screen.getByRole("button", { name: "Entrar" }).closest("form");
    if (!form) throw new Error("Login form not found");

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(signIn).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();

    resolveSignIn?.({ error: null });
    await waitFor(() => expect(onAuthorized).toHaveBeenCalledOnce());
  });

  it("offers an accessible password visibility toggle without changing its value", async () => {
    const { user } = setup();
    const password = screen.getByLabelText("Senha");
    await user.type(password, "5299822472515011990");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("5299822472515011990");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("renders the event identity, autocomplete hints, and exact initial-password guidance", () => {
    setup();

    expect(
      screen.getByText(
        "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Área do participante" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(
      screen.getByText(
        "Sua senha inicial é formada pelos 11 dígitos do CPF, sem pontos ou traços, seguidos da data de nascimento em DDMMAAAA.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /esqueci|recuperar|redefinir/i }),
    ).not.toBeInTheDocument();
  });
});
