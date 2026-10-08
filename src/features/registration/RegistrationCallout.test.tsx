import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { RegistrationCallout } from "./RegistrationCallout";

function getRegistrationSection() {
  const section = document.querySelector<HTMLElement>("#inscricao");
  if (!section) throw new Error("Registration section was not rendered");
  return section;
}

describe("RegistrationCallout", () => {
  it("presents each modality with the investment block, context label, and selection action", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const event = within(registration).getByRole("article", { name: "Inscrição no evento" });
    const raffle = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação com rifas",
    });
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });

    expect(within(event).getByText("PARTICIPAÇÃO INDIVIDUAL")).toBeVisible();
    expect(within(event).getByText("Sem custos de hospedagem inclusos")).toBeVisible();
    expect(within(event).getByRole("link", { name: "Selecionar este tipo de inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
    expect(within(raffle).getByText("EXPERIÊNCIA COMPLETA SUBSIDIADA")).toBeVisible();
    expect(within(raffle).getByText("20 Rifas Cobrem o Resto")).toBeVisible();
    expect(within(raffle).getByText("Como funciona o subsídio")).toBeVisible();
    expect(within(raffle).getByRole("link", { name: "Selecionar este tipo de inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
    expect(within(complete).getByText("SEM GESTÃO DE RIFAS")).toBeVisible();
    expect(within(complete).getByText("Valor total único")).toBeVisible();
    expect(within(complete).getByText(/à vista ou até 3x/)).toBeVisible();
  });

  it("starts with the event-only registration and its participation benefits", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const event = within(registration).getByRole("article", {
      name: "Inscrição no evento",
    });
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });
    const giveaway = within(registration).getByRole("region", {
      name: "Sorteio especial para inscrições até 30 de setembro",
    });

    expect(
      event.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      complete.compareDocumentPosition(giveaway) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(event).getByRole("heading", { name: "Inscrição no Evento" })).toBeVisible();
    expect(within(event).getByText("Acesso integral a todas as formações litúrgicas")).toBeVisible();
    expect(within(event).getByText("Kit oficial do participante com partituras impressas")).toBeVisible();
    expect(within(event).getByText("Certificado de participação diocesano (horas acadêmicas)")).toBeVisible();
    expect(
      within(event).queryByText(/Alimentação e hospedagem são detalhes não incluídos/),
    ).not.toBeInTheDocument();
  });

  it("orders the public registration cards by entry price and explains the raffle commitment", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const event = within(registration).getByRole("article", {
      name: "Inscrição no evento",
    });
    const raffle = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação com rifas",
    });
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });

    expect(
      event.compareDocumentPosition(raffle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      raffle.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(raffle).getByText("Como funciona o subsídio")).toBeVisible();
    expect(within(raffle).getByText(/as vendas cobrem integralmente os R\$ 200,00 restantes/i)).toBeVisible();
    expect(within(raffle).getByText("R$ 100,00")).toBeVisible();
    expect(within(raffle).getByText(/20 rifas paroquiais/i)).toBeVisible();
    expect(within(raffle).getByText(/R\$ 200,00/i)).toBeVisible();
  });

  it("keeps the card headers focused on the participation titles", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();

    expect(within(registration).queryByText("Participação no evento")).not.toBeInTheDocument();
    expect(within(registration).queryByText("Programa de rifas")).not.toBeInTheDocument();
    expect(within(registration).queryByText("Participação com estadia")).not.toBeInTheDocument();
  });

  it("makes the participation and payment differences scannable inside each card", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const event = within(registration).getByRole("article", {
      name: "Inscrição no evento",
    });
    const raffle = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação com rifas",
    });
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });

    expect(within(event).getByTestId("registration-option-summary")).toHaveTextContent(
      "Acesso às formações, kit e certificado oficial",
    );
    expect(within(raffle).getByTestId("registration-option-summary")).toHaveTextContent(
      "Entrada facilitada com programa diocesano de rifas",
    );
    expect(within(complete).getByTestId("registration-option-summary")).toHaveTextContent(
      "Pagamento integral direto (sem necessidade de venda de rifas)",
    );
    expect(within(raffle).getByText(/Você paga apenas R\$ 100 agora/)).toBeVisible();
    expect(within(raffle).getByText(/20 rifas paroquiais de R\$ 10.*R\$ 200,00 restantes/i)).toBeVisible();
  });

  it("explains the complete stay modality without payment mechanics", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });

    expect(
      within(complete).getByRole("heading", { name: "Inscrição + Hospedagem e Alimentação" }),
    ).toBeVisible();
    expect(within(complete).getByText("Valor total único")).toBeVisible();
    expect(within(complete).getByText("R$ 300,00")).toBeVisible();
    expect(within(complete).getByText("Hospedagem no Centro Diocesano de Pastoral")).toBeVisible();
    expect(within(complete).getByText("Alimentação completa durante todos os dias (pensão total)")).toBeVisible();
    expect(within(complete).getByText("Acesso a todas as formações, ensaios gerais, kit e certificado")).toBeVisible();
    expect(within(complete).queryByText(/R\$ 100 agora/)).not.toBeInTheDocument();
  });

  it("separates the primary action and lays out the giveaway as a horizontal card", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const options = registration.querySelector<HTMLElement>(".public-registration-options");
    const primaryAction = registration.querySelector<HTMLElement>(
      "[data-registration-primary-action]",
    );
    const giveaway = registration.querySelector<HTMLElement>(
      '[aria-label^="Sorteio especial"]',
    );

    expect(options).not.toBeNull();
    expect(registration.querySelector(".public-registration-title")).not.toBeNull();
    expect(registration.querySelector(".public-registration-intro")).not.toBeNull();
    expect(registration.querySelector(".public-registration-option")).not.toBeNull();
    expect(primaryAction).not.toBeNull();
    expect(
      options!.compareDocumentPosition(primaryAction!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(primaryAction!).getByRole("link", { name: "Fazer Inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
    expect(giveaway).not.toBeNull();
    expect(
      primaryAction!.compareDocumentPosition(giveaway!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(giveaway!).getByLabelText("Livros do sorteio")).toBeVisible();
    expect(giveaway!.querySelector(".public-giveaway-books")).not.toBeNull();
    expect(giveaway!.querySelector(".public-giveaway-action")).not.toBeNull();
    expect(within(giveaway!).getByRole("link", { name: "Fazer Inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
  });

  it("marks the registration prices for the prototype numeric type treatment", () => {
    render(<RegistrationCallout />);

    const prices = Array.from(
      getRegistrationSection().querySelectorAll<HTMLElement>(".public-registration-price"),
    );

    expect(prices).toHaveLength(3);
    expect(prices.map((price) => price.textContent?.trim())).toEqual([
      "R$ 80,00",
      "R$ 100,00",
      "R$ 300,00",
    ]);
  });

  it("uses the neutral registration CTA that points to the form", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const giveaway = within(registration).getByRole("region", {
      name: "Sorteio especial para inscrições até 30 de setembro",
    });
    const cta = within(giveaway).getByRole("link", { name: "Fazer Inscrição" });

    expect(cta).toHaveAttribute("href", "/inscricao");
    expect(within(registration).queryByRole("region", { name: "Ação de inscrição" })).toBeNull();
  });
});
