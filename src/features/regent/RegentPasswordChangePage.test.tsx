import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegentPasswordChangePage } from "./RegentPasswordChangePage";

vi.mock("@/lib/regent.functions", () => ({ completeRegentPasswordChange: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

function setup(overrides = {}) {
  const props = {
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    completeChange: vi.fn().mockResolvedValue({ status: "success" }),
    onCompleted: vi.fn(),
    ...overrides,
  };
  render(<RegentPasswordChangePage {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function submitPasswords(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) {
  await user.type(screen.getByLabelText("Nova senha"), password);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Alterar senha" }));
}

describe("RegentPasswordChangePage", () => {
  it.each([
    ["1234567", "1234567", "Use pelo menos 8 caracteres."],
    ["SenhaNova123", "OutraSenha123", "As senhas precisam ser iguais."],
  ])(
    "validates matching passwords with at least eight characters",
    async (password, confirmation, message) => {
      const { user, updatePassword, completeChange } = setup();

      await submitPasswords(user, password, confirmation);

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(updatePassword).not.toHaveBeenCalled();
      expect(completeChange).not.toHaveBeenCalled();
    },
  );

  it("updates Auth before completing the database password gate", async () => {
    const { user, updatePassword, completeChange, onCompleted } = setup();

    await submitPasswords(user, "SenhaNova123");

    expect(updatePassword).toHaveBeenCalledExactlyOnceWith({ password: "SenhaNova123" });
    expect(completeChange).toHaveBeenCalledOnce();
    expect(vi.mocked(updatePassword).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(completeChange).mock.invocationCallOrder[0],
    );
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("does not complete the database gate when the Auth update fails", async () => {
    const { user, completeChange, onCompleted } = setup({
      updatePassword: vi.fn().mockResolvedValue({ error: new Error("SECRET_AUTH_DETAIL") }),
    });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent(/SenhaNova123|SECRET_AUTH_DETAIL/);
    expect(completeChange).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("retries only database completion after Auth already changed the password", async () => {
    const completeChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("SECRET_DATABASE_DETAIL"))
      .mockResolvedValueOnce({ status: "success" });
    const { user, updatePassword, onCompleted } = setup({ completeChange });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sua senha foi alterada, mas não foi possível liberar o acesso.",
    );
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/SenhaNova123|SECRET_DATABASE_DETAIL/);

    await user.click(screen.getByRole("button", { name: "Tentar concluir novamente" }));

    expect(updatePassword).toHaveBeenCalledOnce();
    expect(completeChange).toHaveBeenCalledTimes(2);
    expect(onCompleted).toHaveBeenCalledOnce();
  });
});
