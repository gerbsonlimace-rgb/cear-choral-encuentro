import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";

const { getPublicEventProgrammeMock, programmeFixture } = vi.hoisted(() => {
  const programmeFixture = {
    status: "ready" as const,
    activities: [
      {
        id: "1",
        title: "Credenciamento",
        activityDate: "2026-11-20",
        startsAt: "16:00",
        endsAt: "18:00",
        location: null,
        description: null,
        category: "welcome" as const,
        sortOrder: 10,
      },
      {
        id: "2",
        title: "Completas",
        activityDate: "2026-11-20",
        startsAt: null,
        endsAt: null,
        location: null,
        description: null,
        category: "celebration" as const,
        sortOrder: 20,
      },
      {
        id: "3",
        title: "Jantar",
        activityDate: "2026-11-20",
        startsAt: "18:30",
        endsAt: null,
        location: null,
        description: null,
        category: "meal" as const,
        sortOrder: 30,
      },
      {
        id: "4",
        title: "Conferência",
        activityDate: "2026-11-21",
        startsAt: "09:00",
        endsAt: "10:00",
        location: null,
        description: null,
        category: "conference" as const,
        sortOrder: 10,
      },
      {
        id: "5",
        title: "Ensaio",
        activityDate: "2026-11-21",
        startsAt: "11:30",
        endsAt: null,
        location: null,
        description: null,
        category: "music" as const,
        sortOrder: 20,
      },
      {
        id: "6",
        title: "Visita",
        activityDate: "2026-11-21",
        startsAt: "16:00",
        endsAt: null,
        location: null,
        description: null,
        category: "visit" as const,
        sortOrder: 30,
      },
    ],
  };
  return {
    getPublicEventProgrammeMock: vi.fn().mockResolvedValue(programmeFixture),
    programmeFixture,
  };
});

vi.mock("@/lib/event-activity.functions", () => ({
  getPublicEventProgramme: getPublicEventProgrammeMock,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({
      options,
      useLoaderData: () => programmeFixture,
    }),
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
  it("loads the public programme endpoint without requiring a portal session", async () => {
    await expect((Route.options.loader as () => Promise<typeof programmeFixture>)()).resolves.toBe(
      programmeFixture,
    );
    expect(getPublicEventProgrammeMock).toHaveBeenCalledOnce();
  });

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

    expect(content.getAllByRole("img", { name: "Acolhimento" })).toHaveLength(2);
    expect(content.getAllByRole("img", { name: "Celebração" })).toHaveLength(2);
    expect(content.getAllByRole("img", { name: "Refeição" })).toHaveLength(2);
    expect(content.getAllByRole("img", { name: "Conferência" })).toHaveLength(2);
    expect(content.getAllByRole("img", { name: "Música" })).toHaveLength(2);
    expect(content.getAllByRole("img", { name: "Visita" })).toHaveLength(2);
  });

  it("labels activities without an announced time instead of leaving the time blank", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const program = document.querySelector<HTMLElement>("#programacao");
    expect(program).not.toBeNull();
    const content = within(program!);

    expect(content.getAllByText("Completas")).toHaveLength(2);
    expect(content.getAllByText("Na sequência")).toHaveLength(2);
  });
});

