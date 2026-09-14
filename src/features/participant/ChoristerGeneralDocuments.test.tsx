import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoristerGeneralDocuments } from "./ChoristerGeneralDocuments";

const document = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Orientações gerais",
  kind: "document" as const,
  sortOrder: 0,
  signedUrl: "https://assets.example.test/old.pdf",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("general participant documents", () => {
  it("shows and opens a document without any event, renewing its private URL", async () => {
    const user = userEvent.setup();
    const getDocumentUrl = vi.fn(async () => ({
      signedUrl: "https://assets.example.test/fresh.pdf",
      expiresIn: 120,
    }));
    render(
      <ChoristerGeneralDocuments
        loadDocuments={async () => [document]}
        getDocumentUrl={getDocumentUrl}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Orientações gerais" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Abrir$/ }));
    await waitFor(() =>
      expect(screen.getByTitle("PDF Orientações gerais")).toHaveAttribute(
        "src",
        expect.stringContaining("fresh.pdf"),
      ),
    );
    expect(getDocumentUrl).toHaveBeenCalledWith({ data: { id: document.id } });
  });

  it("allows retry after a failed document load", async () => {
    const user = userEvent.setup();
    const loadDocuments = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    render(<ChoristerGeneralDocuments loadDocuments={loadDocuments} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("Nenhum documento geral foi publicado ainda."),
    ).toBeInTheDocument();
  });
});
