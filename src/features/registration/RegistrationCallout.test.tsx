import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(within(registration).getByText("Inscrições prorrogadas até 13/11.")).toBeVisible();
    expect(within(event).queryByRole("link", { name: "Selecionar este tipo de inscrição" })).not.toBeInTheDocument();
    expect(within(raffle).getByText("EXPERIÊNCIA COMPLETA SUBSIDIADA")).toBeVisible();
    expect(within(raffle).getByText("20 Rifas Cobrem o Resto")).toBeVisible();
    expect(within(raffle).getByText("Como funciona o subsídio")).toBeVisible();
    expect(within(raffle).getByText("Prêmio da rifa")).toBeVisible();
    expect(within(raffle).getByText("R$ 1.000,00")).toBeVisible();
    expect(within(raffle).getByText("Maior vendedor")).toBeVisible();
    expect(within(raffle).getByText("R$ 500,00")).toBeVisible();
    expect(within(raffle).queryByText(/rifas paroquiais/i)).not.toBeInTheDocument();
    expect(within(raffle).queryByRole("link", { name: "Selecionar este tipo de inscrição" })).not.toBeInTheDocument();
    expect(within(complete).getByText("SEM GESTÃO DE RIFAS")).toBeVisible();
    expect(within(complete).getByText("Valor total único")).toBeVisible();
    expect(within(complete).getByText(/à vista ou até 12x/)).toBeVisible();

    const baseBenefits = [
      "Acesso integral a todas as formações litúrgicas",
      "Kit oficial do participante com partituras impressas",
      "Certificado de participação diocesano (horas acadêmicas)",
    ];
    for (const benefit of baseBenefits) {
      expect(within(event).getByText(benefit)).toBeVisible();
      expect(within(raffle).getByText(benefit)).toBeVisible();
      expect(within(complete).getByText(benefit)).toBeVisible();
    }
    for (const benefit of [
      "Hospedagem no Centro Diocesano de Pastoral",
      "Alimentação completa durante todos os dias (pensão total)",
    ]) {
      expect(within(raffle).getByText(benefit)).toBeVisible();
      expect(within(complete).getByText(benefit)).toBeVisible();
    }
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
    expect(
      event.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING,
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
    expect(within(raffle).getByText(/20 rifas de R\$ 10,00/i)).toBeVisible();
    expect(within(raffle).getAllByText(/R\$ 200,00/i).length).toBeGreaterThan(0);
    expect(within(raffle).getByText(/Envie os R\$ 200,00 arrecadados até 30\/10/i)).toBeVisible();
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
    expect(within(raffle).getByText(/20 rifas de R\$ 10,00.*R\$ 200,00 restantes/i)).toBeVisible();
    expect(within(raffle).getByText(/Envie os R\$ 200,00 arrecadados até 30\/10/i)).toBeVisible();
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
    expect(within(complete).getByText("Acesso integral a todas as formações litúrgicas")).toBeVisible();
    expect(within(complete).getByText("Kit oficial do participante com partituras impressas")).toBeVisible();
    expect(within(complete).getByText("Certificado de participação diocesano (horas acadêmicas)")).toBeVisible();
    expect(within(complete).queryByText(/R\$ 100 agora/)).not.toBeInTheDocument();
  });

  it("separates the primary action and no longer shows the expired book giveaway", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const options = registration.querySelector<HTMLElement>(".public-registration-options");
    const primaryAction = registration.querySelector<HTMLElement>(
      "[data-registration-primary-action]",
    );

    expect(options).not.toBeNull();
    expect(primaryAction).not.toBeNull();
    expect(
      options!.compareDocumentPosition(primaryAction!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(primaryAction!).getByRole("link", { name: "Fazer Inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
    expect(registration.querySelector('[aria-label^="Sorteio especial"]')).toBeNull();
    expect(within(registration).queryByText(/livros exclusivos/)).not.toBeInTheDocument();
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
    const cta = within(registration).getByRole("link", { name: "Fazer Inscrição" });

    expect(cta).toHaveAttribute("href", "/inscricao");
    expect(within(registration).queryByRole("region", { name: "Ação de inscrição" })).toBeNull();
  });

  it("reveals the exact card installment tables for all three amounts", async () => {
    const user = userEvent.setup();
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const event = within(registration).getByRole("article", { name: "Inscrição no evento" });
    const raffle = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação com rifas",
    });
    const complete = within(registration).getByRole("article", {
      name: "Inscrição + hospedagem e alimentação",
    });

    const cases = [
      { card: event, first: "1x de R$ 83,51", last: "12x de R$ 8,00" },
      { card: raffle, first: "1x de R$ 104,39", last: "12x de R$ 10,00" },
      { card: complete, first: "1x de R$ 313,16", last: "12x de R$ 30,00" },
    ];

    for (const { card, first, last } of cases) {
      await user.click(within(card).getByRole("button", { name: "Ver parcelas" }));
      const dialog = await screen.findByRole("dialog");
      const installments = within(dialog).getAllByRole("listitem");
      expect(installments[0]).toHaveTextContent(first);
      expect(installments.at(-1)).toHaveTextContent(last);
      await user.click(within(card).getByRole("button", { name: "Ocultar parcelas" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });
});
