import { render, screen } from "@testing-library/react";
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
    await user.click(link);

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/coros");
    expect(screen.queryByRole("link", { name: "Área dos regentes" })).not.toBeInTheDocument();
  });

  it("shows the approved seven menus in order and marks Programação", () => {
    render(<AdminNavigation current="activities" />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Resumo", "Inscrições", "Coros", "Programação", "Patrocinadores", "Documentos", "Configurações",
    ]);
    expect(screen.getByRole("link", { name: "Programação" })).toHaveAttribute("aria-current", "page");
  });
});
