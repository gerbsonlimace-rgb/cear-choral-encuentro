import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("uses the router callback for internal navigation while keeping accessible hrefs", async () => {
    const navigateTo = vi.fn();
    const user = userEvent.setup();
    render(<AdminNavigation current="registrations" navigateTo={navigateTo} />);

    const link = screen.getByRole("link", { name: "Coros e valores" });
    expect(link).toHaveAttribute("href", "/admin/coros");
    await user.click(link);

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/admin/coros");
  });
});
