import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminSummaryPage } from "./AdminSummaryPage";

describe("AdminSummaryPage", () => {
  it("shows the administrative overview after validating access", async () => {
    const checkAccess = vi.fn().mockResolvedValue({ status: "authorized" });
    const loadSummary = vi.fn().mockResolvedValue({
      total: 20,
      paid: 12,
      pending: 5,
      legacy: 1,
      exempt: 2,
      receivedCents: 150_000,
      pendingCents: 50_000,
      pendingRegentCents: 25_000,
      expectedCents: 200_000,
      byChoir: [
        {
          choirName: "Coro de Quixadá",
          total: 3,
          receivedCents: 150_000,
          pendingCents: 50_000,
          pendingRegentCents: 25_000,
          expectedCents: 200_000,
        },
      ],
    });

    render(<AdminSummaryPage checkAccess={checkAccess} loadSummary={loadSummary} />);

    expect((await screen.findAllByText("R$ 1.500,00")).length).toBeGreaterThan(0);
    const indicators = within(screen.getByRole("region", { name: "Indicadores do encontro" }));
    const receivedTotal = indicators.getByText("Total recebido").closest("article");
    const pendingTotal = indicators.getByText("Pendente taxa de inscrição").closest("article");
    expect(receivedTotal).toHaveTextContent("R$ 1.500,00");
    expect(pendingTotal).toHaveTextContent("R$ 500,00");
    expect(pendingTotal).not.toHaveTextContent("de regentes");
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
    expect(screen.getByText("Inscrições isentas").closest("article")).toHaveTextContent("2");
    const overview = screen.getByRole("region", { name: "Visão geral das inscrições" });
    expect(within(overview).getByText("Financeiro por coro/diocese")).toBeInTheDocument();
    expect(within(overview).getByText("Coro de Quixadá")).toBeInTheDocument();
    expect(within(overview).getByText("Total previsto").parentElement).toHaveTextContent(
      "R$ 2.000,00",
    );
    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main")).toHaveClass(
      "internal-app",
      "pt-20",
      "md:pl-[calc(15rem+1.5rem)]",
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
