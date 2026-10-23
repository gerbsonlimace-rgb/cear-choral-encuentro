import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminNavigation } from "./AdminNavigation";
import { getPortalModes } from "@/lib/portal-access.functions";

vi.mock("@/lib/portal-access.functions", () => ({ getPortalModes: vi.fn() }));

describe("AdminNavigation", () => {
  it("offers the signed-in administrator a profile menu with password change", async () => {
    vi.mocked(getPortalModes).mockResolvedValueOnce({ admin: true, participant: false, regent: false });
    const user = userEvent.setup();
    render(<AdminNavigation current="summary" />);

    await user.click(within(screen.getByTestId("internal-topbar")).getByRole("button", { name: "Meu perfil" }));
    await user.click(screen.getByRole("menuitem", { name: "Alterar senha" }));

    expect(screen.getByRole("dialog", { name: "Alterar senha" })).toBeInTheDocument();
    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar nova senha")).toBeInTheDocument();
  });

  it("offers participant mode in the shared topbar when both accesses are available", async () => {
    vi.mocked(getPortalModes).mockResolvedValueOnce({ admin: true, participant: true, regent: false });
    const navigateTo = vi.fn();
    render(<AdminNavigation current="summary" navigateTo={navigateTo} />);
    const topbar = screen.getByTestId("internal-topbar");
    expect(
      within(topbar).getByRole("img", { name: "Logo do II Encontro de Coros" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(await within(topbar).findByRole("link", { name: "Ir para participante" }));
    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/participante");
  });
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
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "href",
      "/admin/atividades",
    );
    expect(screen.queryByRole("link", { name: "Integrações" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Avisos" })).toHaveAttribute("href", "/admin/avisos");
    expect(screen.getByTestId("internal-topbar")).toHaveClass("bg-brand-ink");
    expect(screen.getByTestId("internal-sidebar")).toHaveClass("md:flex");
    expect(screen.getByTestId("internal-sidebar")).toHaveClass("bg-brand-ink");
    expect(
      screen.getByRole("navigation", { name: "Navegação móvel de Administração" }),
    ).toHaveClass("bg-brand-ink");
    expect(screen.getAllByTestId("internal-mobile-primary-item")).toHaveLength(4);
    await user.click(link);

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/coros");
  });

  it("groups secondary administration destinations under Mais", async () => {
    const navigateTo = vi.fn();
    const user = userEvent.setup();
    render(<AdminNavigation current="summary" navigateTo={navigateTo} />);

    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = screen.getByRole("dialog", { name: "Mais opções de Administração" });
    await user.click(within(sheet).getByRole("link", { name: "Documentos" }));

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/documentos");
  });

  it("marks the summary as the current administrative section", () => {
    render(<AdminNavigation current="summary" />);

    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
  });
});
