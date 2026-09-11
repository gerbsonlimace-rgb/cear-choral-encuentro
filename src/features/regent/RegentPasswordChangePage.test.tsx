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
const retryToken = "a".repeat(64);

function setup(overrides = {}) {
  const props = {
    checkAccess: vi.fn().mockResolvedValue(gatedAccess),
    changePassword: vi.fn().mockResolvedValue({ status: "success" }),
    completeChange: vi.fn().mockResolvedValue({ status: "success" }),
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
    const { checkAccess } = setup();

    expect(screen.getByText("Verificando acesso…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Nova senha")).toBeInTheDocument();
    expect(checkAccess).toHaveBeenCalledOnce();
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
      expect(completeChange).not.toHaveBeenCalled();
    },
  );

  it("sends the password once to the protected change operation", async () => {
    const { user, changePassword, completeChange, onCompleted } = setup();

    await submitPasswords(user, "SenhaNova123");

    expect(changePassword).toHaveBeenCalledExactlyOnceWith("SenhaNova123");
    expect(completeChange).not.toHaveBeenCalled();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("keeps protected change failures generic", async () => {
    const { user, completeChange, onCompleted } = setup({
      changePassword: vi.fn().mockRejectedValue(new Error("SECRET_AUTH_DETAIL")),
    });

    await submitPasswords(user, "SenhaNova123");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent(/SenhaNova123|SECRET_AUTH_DETAIL/);
    expect(completeChange).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("retries completion with only the server proof after Auth already changed", async () => {
    const completeChange = vi.fn().mockResolvedValue({ status: "success" });
    const { user, changePassword, onCompleted } = setup({
      changePassword: vi.fn().mockResolvedValue({
        status: "completion_required",
        retryToken,
      }),
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
    expect(completeChange).toHaveBeenCalledExactlyOnceWith(retryToken);
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

    await submitPasswords(user, "SenhaNova123");
    unmount();
    await act(async () => resolveChange({ status: "success" }));

    expect(onCompleted).not.toHaveBeenCalled();
    expect(completeChange).not.toHaveBeenCalled();
  });
});
