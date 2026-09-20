import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarDays, FileText, Home, Music2, UserRound } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { InternalAppShell } from "./InternalAppShell";

const navItems = [
  { id: "home", label: "Início", icon: Home },
  { id: "songs", label: "Cantos", icon: Music2 },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "profile", label: "Meu perfil", description: "Conta e acesso", icon: UserRound },
] as const;

const fourPrimaryNavItems = [
  ...navItems.slice(0, 3),
  { id: "programme", label: "Programação", icon: CalendarDays },
  navItems[3],
] as const;

describe("InternalAppShell", () => {
  it("exposes the complete desktop navigation and marks the active destination", () => {
    render(
      <InternalAppShell
        moduleLabel="Participante"
        navItems={navItems}
        activeId="songs"
        onNavigate={vi.fn()}
      >
        <p>Conteúdo</p>
      </InternalAppShell>,
    );

    const desktopNavigation = screen.getByRole("navigation", {
      name: "Navegação de Participante",
    });
    expect(within(desktopNavigation).getByRole("button", { name: /início/i })).toBeInTheDocument();
    expect(within(desktopNavigation).getByRole("button", { name: /meu perfil/i })).toBeInTheDocument();
    expect(within(desktopNavigation).getByRole("button", { name: /cantos/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("img", { name: "Logo do II Encontro de Coros" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("internal-topbar")).toHaveClass("bg-brand-ink");
    expect(desktopNavigation.closest("aside")).toHaveClass("bg-brand-ink");
  });

  it("shows three primary mobile destinations and opens secondary destinations in Mais", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <InternalAppShell
        moduleLabel="Participante"
        navItems={navItems}
        activeId="home"
        onNavigate={onNavigate}
      >
        <p>Conteúdo</p>
      </InternalAppShell>,
    );

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação móvel de Participante",
    });
    expect(within(mobileNavigation).getAllByTestId("internal-mobile-primary-item")).toHaveLength(3);
    expect(mobileNavigation).toHaveClass("bg-brand-ink");
    expect(within(mobileNavigation).getByRole("button", { name: /mais/i })).toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole("button", { name: /meu perfil/i })).not.toBeInTheDocument();

    await user.click(within(mobileNavigation).getByRole("button", { name: /mais/i }));
    const sheet = await screen.findByRole("dialog", { name: "Mais opções de Participante" });
    await user.click(within(sheet).getByRole("button", { name: /meu perfil/i }));

    expect(onNavigate).toHaveBeenCalledWith("profile");
  });

  it("supports four configured primary mobile destinations before Mais", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <InternalAppShell
        moduleLabel="Participante"
        navItems={fourPrimaryNavItems}
        mobilePrimaryCount={4}
        activeId="home"
        onNavigate={onNavigate}
      >
        <p>Conteúdo</p>
      </InternalAppShell>,
    );

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação móvel de Participante",
    });
    expect(
      within(mobileNavigation)
        .getAllByTestId("internal-mobile-primary-item")
        .map((button) => button.textContent),
    ).toEqual(["Início", "Cantos", "Documentos", "Programação"]);
    await user.click(within(mobileNavigation).getByRole("button", { name: /mais/i }));
    const sheet = await screen.findByRole("dialog", { name: "Mais opções de Participante" });
    await user.click(within(sheet).getByRole("button", { name: /meu perfil/i }));

    expect(onNavigate).toHaveBeenCalledWith("profile");
  });
});
