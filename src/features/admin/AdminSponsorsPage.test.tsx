import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminSponsor } from "@/features/sponsors/sponsor.domain";
import { MAX_SPONSOR_LOGO_BYTES } from "@/features/sponsors/sponsor.domain";
import { AdminSponsorsPage } from "./AdminSponsorsPage";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTES = Uint8Array.from(atob(PNG_BASE64), (character) => character.charCodeAt(0));

const sponsor: AdminSponsor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Universidade Católica",
  logoPath: "unicatolica.png",
  logoUrl: "https://example.test/unicatolica.png",
  isActive: true,
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
};

function setup(overrides: Partial<React.ComponentProps<typeof AdminSponsorsPage>> = {}) {
  const props: React.ComponentProps<typeof AdminSponsorsPage> = {
    onSignedOut: vi.fn(),
    onMissingSession: vi.fn(),
    checkAdmin: vi.fn(async () => ({
      status: "authorized" as const,
      userId: "admin-1",
      email: "admin@example.com",
    })),
    loadSponsors: vi.fn(async () => []),
    createSponsor: vi.fn(async ({ data }) => ({
      ...sponsor,
      name: data.name,
      isActive: data.isActive,
    })),
    updateSponsor: vi.fn(async ({ data }) => ({ ...sponsor, ...data })),
    setSponsorActive: vi.fn(async ({ data }) => ({ ...sponsor, isActive: data.isActive })),
    getSession: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
  return { user: userEvent.setup(), props, ...render(<AdminSponsorsPage {...props} />) };
}

describe("AdminSponsorsPage", () => {
  it("shows the empty administrative state and sponsor navigation", async () => {
    setup();

    expect(await screen.findByRole("heading", { name: "Patrocinadores" })).toBeInTheDocument();
    expect(await screen.findByText("Nenhum patrocinador cadastrado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patrocinadores" })).toHaveAttribute(
      "href",
      "/admin/patrocinadores",
    );
  });

  it("creates an active sponsor with the selected logo", async () => {
    const createSponsor = vi.fn(async ({ data }) => ({
      ...sponsor,
      name: data.name,
      isActive: data.isActive,
    }));
    const { user } = setup({ createSponsor });

    await user.click(await screen.findByRole("button", { name: "Cadastrar patrocinador" }));
    await user.type(screen.getByLabelText("Nome do patrocinador"), "Nova empresa");
    await user.upload(
      screen.getByLabelText("Logo do patrocinador"),
      new File([PNG_BYTES], "logo.png", { type: "image/png" }),
    );
    expect(
      await screen.findByRole("img", { name: "Pré-visualização da logo" }),
    ).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Salvar patrocinador" });
    expect(saveButton).toBeEnabled();
    expect(screen.getByLabelText("Nome do patrocinador")).toBeValid();
    expect(screen.getByLabelText("Logo do patrocinador")).toBeValid();
    expect(saveButton.closest("form")).not.toBeNull();
    expect(saveButton.closest("form")!.checkValidity()).toBe(true);
    await user.click(saveButton);

    await waitFor(() =>
      expect(createSponsor).toHaveBeenCalledWith({
        data: {
          name: "Nova empresa",
          isActive: true,
          logo: { base64: PNG_BASE64, mimeType: "image/png" },
        },
      }),
    );
    expect(await screen.findByText("Patrocinador cadastrado.")).toBeInTheDocument();
  });

  it("edits the name without requiring a replacement logo", async () => {
    const updateSponsor = vi.fn(async ({ data }) => ({ ...sponsor, ...data }));
    const { user } = setup({
      loadSponsors: vi.fn(async () => [sponsor]),
      updateSponsor,
    });

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Nome do patrocinador"));
    await user.type(screen.getByLabelText("Nome do patrocinador"), "Nome atualizado");
    await user.click(screen.getByRole("button", { name: "Salvar patrocinador" }));

    await waitFor(() =>
      expect(updateSponsor).toHaveBeenCalledWith({
        data: {
          id: sponsor.id,
          name: "Nome atualizado",
          isActive: true,
        },
      }),
    );
  });

  it("asks for confirmation before inactivating a sponsor", async () => {
    const setSponsorActive = vi.fn(async ({ data }) => ({ ...sponsor, isActive: data.isActive }));
    const { user } = setup({
      loadSponsors: vi.fn(async () => [sponsor]),
      setSponsorActive,
    });

    await user.click(await screen.findByRole("button", { name: "Inativar" }));
    expect(setSponsorActive).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar inativação" }));

    await waitFor(() =>
      expect(setSponsorActive).toHaveBeenCalledWith({
        data: { id: sponsor.id, isActive: false },
      }),
    );
  });

  it("shows an oversized-logo error inside the open dialog", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Cadastrar patrocinador" }));
    await user.upload(
      screen.getByLabelText("Logo do patrocinador"),
      new File([new Uint8Array(MAX_SPONSOR_LOGO_BYTES + 1)], "logo.png", {
        type: "image/png",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("A logo deve ter no máximo 5 MB.");
    expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
  });

  it("keeps the draft and shows a save failure inside the dialog", async () => {
    const { user } = setup({
      createSponsor: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    await user.click(await screen.findByRole("button", { name: "Cadastrar patrocinador" }));
    await user.type(screen.getByLabelText("Nome do patrocinador"), "Nova empresa");
    await user.upload(
      screen.getByLabelText("Logo do patrocinador"),
      new File([PNG_BYTES], "logo.png", { type: "image/png" }),
    );
    await screen.findByRole("img", { name: "Pré-visualização da logo" });
    await user.click(screen.getByRole("button", { name: "Salvar patrocinador" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar o patrocinador.",
    );
    expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
    expect(screen.getByLabelText("Nome do patrocinador")).toHaveValue("Nova empresa");
  });
});
