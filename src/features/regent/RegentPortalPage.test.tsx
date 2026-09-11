import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegentPortalPage } from "./RegentPortalPage";

describe("RegentPortalPage", () => {
  it("renders the four summary cards and does not put search in URL", async () => {
    const list = vi.fn(async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }));
    const summary = vi.fn(async () => ({
      totalParticipants: 2,
      eligibleComplementCents: 10000,
      confirmedComplementCents: 4000,
      outstandingComplementCents: 6000,
    }));
    render(
      <RegentPortalPage
        access={{
          status: "authorized",
          role: "regent",
          choirId: "11111111-1111-4111-8111-111111111111",
        }}
        list={list as never}
        summary={summary as never}
      />,
    );
    await waitFor(() => expect(screen.getByText("Total de participantes")).toBeInTheDocument());
    expect(screen.getByText("Complemento total")).toBeInTheDocument();
    expect(screen.getByText("Complemento confirmado")).toBeInTheDocument();
    expect(screen.getByText("Saldo complementar")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
