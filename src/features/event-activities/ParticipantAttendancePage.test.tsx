import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParticipantAttendancePage } from "./ParticipantAttendancePage";

const dashboard = { attended: 1, required: 2, percentage: 50, activities: [] };

describe("ParticipantAttendancePage", () => {
  it("never requests location when the activity flag is off", async () => {
    const requestPosition = vi.fn();
    const checkIn = vi.fn().mockResolvedValue({ status: "recorded", activityTitle: "Conferência", checkedInAt: "2026-11-21T12:00:00Z", distanceMeters: null });
    render(<ParticipantAttendancePage token="signed" prepare={vi.fn().mockResolvedValue({ activityId: "activity", activityTitle: "Conferência", verifyLocation: false })} checkIn={checkIn} requestPosition={requestPosition} loadDashboard={vi.fn().mockResolvedValue(dashboard)} onBack={vi.fn()} />);
    expect(await screen.findByText("Presença confirmada")).toBeInTheDocument();
    expect(requestPosition).not.toHaveBeenCalled();
    expect(checkIn).toHaveBeenCalledWith({ data: { token: "signed", location: null } });
  });

  it("blocks check-in when required location is denied", async () => {
    const checkIn = vi.fn();
    render(<ParticipantAttendancePage token="signed" prepare={vi.fn().mockResolvedValue({ activityId: "activity", activityTitle: "Conferência", verifyLocation: true })} checkIn={checkIn} requestPosition={vi.fn().mockRejectedValue(new Error("Permita a localização para confirmar a presença."))} loadDashboard={vi.fn().mockResolvedValue(dashboard)} onBack={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Permita a localização");
    expect(checkIn).not.toHaveBeenCalled();
  });
});
