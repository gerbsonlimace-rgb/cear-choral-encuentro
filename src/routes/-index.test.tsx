import { render, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";

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

describe("landing page program", () => {
  it("presents Programação as the section heading", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const program = document.querySelector<HTMLElement>("#programacao");
    expect(program).not.toBeNull();

    expect(
      within(program!).getByRole("heading", { level: 2, name: "Programação" }),
    ).toBeInTheDocument();
  });

  it("visually identifies every activity by its type", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const program = document.querySelector<HTMLElement>("#programacao");
    expect(program).not.toBeNull();
    const content = within(program!);

    expect(content.getAllByRole("img", { name: "Acolhimento" })).toHaveLength(4);
    expect(content.getAllByRole("img", { name: "Celebração" })).toHaveLength(10);
    expect(content.getAllByRole("img", { name: "Refeição" })).toHaveLength(16);
    expect(content.getAllByRole("img", { name: "Conferência" })).toHaveLength(8);
    expect(content.getAllByRole("img", { name: "Música" })).toHaveLength(8);
    expect(content.getAllByRole("img", { name: "Visita" })).toHaveLength(2);
  });

  it("labels activities without an announced time instead of leaving the time blank", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const program = document.querySelector<HTMLElement>("#programacao");
    expect(program).not.toBeNull();
    const content = within(program!);

    expect(content.getAllByText("Completas")).toHaveLength(2);
    expect(content.getAllByText("Visita ao Santuário")).toHaveLength(2);
    expect(content.getAllByText("Jantar", { selector: "h4" })).toHaveLength(4);
    expect(content.getAllByText("Na sequência")).toHaveLength(6);
  });
});

describe("landing page hero", () => {
  it("uses the choir gathering photo as the hero backdrop", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    expect(
      within(document.querySelector<HTMLElement>("main")!).getByRole("img", {
        name: "Participantes do Encontro de Coros reunidos diante da igreja",
      }),
    ).toBeInTheDocument();
  });

  it("presents the complete official event name", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    expect(
      within(document.querySelector<HTMLElement>("main")!).getByRole("heading", {
        level: 1,
        name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
      }),
    ).toBeInTheDocument();
  });

  it("identifies the event date and city as primary event information", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const eventInformation = document.querySelector<HTMLElement>(
      '[aria-label="Informações principais do evento"]',
    );
    expect(eventInformation).not.toBeNull();
    const content = within(eventInformation!);

    expect(content.getByText("Data")).toBeInTheDocument();
    expect(content.getByText("20 a 22 de novembro de 2026")).toBeInTheDocument();
    expect(content.getByText("Cidade")).toBeInTheDocument();
    expect(content.getByText("Quixadá, CE")).toBeInTheDocument();
  });

  it("keeps the decorative quotation marks close to the quotation content", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const quotation = within(document.querySelector<HTMLElement>("main")!)
      .getByText("Cantai para o Senhor um canto novo,")
      .closest("blockquote");

    expect(quotation).not.toBeNull();
    expect(quotation).toHaveClass("w-fit");
    expect(quotation).not.toHaveClass("w-full");
  });
});

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

describe("landing page sponsors", () => {
  it("renders the institutional partners and the published sponsor", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const section = document.querySelector<HTMLElement>("#patrocinadores");
    expect(section).not.toBeNull();
    const content = within(section!);

    expect(
      content.getByRole("heading", { name: "Instituições que conduzem o encontro" }),
    ).toBeInTheDocument();
    expect(content.getByRole("img", { name: "Unicatolica" })).toBeInTheDocument();
  });
});
