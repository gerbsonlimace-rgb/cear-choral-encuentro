import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminEventFeedbackPage } from "./AdminEventFeedbackPage";
import type { AdminFeedbackRow } from "@/features/event-feedback/adminEventFeedback.domain";

vi.mock("./AdminNavigation", () => ({ AdminNavigation: () => <nav>Administração</nav> }));
vi.mock("@/lib/admin-event-feedback.functions", () => ({
  getAdminEventFeedback: vi.fn(),
  exportAdminEventFeedbackPdf: vi
    .fn()
    .mockResolvedValue({ fileName: "resultados.pdf", base64: btoa("%PDF-fixture") }),
}));
const getSession = async () => ({ data: { session: {} }, error: null });
const response: AdminFeedbackRow = {
  submission_id: "one",
  created_at: "2026-11-24T12:00:00Z",
  overall: 5,
  organization: 5,
  formation: 4,
  celebrations: 5,
  venue: 4,
  food: null,
  lodging: null,
  criterion_comments: { formation: "Mais oficinas" },
  suggestion: "Gostei muito",
};

describe("AdminEventFeedbackPage", () => {
  it("shows notes, criterion comments and suggestions, with working filters", async () => {
    render(
      <AdminEventFeedbackPage
        getSession={getSession}
        loadFeedback={async () => [
          response,
          { ...response, submission_id: "two", overall: 2, criterion_comments: {}, suggestion: "" },
        ]}
        onMissingSession={vi.fn()}
      />,
    );
    expect(await screen.findByText("Mais oficinas")).toBeInTheDocument();
    expect(screen.getByText("Gostei muito")).toBeInTheDocument();
    expect(screen.getByText("3,5")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Nota geral"), "2");
    expect(screen.queryByText("Gostei muito")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Somente com comentários"));
    expect(screen.getByText("Nenhuma avaliação corresponde aos filtros.")).toBeInTheDocument();
  });

  it("never requests private data without a session", async () => {
    const loadFeedback = vi.fn();
    const onMissingSession = vi.fn();
    render(
      <AdminEventFeedbackPage
        getSession={async () => ({ data: { session: null }, error: null })}
        loadFeedback={loadFeedback}
        onMissingSession={onMissingSession}
      />,
    );
    await vi.waitFor(() => expect(onMissingSession).toHaveBeenCalledOnce());
    expect(loadFeedback).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("offers retry after denied access or load failure without showing private data", async () => {
    const loadFeedback = vi
      .fn()
      .mockRejectedValueOnce(new Error("Forbidden"))
      .mockResolvedValueOnce([]);
    render(
      <AdminEventFeedbackPage
        getSession={getSession}
        loadFeedback={loadFeedback}
        onMissingSession={vi.fn()}
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Verifique seu acesso/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma avaliação recebida ainda.")).toBeInTheDocument();
  });

  it("discards a prepared report when refreshing the evaluations", async () => {
    render(
      <AdminEventFeedbackPage
        getSession={getSession}
        loadFeedback={async () => [response]}
        onMissingSession={vi.fn()}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Exportar PDF" }));
    expect(await screen.findByRole("button", { name: "Abrir PDF" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByRole("button", { name: "Exportar PDF" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Abrir PDF" })).not.toBeInTheDocument();
  });
});
