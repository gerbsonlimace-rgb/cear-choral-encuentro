import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RegentAccess } from "./regent.domain";
import { RegentLoginPage } from "./RegentLoginPage";

vi.mock("@/lib/regent.functions", () => ({ getRegentAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

function setup(access: RegentAccess, overrides = {}) {
  const props = {
    signIn: vi.fn().mockResolvedValue({ error: null }),
    checkAccess: vi.fn().mockResolvedValue(access),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onPasswordChangeRequired: vi.fn(),
    onAuthorized: vi.fn(),
    ...overrides,
  };
  render(<RegentLoginPage {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function enter(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("E-mail"), "regente@example.com");
  await user.type(screen.getByLabelText("Senha"), "SenhaTemp123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("RegentLoginPage", () => {
  it("sends the credentials once and routes a gated regent to password change", async () => {
    const { user, signIn, onPasswordChangeRequired, onAuthorized } = setup({
      status: "password_change_required",
      role: "regent",
      choirId: "11111111-1111-4111-8111-111111111111",
    });

    await enter(user);

    expect(signIn).toHaveBeenCalledExactlyOnceWith({
      email: "regente@example.com",
      password: "SenhaTemp123",
    });
    expect(onPasswordChangeRequired).toHaveBeenCalledOnce();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it.each<RegentAccess>([
    { status: "authorized", role: "admin" },
    {
      status: "authorized",
      role: "regent",
      choirId: "11111111-1111-4111-8111-111111111111",
    },
  ])("routes authorized portal access to the regent area", async (access) => {
    const { user, onPasswordChangeRequired, onAuthorized } = setup(access);

    await enter(user);

    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(onPasswordChangeRequired).not.toHaveBeenCalled();
  });

  it.each<RegentAccess>([{ status: "forbidden" }, { status: "unauthenticated" }])(
    "signs out a session without portal access and shows no private detail",
    async (access) => {
      const { user, signOut, onPasswordChangeRequired, onAuthorized } = setup(access);

      await enter(user);

      expect(signOut).toHaveBeenCalledOnce();
      expect(screen.getByRole("alert")).toHaveTextContent("Acesso não autorizado.");
      expect(screen.getByLabelText("Senha")).toHaveValue("");
      expect(document.body).not.toHaveTextContent(/SenhaTemp123|membership|userId/i);
      expect(onPasswordChangeRequired).not.toHaveBeenCalled();
      expect(onAuthorized).not.toHaveBeenCalled();
    },
  );

  it("keeps invalid credentials generic and does not inspect portal access", async () => {
    const access: RegentAccess = { status: "authorized", role: "admin" };
    const signIn = vi.fn().mockResolvedValue({ error: new Error("SECRET_AUTH_DETAIL") });
    const { user, checkAccess, signOut, onAuthorized } = setup(access, { signIn });

    await enter(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique suas credenciais.",
    );
    expect(document.body).not.toHaveTextContent("SECRET_AUTH_DETAIL");
    expect(checkAccess).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});
