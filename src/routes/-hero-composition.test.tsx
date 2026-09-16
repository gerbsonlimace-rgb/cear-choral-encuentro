import { render, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({
      options,
      useLoaderData: () => ({ status: "unavailable", activities: [] }),
    }),
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
  expect(heroQueries.getByText("Regentes coralistas e instrumentistas")).toBeInTheDocument();
  expect(heroQueries.getByRole("link", { name: /inscrever-se agora/i })).toBeInTheDocument();
  expect(heroQueries.getByRole("link", { name: "Programação" })).toBeInTheDocument();
  expect(
    heroQueries.getByRole("img", {
      name: "Identidade visual do II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    }),
  ).toBeInTheDocument();
}

describe("landing page hero", () => {
  it.each(["", "?hero=fundo", "?hero=total", "?hero=colunas"])(
    "always renders the retained two-column composition for %s",
    async (search) => {
      const { container } = renderLandingPage(search);

      const hero = await waitFor(() =>
        container.querySelector<HTMLElement>('[data-hero-prototype="colunas"]'),
      );

      expect(hero).not.toBeNull();
      expect(hero).toHaveAttribute("data-hero-layout", "two-columns");
      expect(hero!.querySelector('[data-hero-photo-position="full-background"]')).not.toBeNull();
      expect(hero!.querySelector<HTMLElement>("[data-hero-frame]")).toHaveClass(
        "px-5",
        "sm:px-8",
        "lg:px-12",
      );
      expectSharedHeroContent(hero!);
    },
  );

  it("keeps the call to action with the copy and the logo in a separate visual column", async () => {
    const { container } = renderLandingPage("");

    const hero = await waitFor(() =>
      container.querySelector<HTMLElement>('[data-hero-prototype="colunas"]'),
    );
    const copy = hero!.querySelector<HTMLElement>("[data-hero-copy]");
    const visuals = hero!.querySelector<HTMLElement>("[data-hero-visuals]");
    const actions = hero!.querySelector<HTMLElement>("[data-hero-actions]");

    expect(copy).not.toContainElement(visuals);
    expect(copy).toContainElement(actions);
    expect(visuals).not.toContainElement(actions);
    expect(within(copy!).getByRole("link", { name: /inscrever-se agora/i })).toBeInTheDocument();
    expect(within(copy!).getByRole("link", { name: "Programação" })).toBeInTheDocument();
    expect(visuals).not.toHaveClass("lg:border-l");
  });
});
