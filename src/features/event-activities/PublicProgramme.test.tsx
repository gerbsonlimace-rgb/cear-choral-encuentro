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
});
