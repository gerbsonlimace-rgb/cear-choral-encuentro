import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./AdminLoginPage";

vi.mock("@/lib/admin.functions", () => ({ getAdminAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

function setup(overrides = {}) {
  const props = {
    signIn: vi.fn().mockResolvedValue({ error: null }),
    checkAdmin: vi
      .fn()
      .mockResolvedValue({ status: "authorized", userId: "admin", email: "admin@example.com" }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthorized: vi.fn(),
    ...overrides,
  };
  render(<AdminLoginPage {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function enter(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("E-mail"), "admin@example.com");
  await user.type(screen.getByLabelText("Senha"), "segredo");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("AdminLoginPage", () => {
  it("navigates only after credentials and administrator membership succeed", async () => {
    const { user, signIn, checkAdmin, onAuthorized } = setup();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    await enter(user);
    expect(signIn).toHaveBeenCalledWith({ email: "admin@example.com", password: "segredo" });
    expect(checkAdmin).toHaveBeenCalledOnce();
    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(screen.queryByText(/cadastro|criar conta/i)).not.toBeInTheDocument();
  });

  it("keeps invalid credentials generic and does not check membership", async () => {
    const { user, checkAdmin, onAuthorized } = setup({
      signIn: vi.fn().mockResolvedValue({ error: new Error("User not found SECRET_TOKEN") }),
    });
    await enter(user);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique suas credenciais.",
    );
    expect(document.body).not.toHaveTextContent(/User not found|SECRET_TOKEN/);
    expect(checkAdmin).not.toHaveBeenCalled();
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("offers explicit sign out to signed-in users without membership", async () => {
    const { user, onAuthorized, signOut } = setup({
      checkAdmin: vi.fn().mockResolvedValue({ status: "forbidden" }),
    });
    await enter(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso não autorizado.");
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("disables repeat submits throughout the access check", async () => {
    let resolve!: (value: { status: "forbidden" }) => void;
    const checkAdmin = vi.fn(
      () =>
        new Promise<{ status: "forbidden" }>((done) => {
          resolve = done;
        }),
    );
    const { user, signIn } = setup({ checkAdmin });
    await enter(user);
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Entrando…" }));
    expect(signIn).toHaveBeenCalledOnce();
    await act(async () => resolve({ status: "forbidden" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso não autorizado.");
  });

  it("does not expose a thrown access-check error or navigate", async () => {
    const { user, onAuthorized } = setup({
      checkAdmin: vi.fn().mockRejectedValue(new Error("SECRET_TOKEN internal")),
    });
    await enter(user);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível verificar seu acesso. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("SECRET_TOKEN");
    expect(onAuthorized).not.toHaveBeenCalled();
  });

  it("retains the denied state when sign out fails with generic feedback", async () => {
    const { user } = setup({
      checkAdmin: vi.fn().mockResolvedValue({ status: "forbidden" }),
      signOut: vi.fn().mockResolvedValue({ error: new Error("secret") }),
    });
    await enter(user);
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair. Tente novamente.");
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("secret");
  });
});
