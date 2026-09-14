import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PortalModeSwitch } from "./PortalModeSwitch";

vi.mock("@/lib/portal-access.functions", () => ({ getPortalModes: vi.fn() }));

describe("PortalModeSwitch", () => {
  it.each([
    ["admin", "Ir para participante", "/participante"],
    ["participant", "Ir para admin", "/admin/resumo"],
  ] as const)("switches from %s with one click", async (mode, label, destination) => {
    const navigate = vi.fn();
    render(
      <PortalModeSwitch
        mode={mode}
        onNavigate={navigate}
        loadModes={async () => ({ admin: true, participant: true })}
      />,
    );
    const link = await screen.findByRole("link", { name: label });
    expect(link).toHaveAttribute("href", destination);
    await userEvent.setup().click(link);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(destination);
  });

  it.each([
    { admin: false, participant: true },
    { admin: true, participant: false },
    { admin: false, participant: false },
  ])("does not offer switching without both memberships: %j", async (modes) => {
    await act(async () => {
      render(<PortalModeSwitch mode="admin" loadModes={async () => modes} />);
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides switching while checking and when validation fails", async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<{ admin: boolean; participant: boolean }>((_, fail) => {
      reject = fail;
    });
    render(<PortalModeSwitch mode="participant" loadModes={() => pending} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await act(async () => reject(new Error("unavailable")));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
