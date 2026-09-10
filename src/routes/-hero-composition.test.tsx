import { render, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; to: string }) => (
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

beforeAll(() => {
  window.matchMedia = (query) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

describe("landing page hero composition", () => {
  it("keeps the focused group and lower logo in layers separate from the title", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const heading = within(document.querySelector<HTMLElement>("main")!).getByRole("heading", {
      level: 1,
      name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    });
    const hero = heading.closest("section");
    expect(hero).not.toBeNull();

    const groupLayer = hero!.querySelector<HTMLElement>('[data-hero-photo-position="upper-right"]');
    const logoLayer = hero!.querySelector<HTMLElement>('[data-hero-logo-position="lower-right"]');

    expect(groupLayer).not.toBeNull();
    expect(groupLayer).not.toContainElement(heading);
    expect(
      within(groupLayer!).getByRole("img", {
        name: "Participantes do Encontro de Coros reunidos diante da igreja",
      }),
    ).toBeInTheDocument();

    expect(logoLayer).not.toBeNull();
    expect(logoLayer).not.toContainElement(groupLayer);
    expect(within(hero!).getByText("Coralistas, Instrumentistas e Regentes")).toBeInTheDocument();
  });
});
