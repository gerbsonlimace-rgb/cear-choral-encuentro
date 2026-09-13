import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminSummaryPage } from "./AdminSummaryPage";

describe("AdminSummaryPage", () => {
  it("shows the administrative overview after validating access", async () => {
    const checkAccess = vi.fn().mockResolvedValue({ status: "authorized" });
    const loadSummary = vi.fn().mockResolvedValue({
      total: 18,
      paid: 12,
      pending: 5,
      legacy: 1,
      receivedCents: 150_000,
      pendingCents: 50_000,
      pendingRegentCents: 0,
      expectedCents: 200_000,
      byChoir: [],
    });

    render(<AdminSummaryPage checkAccess={checkAccess} loadSummary={loadSummary} />);

    expect(await screen.findByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(checkAccess).toHaveBeenCalledOnce();
    expect(loadSummary).toHaveBeenCalledOnce();
  });

  it("does not request the summary without administrator access", async () => {
    const loadSummary = vi.fn();

    render(
      <AdminSummaryPage
        checkAccess={vi.fn().mockResolvedValue({ status: "anonymous" })}
        loadSummary={loadSummary}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o resumo administrativo.",
    );
    expect(loadSummary).not.toHaveBeenCalled();
  });
});
