import { render, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & {
      children: ReactNode;
      to: string;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselNext: () => null,
  CarouselPrevious: () => null,
}));

import { Route } from "./index";

describe("Quixadá city spots", () => {
  it("presents Catedral Jesus, Maria e José as a place to visit", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const quixadaSection = document.querySelector<HTMLElement>("#quixada");
    expect(quixadaSection).not.toBeNull();
    const content = within(quixadaSection!);

    expect(
      content.getByRole("heading", {
        level: 3,
        name: "Catedral Jesus, Maria e José",
      }),
    ).toBeInTheDocument();
    expect(content.getByRole("img", { name: "Catedral Jesus, Maria e José" })).toBeInTheDocument();
  });
});
