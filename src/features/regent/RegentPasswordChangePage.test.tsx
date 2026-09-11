import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RegentAccess } from "./regent.domain";
import { RegentPasswordChangePage } from "./RegentPasswordChangePage";

vi.mock("@/lib/regent.functions", () => ({
  changeRegentPassword: vi.fn(),
  completeRegentPasswordChange: vi.fn(),
  getRegentAccess: vi.fn(),
}));

const gatedAccess: RegentAccess = {
  status: "password_change_required",
  role: "regent",
  choirId: "11111111-1111-4111-8111-111111111111",
};
function setup(overrides = {}) {
  const props = {
    checkAccess: vi.fn().mockResolvedValue(gatedAccess),
    changePassword: vi.fn().mockResolvedValue({ status: "success" }),
    completeChange: vi.fn().mockResolvedValue({ status: "not_ready" }),
    getEmail: vi.fn(async () => "private@example.com"),
    signIn: vi.fn(async () => ({ error: null })),
    onCompleted: vi.fn(),
    onAuthorized: vi.fn(),
    onLoginRequired: vi.fn(),
    ...overrides,
  };
  const view = render(<RegentPasswordChangePage {...props} />);
  return { ...props, ...view, user: userEvent.setup() };
}

async function submitPasswords(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) {
  await user.type(await screen.findByLabelText("Nova senha"), password);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Alterar senha" }));
}

describe("RegentPasswordChangePage access gate", () => {
  it("renders the form only after access resolves to password_change_required", async () => {
    const { checkAccess, completeChange } = setup();

    expect(screen.getByText("Verificando acesso…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Nova senha")).toBeInTheDocument();
    expect(checkAccess).toHaveBeenCalledOnce();
    expect(completeChange).toHaveBeenCalledOnce();
  });

  it("completes an Auth-proven operation on entry without a client token", async () => {
    const completeChange = vi.fn().mockResolvedValue({ status: "success" });
    const { onCompleted } = setup({ completeChange });

    await vi.waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());

    expect(completeChange).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });

  it.each<RegentAccess>([
    { status: "authorized", role: "admin" },
    {
      status: "authorized",
      role: "regent",
      choirId: "11111111-1111-4111-8111-111111111111",
    },
  ])("redirects already-authorized portal users to the regent area", async (access) => {
    const { onAuthorized, onLoginRequired } = setup({
      checkAccess: vi.fn().mockResolvedValue(access),
    });

    await act(async () => {});

    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(onLoginRequired).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });

  it.each<RegentAccess>([{ status: "unauthenticated" }, { status: "forbidden" }])(
    "redirects sessions without portal access to login",
    async (access) => {
      const { onAuthorized, onLoginRequired } = setup({
        checkAccess: vi.fn().mockResolvedValue(access),
      });

      await act(async () => {});

      expect(onLoginRequired).toHaveBeenCalledOnce();
      expect(onAuthorized).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    },
  );

  it("does not route after a deferred access check resolves following unmount", async () => {
    let resolveAccess!: (access: RegentAccess) => void;
    const checkAccess = vi.fn(
      () =>
        new Promise<RegentAccess>((resolve) => {
          resolveAccess = resolve;
        }),
    );
    const { unmount, onAuthorized, onLoginRequired } = setup({ checkAccess });

    unmount();
    await act(async () => resolveAccess({ status: "authorized", role: "admin" }));

    expect(onAuthorized).not.toHaveBeenCalled();
    expect(onLoginRequired).not.toHaveBeenCalled();
  });
});

