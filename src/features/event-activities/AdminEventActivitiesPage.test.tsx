import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminEventActivitiesPage } from "./AdminEventActivitiesPage";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function dependencies() {
  return {
    loadActivities: vi.fn().mockResolvedValue([]),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    generateQr: vi.fn(),
    regenerateQr: vi.fn(),
    downloadQrPdf: vi.fn().mockResolvedValue({ base64: "AA==", filename: "qr.pdf" }),
    listAttendances: vi.fn().mockResolvedValue([]),
  };
}

describe("AdminEventActivitiesPage", () => {
  it("reveals geofence fields only after both QR and location flags are enabled", async () => {
    const user = userEvent.setup();
    render(<AdminEventActivitiesPage {...dependencies()} />);
    await screen.findByText("Nenhuma atividade cadastrada.");
    await user.click(screen.getByRole("button", { name: "Cadastrar atividade" }));
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Controlar presença por QR Code" }));
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Verificar local" }));
    expect(screen.getByLabelText("Latitude")).toBeRequired();
    expect(screen.getByLabelText("Longitude")).toBeRequired();
    expect(screen.getByLabelText("Raio permitido em metros")).toBeRequired();
  });

  it("offers the collective QR PDF action", async () => {
    render(<AdminEventActivitiesPage {...dependencies()} />);
    expect(await screen.findByRole("button", { name: "Baixar PDF dos QR Codes" })).toBeDisabled();
  });
});
