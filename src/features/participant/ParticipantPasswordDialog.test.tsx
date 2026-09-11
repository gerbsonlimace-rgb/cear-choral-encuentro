import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { ParticipantPasswordDialog } from "./ParticipantPasswordDialog";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

type DialogOverrides = Partial<{
  getSignedInEmail: () => Promise<{ email: string | null; error: unknown }>;
  reauthenticate: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  updatePassword: (password: string) => Promise<{ error: unknown }>;
}>;

function Host({ overrides = {} }: { overrides?: DialogOverrides }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reabrir
      </button>
      <ParticipantPasswordDialog
        open={open}
        onOpenChange={setOpen}
        getSignedInEmail={
          overrides.getSignedInEmail ??
          vi.fn().mockResolvedValue({ email: "sessao@example.com", error: null })
        }
        reauthenticate={overrides.reauthenticate ?? vi.fn().mockResolvedValue({ error: null })}
        updatePassword={overrides.updatePassword ?? vi.fn().mockResolvedValue({ error: null })}
      />
    </>
  );
}

function setup(overrides: DialogOverrides = {}) {
  const props = {
    getSignedInEmail: vi.fn().mockResolvedValue({ email: "sessao@example.com", error: null }),
    reauthenticate: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  render(<Host overrides={props} />);
  return { ...props, user: userEvent.setup() };
}

async function fillPasswords(
  user: ReturnType<typeof userEvent.setup>,
  currentPassword = "senha-atual",
  newPassword = "nova-senha",
  confirmation = newPassword,
) {
  await user.type(screen.getByLabelText("Senha atual"), currentPassword);
  await user.type(screen.getByLabelText("Nova senha"), newPassword);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
}

describe("ParticipantPasswordDialog", () => {
  it("shows a safe current-password error and never attempts the update", async () => {
    const reauthenticate = vi.fn().mockResolvedValue({ error: { code: "invalid_credentials" } });
    const { user, updatePassword } = setup({ reauthenticate });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha atual incorreta.");
    expect(document.body).not.toHaveTextContent("invalid_credentials");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("keeps non-credential reauthentication failures generic", async () => {
    const reauthenticate = vi
      .fn()
      .mockResolvedValue({ error: new Error("PRIVATE_REAUTH_NETWORK_DETAIL") });
    const { user, updatePassword } = setup({ reauthenticate });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_REAUTH_NETWORK_DETAIL");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("stops with a generic failure when the verified session has no email", async () => {
    const getSignedInEmail = vi.fn().mockResolvedValue({ email: null, error: null });
    const { user, reauthenticate, updatePassword } = setup({ getSignedInEmail });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(getSignedInEmail).toHaveBeenCalledOnce();
    expect(reauthenticate).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("requires a new password with at least eight characters", async () => {
    const { user, reauthenticate, updatePassword } = setup();

    await fillPasswords(user, "senha-atual", "curta", "curta");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A nova senha deve ter pelo menos 8 caracteres.",
    );
    expect(reauthenticate).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("requires matching new-password confirmation", async () => {
    const { user, reauthenticate, updatePassword } = setup();

    await fillPasswords(user, "senha-atual", "nova-senha", "outra-senha");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(screen.getByRole("alert")).toHaveTextContent("As novas senhas não coincidem.");
    expect(reauthenticate).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("waits for current-password proof before updating the password", async () => {
    const calls: string[] = [];
    const reauthenticate = vi.fn(async () => {
      calls.push("reauthenticate");
      return { error: null };
    });
    const updatePassword = vi.fn(async () => {
      calls.push("update");
      return { error: null };
    });
    const { user } = setup({ reauthenticate, updatePassword });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledOnce());
    expect(calls).toEqual(["reauthenticate", "update"]);
    expect(reauthenticate).toHaveBeenCalledExactlyOnceWith({
      email: "sessao@example.com",
      password: "senha-atual",
    });
    expect(updatePassword).toHaveBeenCalledExactlyOnceWith("nova-senha");
  });

  it("keeps update failures generic and leaves the dialog recoverable", async () => {
    const updatePassword = vi
      .fn()
      .mockResolvedValue({ error: new Error("PRIVATE_AUTH_PROVIDER_DETAIL") });
    const { user } = setup({ updatePassword });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível alterar a senha. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_AUTH_PROVIDER_DETAIL");
    expect(screen.getByRole("dialog", { name: "Alterar senha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alterar senha" })).toBeEnabled();
  });

  it("prevents duplicate submission while reauthentication is pending", async () => {
    let resolveReauthentication: ((result: { error: null }) => void) | undefined;
    const reauthenticate = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveReauthentication = resolve;
        }),
    );
    const { user, getSignedInEmail, updatePassword } = setup({ reauthenticate });
    await fillPasswords(user);
    const form = screen.getByRole("button", { name: "Alterar senha" }).closest("form");
    if (!form) throw new Error("Password form not found");

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(getSignedInEmail).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Alterando…" })).toBeDisabled();
    expect(updatePassword).not.toHaveBeenCalled();

    await waitFor(() => expect(reauthenticate).toHaveBeenCalledOnce());

    resolveReauthentication?.({ error: null });
    await waitFor(() => expect(updatePassword).toHaveBeenCalledOnce());
  });

  it("blocks every dialog close request while reauthentication is pending", async () => {
    let resolveReauthentication: ((result: { error: null }) => void) | undefined;
    const reauthenticate = vi.fn(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveReauthentication = resolve;
        }),
    );
    const { user, updatePassword } = setup({ reauthenticate });
    await fillPasswords(user);

    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { name: "Alterar senha" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Alterar senha" })).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();

    resolveReauthentication?.({ error: null });
    await waitFor(() => expect(updatePassword).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Senha alterada com sucesso.");
  });

  it("clears every password field whenever the dialog closes", async () => {
    const { user } = setup();
    await fillPasswords(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Reabrir" }));

    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("");
  });

  it("clears fields, closes, and confirms a successful password change", async () => {
    const { user } = setup();
    await fillPasswords(user);

    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Senha alterada com sucesso.");

    await user.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("");
  });
});
