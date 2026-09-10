import { render, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

function renderLandingPage(search: string) {
  window.history.replaceState({}, "", `/${search}`);
  const IndexPage = Route.options.component!;
  return render(<IndexPage />);
}

function expectSharedHeroContent(hero: HTMLElement) {
  const heroQueries = within(hero);

  expect(
    heroQueries.getByRole("heading", {
      level: 1,
      name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    }),
  ).toBeInTheDocument();
  expect(heroQueries.getByText("20 a 22 de novembro de 2026")).toBeInTheDocument();
  expect(heroQueries.getByText("Quixadá, CE")).toBeInTheDocument();
  expect(heroQueries.getByText("Coralistas, Instrumentistas e Regentes")).toBeInTheDocument();
  expect(heroQueries.getByRole("link", { name: /faça sua inscrição/i })).toBeInTheDocument();
  expect(heroQueries.getByRole("link", { name: "Programação" })).toBeInTheDocument();
  expect(
    heroQueries.getByRole("img", {
      name: "Identidade visual do II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    }),
  ).toBeInTheDocument();
}

describe("landing page hero prototypes", () => {
  it.each(["fundo", "total", "colunas"])(
    "keeps comfortable responsive side gutters in the %s prototype",
    async (prototype) => {
      const { container } = renderLandingPage(`?hero=${prototype}`);

      const hero = await waitFor(() =>
        container.querySelector<HTMLElement>(`[data-hero-prototype="${prototype}"]`),
      );
      const frame = hero!.querySelector<HTMLElement>("[data-hero-frame]");

      expect(frame).toHaveClass("px-5", "sm:px-8", "lg:px-12");
      if (prototype === "fundo") {
        expect(hero!.querySelector("[data-hero-visuals]")).toHaveClass("lg:right-12");
      }
    },
  );

  it("renders the immersive background prototype", async () => {
    const { container } = renderLandingPage("?hero=fundo");

    const hero = await waitFor(() =>
      container.querySelector<HTMLElement>('[data-hero-prototype="fundo"]'),
    );

    expect(hero).not.toBeNull();
    expect(hero!.querySelector('[data-hero-photo-position="background"]')).not.toBeNull();
    expectSharedHeroContent(hero!);
  });

  it("renders the full-hero background prototype with the same content", async () => {
    const { container } = renderLandingPage("?hero=total");

    const hero = await waitFor(() =>
      container.querySelector<HTMLElement>('[data-hero-prototype="total"]'),
    );

    expect(hero).not.toBeNull();
    expect(hero!.querySelector('[data-hero-photo-position="full-background"]')).not.toBeNull();
    expectSharedHeroContent(hero!);
  });

  it("renders the full-background two-column prototype", async () => {
    const { container } = renderLandingPage("?hero=colunas");

    const hero = await waitFor(() =>
      container.querySelector<HTMLElement>('[data-hero-prototype="colunas"]'),
    );

    expect(hero).not.toBeNull();
    expect(hero).toHaveAttribute("data-hero-layout", "two-columns");
    expect(hero!.querySelector('[data-hero-photo-position="full-background"]')).not.toBeNull();
    expect(hero!.querySelector("[data-hero-copy]")).not.toContainElement(
      hero!.querySelector("[data-hero-visuals]"),
    );
    expectSharedHeroContent(hero!);
  });

  it("keeps the desktop actions with the logo and removes the column divider", async () => {
    const { container } = renderLandingPage("?hero=colunas");

    const hero = await waitFor(() =>
      container.querySelector<HTMLElement>('[data-hero-prototype="colunas"]'),
    );
    const visuals = hero!.querySelector<HTMLElement>("[data-hero-visuals]");
    const actions = hero!.querySelector<HTMLElement>("[data-hero-actions]");

    expect(visuals).toContainElement(actions);
    expect(within(visuals!).getByRole("link", { name: /faça sua inscrição/i })).toBeInTheDocument();
    expect(within(visuals!).getByRole("link", { name: "Programação" })).toBeInTheDocument();
    expect(visuals).not.toHaveClass("lg:border-l");
  });

  it("discards the upper-right prototype and falls back to the retained proposal", async () => {
    const { container } = renderLandingPage("?hero=canto");

    await waitFor(() => {
      expect(container.querySelector('[data-hero-prototype="fundo"]')).not.toBeNull();
    });

    expect(container.querySelector('[data-hero-prototype="canto"]')).toBeNull();
    expect(container.querySelector('[data-hero-photo-position="upper-right"]')).toBeNull();
  });
});
