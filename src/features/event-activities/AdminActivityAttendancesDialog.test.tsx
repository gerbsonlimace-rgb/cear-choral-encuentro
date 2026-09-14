import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminActivityAttendancesDialog } from "./AdminActivityAttendancesDialog";

describe("AdminActivityAttendancesDialog", () => {
  it("shows recorded location and opens the exact point on the map", async () => {
    render(
      <AdminActivityAttendancesDialog
        open
        activity={{ id: "activity", title: "Conferência", attendanceCount: 1 }}
        onOpenChange={vi.fn()}
        loadAttendances={vi.fn().mockResolvedValue([{
          id: "attendance",
          participantName: "Maria Silva",
          checkedInAt: "2026-11-21T12:01:00Z",
          latitude: -4.9708,
          longitude: -39.0167,
          accuracyMeters: 18,
          distanceMeters: 24,
        }])}
      />,
    );
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText(/24 m/)).toBeInTheDocument();
    expect(screen.getByText(/precisão 18 m/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir localização no mapa" })).toHaveAttribute(
      "href", "https://www.google.com/maps?q=-4.9708,-39.0167",
    );
  });
});
