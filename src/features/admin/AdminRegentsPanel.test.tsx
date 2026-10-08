import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminRegentsPanel, type AdminRegentsPanelProps } from "./AdminRegentsPanel";

const choirId = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  choirId,
  userId: "user-1",
  name: "Maria",
  email: "maria@example.com",
  revokedAt: null,
  passwordChangeRequired: false,
};
function setup(overrides: Partial<AdminRegentsPanelProps> = {}) {
  const props: AdminRegentsPanelProps = {
    choirs: [{ id: choirId, name: "Coro Quixadá" }],
    loadRegents: vi.fn(async () => [row]),
    createRegent: vi.fn(async () => ({ status: "success" as const, regent: row })),
    replaceRegent: vi.fn(async () => ({ status: "success" as const, regent: row })),
    revokeRegent: vi.fn(async () => ({
      status: "success" as const,
      regent: { ...row, revokedAt: "2026-09-11" },
    })),
    resetPassword: vi.fn(async () => ({
      status: "success" as const,
      regent: { ...row, passwordChangeRequired: true },
    })),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<AdminRegentsPanel {...props} />) };
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome"), "Ana Silva");
  await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await user.selectOptions(screen.getByLabelText("Coro"), choirId);
  await user.type(screen.getByLabelText("Senha temporária"), "SenhaTemp123");
}
describe("AdminRegentsPanel", () => {
  it("shows the no-email workflow and all lifecycle actions", async () => {
    setup();
    expect(await screen.findByText("Maria")).toBeInTheDocument();
    for (const label of ["Nome", "E-mail", "Coro", "Senha temporária"])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum e-mail será enviado/)).toBeInTheDocument();
    for (const name of ["Cadastrar regente", "Substituir", "Inativar", "Redefinir senha"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });
  it("offers the existing-user mode without requesting a temporary password", async () => {
    const { user } = setup();
    await screen.findByText("Maria");

    await user.click(screen.getByRole("button", { name: "Vincular usuário existente" }));

    expect(screen.getByRole("button", { name: "Vincular usuário existente" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText("Senha temporária")).not.toBeInTheDocument();
    expect(
      screen.getByText(/usará a senha que já possui e não precisará trocá-la/i),
    ).toBeInTheDocument();
  });
  it("submits only identity data when linking an existing user", async () => {
    const linkExistingRegent = vi.fn(async () => ({
      status: "success" as const,
      regent: { ...row, passwordChangeRequired: false },
    }));
    const { user } = setup({
      linkExistingRegent,
    } as Partial<AdminRegentsPanelProps>);
    await screen.findByText("Maria");

    await user.click(screen.getByRole("button", { name: "Vincular usuário existente" }));
    await user.type(screen.getByLabelText("Nome"), "Irmã Macrina");
    await user.type(screen.getByLabelText("E-mail"), "macrina@example.com");
    await user.selectOptions(screen.getByLabelText("Coro"), choirId);
    await user.click(screen.getByRole("button", { name: "Vincular regente" }));

    await waitFor(() =>
      expect(linkExistingRegent).toHaveBeenCalledWith({
        data: { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
      }),
    );
  });
  it("preserves all entered values after a recoverable conflict", async () => {
    const { user, props } = setup({
      createRegent: vi.fn(async () => ({
        status: "conflict" as const,
        message: "Já existe uma conta com esse e-mail.",
      })),
    });
    await screen.findByText("Maria");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar regente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma conta com esse e-mail.",
    );
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Silva");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Coro")).toHaveValue(choirId);
    expect(screen.getByLabelText("Senha temporária")).toHaveValue("SenhaTemp123");
    expect(props.createRegent).toHaveBeenCalledWith({
      data: { choirId, name: "Ana Silva", email: "ana@example.com", password: "SenhaTemp123" },
    });
  });
  it("requires confirmation before replacing a regent and preserves the draft on failure", async () => {
    const { user, props } = setup({
      replaceRegent: vi.fn(async () => ({
        status: "error" as const,
        message: "Não foi possível substituir o regente.",
      })),
    });
    await screen.findByText("Maria");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Substituir" }));
    expect(props.replaceRegent).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Maria");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar substituição" }));
    await waitFor(() =>
      expect(props.replaceRegent).toHaveBeenCalledWith({
        data: { choirId, name: "Ana Silva", email: "ana@example.com", password: "SenhaTemp123" },
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível substituir");
    expect(screen.getByLabelText("Senha temporária")).toHaveValue("SenhaTemp123");
  });
  it("requires confirmation before inactivation and allows cancelling", async () => {
    const { user, props } = setup();
    await user.click(await screen.findByRole("button", { name: "Inativar" }));
    expect(props.revokeRegent).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
    );
    expect(props.revokeRegent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Inativar" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar inativação" }),
    );
    await waitFor(() => expect(props.revokeRegent).toHaveBeenCalledWith({ data: { id: row.id } }));
    expect(await screen.findByText("Inativo")).toBeInTheDocument();
  });
  it("resets the selected membership with an entered temporary password", async () => {
    const { user, props } = setup();
    await user.click(await screen.findByRole("button", { name: "Redefinir senha" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nova senha temporária"), "OutraSenha123");
    await user.click(within(dialog).getByRole("button", { name: "Salvar senha" }));
    await waitFor(() =>
      expect(props.resetPassword).toHaveBeenCalledWith({
        data: { id: row.id, password: "OutraSenha123" },
      }),
    );
    expect(await screen.findByText("Troca de senha obrigatória")).toBeInTheDocument();
  });
});