describe("landing page access", () => {
  it("offers one unified portal access without displacing registration", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    expect(screen.getByRole("link", { name: "Acessar portal" })).toHaveAttribute(
      "href",
      "/acessar",
    );
    expect(screen.getAllByRole("link", { name: "Acessar portal" })).toHaveLength(1);
    const registrationLinks = screen.getAllByRole("link", { name: "Inscrever-se agora" });
    expect(registrationLinks).toHaveLength(3);
    for (const link of registrationLinks) {
      expect(link).toHaveAttribute("href", "/inscricao");
    }
    expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Evento destinado a membros de coros diocesanos e litúrgicos."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Falar com a coordenação pelo WhatsApp/ }),
    ).not.toBeInTheDocument();
  });

  it("presents the included benefits before a full-width registration choice", async () => {
    const user = userEvent.setup();
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const registration = document.querySelector<HTMLElement>("#inscricao");
    expect(registration).not.toBeNull();
    expect(registration!.querySelector("img")).toBeNull();

    expect(
      within(registration!).getByRole("heading", { name: "Faça agora sua inscrição" }),
    ).toBeVisible();
    const benefits = within(registration!).getByRole("list", {
      name: "Benefícios inclusos na inscrição",
    });
    for (const benefit of [
      "Formações e certificado",
      "Alimentação",
      "Hospedagem",
      "Kit do evento",
    ]) {
      expect(within(benefits).getByText(benefit)).toBeVisible();
    }
    expect(
      within(registration!).queryByRole("group", { name: "Formas de pagamento" }),
    ).not.toBeInTheDocument();

    const options = within(registration!).getByRole("radiogroup", {
      name: "Opções de inscrição",
    });
    expect(options.parentElement).toHaveClass("w-full");
    expect(
      benefits.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const integralOption = within(options).getByRole("radio", {
      name: "Inscrição integral",
    });
    const raffleOption = within(options).getByRole("radio", {
      name: "Programa de rifas",
    });
    const integralCard = integralOption.closest("label") ?? integralOption;
    const raffleCard = raffleOption.closest("label") ?? raffleOption;
    expect(integralOption).toBeVisible();
    expect(raffleOption).toBeVisible();
    expect(integralOption).toBeChecked();
    expect(raffleOption).not.toBeChecked();
    await user.click(raffleOption);
    expect(integralOption).not.toBeChecked();
    expect(raffleOption).toBeChecked();
    expect(within(options).getByText("R$ 300,00")).toBeVisible();
    expect(
      within(options).getByText("R$ 100,00 (Agora) + R$ 250,00 até o dia 30/10"),
    ).toBeVisible();
    expect(integralCard).toHaveTextContent("Pix");
    expect(integralCard).toHaveTextContent("5x no cartão");
    expect(within(integralCard).getByText("Simples e rápido")).toBeVisible();
    expect(within(integralCard).getByText("Inscrição confirmada na hora")).toBeVisible();
    expect(within(raffleCard).queryByText("Concorra a R$ 1.000")).not.toBeInTheDocument();
    const raffleSteps = within(raffleCard).getByRole("list", {
      name: "Passo a passo do programa de rifas",
    });
    const steps = within(raffleSteps).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent("Pague agora R$ 100 no Pix ou cartão.");
    expect(steps[1]).toHaveTextContent(
      "Agende com seu regente um momento para receber os blocos de rifas.",
    );
    expect(steps[2]).toHaveTextContent(
      "Venda pelo menos 25 rifas, no valor de R$ 10 cada, e entregue ao seu regente todo o valor arrecadado até 30/10.",
    );
    expect(steps[3]).toHaveTextContent(
      "A venda mínima de 25 rifas é obrigatória para subsidiar e confirmar sua inscrição no evento.",
    );
    expect(steps[3]).toHaveTextContent(
      "O coralista que vender mais rifas ganhará um Pix de R$ 500.",
    );
    expect(steps[4]).toHaveTextContent(
      "O sorteio do prêmio de R$ 1.000 será realizado online no dia 08/11.",
    );
    expect(within(registration!).getByText("Selecione uma opção para comparar.")).toBeVisible();
    expect(within(options).queryByText("Opção A")).not.toBeInTheDocument();
    expect(within(options).queryByText("Opção B")).not.toBeInTheDocument();
  });

  it("gives both registration choices native keyboard behavior and responsive prominence", async () => {
    const user = userEvent.setup();
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const registration = document.querySelector<HTMLElement>("#inscricao");
    expect(registration).not.toBeNull();

    const options = within(registration!).getByRole("radiogroup", {
      name: "Opções de inscrição",
    });
    const integralOption = within(options).getByRole("radio", {
      name: "Inscrição integral",
    });
    const raffleOption = within(options).getByRole("radio", {
      name: "Programa de rifas",
    });
    const integralCard = integralOption.closest("label") ?? integralOption;
    const raffleCard = raffleOption.closest("label") ?? raffleOption;

    expect(options).toHaveClass("grid-cols-1");
    expect(options).not.toHaveClass("md:grid-cols-2");
    expect(integralCard).toHaveClass("w-full");
    expect(raffleCard).toHaveClass("w-full");
    expect(integralOption).toHaveAttribute("type", "radio");
    expect(raffleOption).toHaveAttribute("type", "radio");
    expect(raffleOption).toHaveAttribute("aria-describedby", "raffle-option-summary");
    expect(within(integralCard).getByText("R$ 300,00")).toHaveClass("text-4xl", "sm:text-5xl");
    expect(
      within(raffleCard).getByText("R$ 100,00 (Agora) + R$ 250,00 até o dia 30/10"),
    ).toHaveClass("text-3xl", "sm:text-4xl");
    expect(raffleOption).toHaveAccessibleDescription(
      "R$ 100,00 (Agora) + R$ 250,00 até o dia 30/10",
    );
    integralOption.focus();
    await user.keyboard("{ArrowRight}");
    expect(raffleOption).toBeChecked();
  });

  it("keeps the mobile header as one navigation surface with a visible brand", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const header = screen.getByRole("banner");
    const brand = within(header).getByRole("img", {
      name: "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    });

    expect(brand).not.toHaveClass("opacity-0");
    expect(within(header).getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Atalhos mobile" })).not.toBeInTheDocument();
  });

  it("opens the mobile menu with section links and portal access", async () => {
    const user = userEvent.setup();
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    await user.click(
      within(screen.getByRole("banner")).getByRole("button", { name: "Abrir menu" }),
    );

    const menu = await screen.findByRole("dialog", { name: "Menu principal" });
    expect(within(menu).getByRole("link", { name: "Sobre" })).toHaveAttribute("href", "#sobre");
    expect(within(menu).getByRole("link", { name: "Programação" })).toHaveAttribute(
      "href",
      "#programacao",
    );
    expect(within(menu).getByRole("link", { name: "Quixadá" })).toHaveAttribute("href", "#quixada");
    expect(within(menu).getByRole("link", { name: "Inscrição" })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    expect(within(menu).getByRole("link", { name: "Acessar portal" })).toHaveAttribute(
      "href",
      "/acessar",
    );
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
  it("presents support, organisation and sponsors as a single area", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const section = document.querySelector<HTMLElement>("#patrocinadores");
    expect(section).not.toBeNull();
    const content = within(section!);

    expect(content.getByRole("heading", { name: "Quem realiza o encontro" })).toBeInTheDocument();
    expect(content.getByRole("img", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
    expect(content.getByRole("img", { name: "Diocese de Quixadá" })).toBeInTheDocument();
    expect(content.queryByRole("img", { name: "Unicatolica" })).not.toBeInTheDocument();
  });

  it("shows organisation and institutional support side by side", () => {
    const IndexPage = Route.options.component!;
    render(<IndexPage />);

    const organisation = screen
      .getByRole("img", { name: "Coro Diocesano de Quixadá" })
      .closest("article");
    const support = screen.getByRole("img", { name: "Diocese de Quixadá" }).closest("article");

    expect(organisation).not.toBeNull();
    expect(support).not.toBeNull();

    const row = organisation!.parentElement!;
    expect(row).toBe(support!.parentElement);
    expect(row.className).toContain("grid");
    expect(row.className).toContain("sm:grid-cols-2");
    expect(within(row as HTMLElement).getAllByRole("article")).toHaveLength(2);

    // Each card is a horizontal strip: logo beside the name, no fixed square box.
    for (const card of within(row as HTMLElement).getAllByRole("article")) {
      expect(card.className).toContain("flex");
      expect(card.className).toContain("items-center");
      expect(card.className).not.toContain("aspect-square");
    }
  });
});
