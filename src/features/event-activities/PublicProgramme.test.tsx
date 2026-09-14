import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/carousel", () => ({ Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>, CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>, CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
import { PublicProgramme } from "./PublicProgramme";

describe("PublicProgramme", () => {
  it("renders database activities by day and category", () => {
    render(<PublicProgramme result={{ status: "ready", activities: [{ id: "one", title: "Credenciamento", activityDate: "2026-11-20", startsAt: "16:00", endsAt: "18:00", location: null, description: null, category: "welcome", sortOrder: 10 }] }} />);
    expect(screen.getAllByRole("heading", { name: "20 de novembro" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Credenciamento" })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Acolhimento" })).toHaveLength(2);
  });
  it("keeps a programme failure inside the section", () => {
    render(<PublicProgramme result={{ status: "unavailable", activities: [] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar a programação");
  });

  it("derives the published date range from the CRUD activities", () => {
    render(
      <PublicProgramme
        result={{
          status: "ready",
          activities: [
            {
              id: "later",
              title: "Encerramento",
              activityDate: "2027-12-03",
              startsAt: "18:00",
              endsAt: null,
              location: null,
              description: null,
              category: "celebration",
              sortOrder: 20,
            },
            {
              id: "earlier",
              title: "Acolhida",
              activityDate: "2027-12-01",
              startsAt: "08:00",
              endsAt: null,
              location: null,
              description: null,
              category: "welcome",
              sortOrder: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("1–3 DEZ 2027")).toBeInTheDocument();
    expect(
      screen.getByText("Confira as atividades do encontro de 1 a 3 de dezembro de 2027."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/20–22 NOV 2026/)).not.toBeInTheDocument();
  });
});
