import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EventDocument } from "@/features/event-documents/eventDocument.domain";
import type { AdminEventDocumentBootstrap } from "@/lib/event-document.functions";

import { AdminDocumentsPage } from "./AdminDocumentsPage";

const eventId = "22222222-2222-4222-8222-222222222222";
const documentId = "44444444-4444-4444-8444-444444444444";
const now = "2026-09-12T21:00:00.000Z";
const document: EventDocument = {
  id: documentId,
  eventId,
  eventName: "Grande Concerto",
  title: "Livro de partituras",
  category: "Livro de partituras",
  storagePath: `${eventId}/${documentId}/book.pdf`,
  originalFileName: "livro.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  createdAt: now,
  updatedAt: now,
};
const bootstrap: AdminEventDocumentBootstrap = {
  documents: [document],
};

function setup(overrides: Partial<React.ComponentProps<typeof AdminDocumentsPage>> = {}) {
  const props: React.ComponentProps<typeof AdminDocumentsPage> = {
    loadBootstrap: vi.fn(async () => bootstrap),
    createDocument: vi.fn(async () => document),
    updateDocument: vi.fn(async () => document),
    deleteDocument: vi.fn(async () => ({ cleanupPending: false })),
    getDocumentUrl: vi.fn(async () => ({
      signedUrl: "https://signed.example.test/book.pdf",
      expiresIn: 120,
    })),
    getSession: vi.fn(async () => ({ data: { session: {} }, error: null })),
    openUrl: vi.fn(),
    onMissingSession: vi.fn(),
    navigateTo: vi.fn(),
    ...overrides,
  };
  return { user: userEvent.setup(), props, ...render(<AdminDocumentsPage {...props} />) };
}

describe("AdminDocumentsPage", () => {
  it("lists documents by name and file", async () => {
    setup();

    expect(await screen.findByRole("heading", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Documentos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Livro de partituras")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("creates a document with only a name and PDF even without configured events", async () => {
    const createDocument = vi.fn(async () => ({
      ...document,
      title: "Orientações de hospedagem",
      category: "Hospedagem",
      originalFileName: "hospedagem.pdf",
    }));
    const { user } = setup({ createDocument, loadBootstrap: async () => ({ documents: [] }) });

    await screen.findByRole("heading", { name: "Documentos" });
    await user.click(screen.getByRole("button", { name: "Cadastrar documento" }));
    expect(screen.queryByLabelText("Evento")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Categoria")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome"), "Orientações de hospedagem");
    await user.upload(
      screen.getByLabelText("Arquivo PDF"),
      new File(["%PDF-1.4\n%%EOF"], "hospedagem.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar documento" }));

    await waitFor(() =>
      expect(createDocument).toHaveBeenCalledWith({
        data: {
          title: "Orientações de hospedagem",
          file: {
            base64: expect.any(String),
            mimeType: "application/pdf",
            fileName: "hospedagem.pdf",
          },
        },
      }),
    );
    expect(await screen.findByText("Documento cadastrado.")).toBeInTheDocument();
  });

  it("opens a fresh signed URL and confirms deletion", async () => {
    const openUrl = vi.fn();
    const deleteDocument = vi.fn(async () => ({ cleanupPending: false }));
    const { user } = setup({ openUrl, deleteDocument });

    await screen.findByText("Livro de partituras");
    await user.click(screen.getByRole("button", { name: "Abrir Livro de partituras" }));
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledExactlyOnceWith("https://signed.example.test/book.pdf"),
    );

    await user.click(screen.getByRole("button", { name: "Excluir Livro de partituras" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir documento" }));
    await waitFor(() =>
      expect(deleteDocument).toHaveBeenCalledExactlyOnceWith({ data: { id: documentId } }),
    );
    expect(await screen.findByText("Documento excluído.")).toBeInTheDocument();
  });

  it("reports when only the inaccessible private Storage cleanup remains pending", async () => {
    const { user } = setup({
      deleteDocument: vi.fn(async () => ({ cleanupPending: true })),
    });

    await screen.findByText("Livro de partituras");
    await user.click(screen.getByRole("button", { name: "Excluir Livro de partituras" }));
    await user.click(screen.getByRole("button", { name: "Excluir documento" }));

    expect(
      await screen.findByText("Documento excluído. A limpeza do arquivo privado ficou pendente."),
    ).toBeInTheDocument();
  });
});
