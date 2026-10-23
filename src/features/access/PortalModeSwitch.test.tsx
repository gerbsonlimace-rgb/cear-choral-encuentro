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
        loadModes={async () => ({ admin: true, participant: true, regent: false })}
      />,
    );
    const link = await screen.findByRole("link", { name: label });
    expect(link).toHaveAttribute("href", destination);
    await userEvent.setup().click(link);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(destination);
  });

  it("offers the choir registrations link to a signed-in regent in participant mode", async () => {
    const navigate = vi.fn();
    render(
      <PortalModeSwitch
        mode="participant"
        onNavigate={navigate}
        loadModes={async () => ({ admin: false, participant: true, regent: true })}
      />,
    );
    const link = await screen.findByRole("link", {
      name: "Ir para as inscrições do meu coro",
    });
    expect(link).toHaveAttribute("href", "/regente");
    await userEvent.setup().click(link);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/regente");
    expect(screen.queryByRole("link", { name: "Ir para admin" })).not.toBeInTheDocument();
  });

  it("hides the choir link in admin mode even when the admin is also a regent", async () => {
    render(
      <PortalModeSwitch
        mode="admin"
        loadModes={async () => ({ admin: true, participant: true, regent: true })}
      />,
    );
    expect(await screen.findByRole("link", { name: "Ir para participante" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para as inscrições do meu coro" }),
    ).not.toBeInTheDocument();
  });

  it("opens a clearly labeled participant preview for an admin without a registration", async () => {
    const navigate = vi.fn();
    render(
      <PortalModeSwitch
        mode="admin"
        onNavigate={navigate}
        loadModes={async () => ({ admin: true, participant: false, regent: false })}
      />,
    );

    const link = await screen.findByRole("link", { name: "Prévia do participante" });
    expect(link).toHaveAttribute("href", "/participante/previa");
    await userEvent.setup().click(link);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/participante/previa");
  });

  it.each([
    { admin: false, participant: true, regent: false },
    { admin: false, participant: false, regent: false },
  ])("does not offer switching without another destination: %j", async (modes) => {
    await act(async () => {
      render(<PortalModeSwitch mode="admin" loadModes={async () => modes} />);
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides switching while checking and when validation fails", async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<{ admin: boolean; participant: boolean; regent: boolean }>(
      (_, fail) => {
        reject = fail;
      },
    );
    render(<PortalModeSwitch mode="participant" loadModes={() => pending} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await act(async () => reject(new Error("unavailable")));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