describe("RegentPasswordChangePage password flow", () => {
  it.each([
    ["1234567", "1234567", "Use pelo menos 8 caracteres."],
    ["SenhaNova123", "OutraSenha123", "As senhas precisam ser iguais."],
  ])(
    "validates matching passwords with at least eight characters",
    async (password, confirmation, message) => {
      const { user, changePassword, completeChange } = setup();

      await submitPasswords(user, password, confirmation);

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(changePassword).not.toHaveBeenCalled();
      expect(completeChange).toHaveBeenCalledOnce();
    },
  );

  it("sends the password once to the protected change operation", async () => {
    const { user, changePassword, completeChange, onCompleted } = setup();

    await submitPasswords(user, "SenhaNova123");

    expect(changePassword).toHaveBeenCalledExactlyOnceWith("SenhaNova123");
    expect(completeChange).toHaveBeenCalledOnce();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("keeps a confirmed password rejection editable and does not enter recovery", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    const { user, changePassword, completeChange, onCompleted } = setup({
      changePassword: vi.fn().mockResolvedValue({ status: "rejected" }),
      signIn,
    });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent(/SenhaNova123|SECRET_AUTH_DETAIL/);
    expect(changePassword).toHaveBeenCalledExactlyOnceWith("SenhaNova123");
    expect(completeChange).toHaveBeenCalledOnce();
    expect(signIn).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nova senha")).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Tentar restaurar acesso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar concluir novamente" }),
    ).not.toBeInTheDocument();
  });

  it("retries completion without a client token after Auth already changed", async () => {
    const completeChange = vi
      .fn()
      .mockResolvedValueOnce({ status: "not_ready" })
      .mockResolvedValueOnce({ status: "not_ready" })
      .mockResolvedValueOnce({ status: "success" });
    const { user, changePassword, onCompleted } = setup({
      changePassword: vi.fn(async () => ({ status: "recovery_required" as const })),
      completeChange,
    });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sua senha foi alterada, mas não foi possível liberar o acesso.",
    );
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/SenhaNova123|SECRET_DATABASE_DETAIL/);

    await user.click(screen.getByRole("button", { name: "Tentar concluir novamente" }));

    expect(changePassword).toHaveBeenCalledExactlyOnceWith("SenhaNova123");
    expect(completeChange).toHaveBeenCalledTimes(3);
    expect(completeChange).toHaveBeenLastCalledWith();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("does not run callbacks or apply deferred password results after unmount", async () => {
    let resolveChange!: (result: { status: "success" }) => void;
    const changePassword = vi.fn(
      () =>
        new Promise<{ status: "success" }>((resolve) => {
          resolveChange = resolve;
        }),
    );
    const { user, unmount, onCompleted, completeChange } = setup({ changePassword });

    void submitPasswords(user, "SenhaNova123");
    await vi.waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    unmount();
    await act(async () => resolveChange({ status: "success" }));

    expect(onCompleted).not.toHaveBeenCalled();
    expect(completeChange).toHaveBeenCalledOnce();
  });

  it("restores a valid browser session after Auth invalidates the temporary session", async () => {
    const getEmail = vi.fn(async () => "private@example.com");
    const signIn = vi.fn(async () => ({ error: null }));
    const { user, changePassword, onCompleted } = setup({ getEmail, signIn });

    await submitPasswords(user, "SenhaNova123");

    expect(changePassword).toHaveBeenCalledWith("SenhaNova123");
    expect(signIn).toHaveBeenCalledExactlyOnceWith("private@example.com", "SenhaNova123");
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("recovers a lost successful change response without a client operation secret", async () => {
    const completeChange = vi
      .fn()
      .mockResolvedValueOnce({ status: "not_ready" })
      .mockResolvedValueOnce({ status: "success" });
    const signIn = vi.fn(async () => ({ error: null }));
    const { user, changePassword, onCompleted } = setup({
      getEmail: vi.fn(async () => "private@example.com"),
      signIn,
      changePassword: vi.fn().mockRejectedValue(new TypeError("transport lost")),
      completeChange,
    });

    await submitPasswords(user, "SenhaNova123");

    expect(completeChange).toHaveBeenCalledTimes(2);
    expect(completeChange).toHaveBeenLastCalledWith();
    expect(changePassword).toHaveBeenCalledOnce();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("retries only session restoration after a transient browser Auth failure", async () => {
    const completeChange = vi
      .fn()
      .mockResolvedValueOnce({ status: "not_ready" as const })
      .mockResolvedValueOnce({ status: "success" as const });
    const signIn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("browser transport lost"))
      .mockResolvedValueOnce({ error: null });
    const { user, changePassword, onCompleted } = setup({
      signIn,
      changePassword: vi.fn().mockRejectedValue(new TypeError("transport lost")),
      completeChange,
    });

    await submitPasswords(user, "SenhaNova123");
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar restaurar acesso" }));

    expect(signIn).toHaveBeenCalledTimes(2);
    expect(changePassword).toHaveBeenCalledOnce();
    expect(completeChange).toHaveBeenCalledTimes(2);
    expect(completeChange).toHaveBeenLastCalledWith();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("restores the editable form without replay when new credentials are confirmed absent", async () => {
    const changePassword = vi.fn().mockRejectedValue(new TypeError("transport lost"));
    const signIn = vi.fn().mockResolvedValue({ error: { code: "invalid_credentials" } });
    const { user, completeChange, onCompleted } = setup({ changePassword, signIn });

    await submitPasswords(user, "SenhaNova123");

    expect(changePassword).toHaveBeenCalledExactlyOnceWith("SenhaNova123");
    expect(signIn).toHaveBeenCalledOnce();
    expect(completeChange).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Nova senha")).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Tentar restaurar acesso" }),
    ).not.toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("retries the same server-bound candidate without re-entry after an unapplied unknown result", async () => {
    const changePassword = vi
      .fn()
      .mockResolvedValueOnce({ status: "recovery_required" })
      .mockResolvedValueOnce({ status: "success" });
    const signIn = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "invalid_credentials" } })
      .mockResolvedValueOnce({ error: null });
    const { user, onCompleted } = setup({ changePassword, signIn });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByLabelText("Nova senha")).toHaveValue("SenhaNova123");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("SenhaNova123");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(changePassword.mock.calls).toEqual([["SenhaNova123"], ["SenhaNova123"]]);
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(onCompleted).toHaveBeenCalledOnce();
  });
});
