import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("uses the router callback for internal navigation while keeping accessible hrefs", async () => {
    const navigateTo = vi.fn();
    const user = userEvent.setup();
    render(<AdminNavigation current="registrations" navigateTo={navigateTo} />);

    const link = screen.getByRole("link", { name: "Coros" });
    expect(link).toHaveAttribute("href", "/admin/coros");
    expect(screen.getByRole("link", { name: "Inscrições" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute("href", "/admin/resumo");
    expect(screen.getByRole("link", { name: "Documentos" })).toHaveAttribute(
      "href",
      "/admin/documentos",
    );
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/admin/configuracoes",
    );
    expect(screen.getByRole("link", { name: "Programação" })).toHaveAttribute(
      "href",
      "/admin/atividades",
    );
    expect(screen.queryByRole("link", { name: "Integrações" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegação administrativa" }).querySelectorAll("a"),
    ).toHaveLength(7);
    expect(screen.getByTestId("admin-topbar")).toHaveClass("bg-brand-ink");
    expect(screen.getByTestId("admin-sidebar")).toHaveClass("md:flex");
    expect(screen.getAllByTestId("mobile-admin-navigation-item")).toHaveLength(4);
    await user.click(link);

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/coros");
  });

  it("groups secondary administration destinations under Mais", async () => {
    const navigateTo = vi.fn();
    const user = userEvent.setup();
    render(<AdminNavigation current="summary" navigateTo={navigateTo} />);

    await user.click(screen.getByRole("button", { name: "Mais opções administrativas" }));
    const sheet = screen.getByRole("dialog", { name: "Mais opções de Administração" });
    await user.click(within(sheet).getByRole("link", { name: "Documentos" }));

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/documentos");
  });

  it("marks the summary as the current administrative section", () => {
    render(<AdminNavigation current="summary" />);

    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
  });
});
