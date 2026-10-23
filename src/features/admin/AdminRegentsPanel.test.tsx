import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminRegentsPanel, type AdminRegentsPanelProps } from "./AdminRegentsPanel";

const choirId = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  choirId, userId: "user-1", name: "Maria", email: "maria@example.com",
  revokedAt: null, passwordChangeRequired: false,
};
const found = { userId: "user-9", name: "Irmã Macrina", email: "macrina@example.com" };

function setup(overrides: Partial<AdminRegentsPanelProps> = {}) {
  const props: AdminRegentsPanelProps = {
    choirs: [{ id: choirId, name: "Coro Quixadá" }],
    loadRegents: vi.fn(async () => [row]),
    searchCandidates: vi.fn(async () => [found]),
    linkExistingRegent: vi.fn(async () => ({ status: "success" as const, regent: { ...row, ...found, id: "new-link" } })),
    replaceExistingRegent: vi.fn(async () => ({ status: "success" as const, regent: { ...row, ...found, id: "new-link" } })),
    revokeRegent: vi.fn(async () => ({ status: "success" as const, regent: { ...row, revokedAt: "2026-09-11" } })),
    resetPassword: vi.fn(async () => ({ status: "success" as const, regent: { ...row, passwordChangeRequired: true } })),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<AdminRegentsPanel {...props} />) };
}

async function selectRegent(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Buscar regente existente"), "macrina");
  const results = await screen.findByRole("list", { name: "Regentes encontrados" });
  await user.click(within(results).getByRole("button", { name: /Irmã Macrina/ }));
  await user.selectOptions(screen.getByLabelText("Coro"), choirId);
}

describe("AdminRegentsPanel", () => {
  it("allows only selecting a previously registered regent", async () => {
    const { user, props } = setup();
    await screen.findByText("Maria");
    expect(screen.queryByRole("button", { name: "Cadastrar novo" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha temporária")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Vincular regente" })).toBeDisabled();
    await selectRegent(user);
    expect(props.searchCandidates).toHaveBeenCalledWith({ data: { query: "macrina" } });
    expect(screen.getByLabelText("Nome")).toHaveValue("Irmã Macrina");
    await user.click(screen.getByRole("button", { name: "Vincular regente" }));
    await waitFor(() => expect(props.linkExistingRegent).toHaveBeenCalledWith({
      data: { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
    }));
  });

  it("clears the selection when the search changes", async () => {
    const { user } = setup();
    await screen.findByText("Maria");
    await selectRegent(user);
    await user.type(screen.getByLabelText("Buscar regente existente"), "x");
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Vincular regente" })).toBeDisabled();
  });

  it("confirms replacement with the selected existing regent", async () => {
    const { user, props } = setup();
    await screen.findByText("Maria");
    await selectRegent(user);
    await user.click(screen.getByRole("button", { name: "Substituir" }));
    expect(props.replaceExistingRegent).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar substituição" }));
    await waitFor(() => expect(props.replaceExistingRegent).toHaveBeenCalledWith({
      data: { choirId, name: "Irmã Macrina", email: "macrina@example.com" },
    }));
  });

  it("keeps inactivation and password reset available", async () => {
    const { user, props } = setup();
    await user.click(await screen.findByRole("button", { name: "Redefinir senha" }));
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Nova senha temporária"), "OutraSenha123");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar senha" }));
    await waitFor(() => expect(props.resetPassword).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Inativar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar inativação" }));
    await waitFor(() => expect(props.revokeRegent).toHaveBeenCalledWith({ data: { id: row.id } }));
  });
});
