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
  it("puts the registration choices before shared benefits and the giveaway", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const integral = within(registration).getByRole("article", {
      name: "Inscrição Integral",
    });
    const raffle = within(registration).getByRole("article", {
      name: "Programa de Rifas",
    });
    const benefits = within(registration).getByRole("list", {
      name: "Benefícios gerais da inscrição",
    });
    const giveaway = within(registration).getByRole("region", {
      name: "Sorteio especial para inscrições até 30 de setembro",
    });

    expect(
      integral.compareDocumentPosition(benefits) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      raffle.compareDocumentPosition(benefits) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      benefits.compareDocumentPosition(giveaway) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(benefits).getByText("Formações & Certificado")).toBeVisible();
    expect(within(benefits).getByText("Alimentação Completa")).toBeVisible();
    expect(within(benefits).queryByText("Hospedagem Confortável")).not.toBeInTheDocument();
    expect(within(benefits).getByText("Kit com Partituras")).toBeVisible();
  });

  it("keeps the raffle card compact and opens its five-step regulation dialog", async () => {
    const user = userEvent.setup();
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const raffle = within(registration).getByRole("article", {
      name: "Programa de Rifas",
    });

    expect(within(raffle).getByText(/Venda mínima de 25 rifas de R\$ 10/)).toBeVisible();
    expect(within(raffle).getByText(/Prestação de contas até 30\/10 com o regente/)).toBeVisible();
    expect(within(raffle).getByText(/Concorra a R\$ 1\.000 no sorteio/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      within(raffle).getByRole("button", {
        name: /Ver regulamento e etapas das rifas/,
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Regulamento do Programa de Rifas",
    });
    expect(within(dialog).getByText(/Pague R\$ 100 agora/)).toBeVisible();
    expect(within(dialog).getByText(/Agende com seu regente/)).toBeVisible();
    expect(within(dialog).getByText(/Venda pelo menos 25 rifas/)).toBeVisible();
    expect(within(dialog).getByText(/Envie o valor arrecadado/)).toBeVisible();
    expect(within(dialog).getByText(/Sorteio do prêmio de R\$ 1\.000/)).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Entendido, fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("separates the primary action and lays out the giveaway as a horizontal card", () => {
    render(<RegistrationCallout />);

    const registration = getRegistrationSection();
    const options = registration.querySelector<HTMLElement>(".public-registration-options");
    const primaryAction = registration.querySelector<HTMLElement>(
      "[data-registration-primary-action]",
    );
    const benefits = registration.querySelector<HTMLElement>(".public-registration-benefits");
    const giveaway = registration.querySelector<HTMLElement>(
      '[aria-label^="Sorteio especial"]',
    );

    expect(options).not.toBeNull();
    expect(registration.querySelector(".public-registration-title")).not.toBeNull();
    expect(registration.querySelector(".public-registration-intro")).not.toBeNull();
    expect(registration.querySelector(".public-registration-option")).not.toBeNull();
    expect(primaryAction).not.toBeNull();
    expect(benefits).not.toBeNull();
    expect(
      options!.compareDocumentPosition(primaryAction!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      primaryAction!.compareDocumentPosition(benefits!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(primaryAction!).getByRole("link", { name: "Fazer Inscrição" })).toHaveAttribute(
      "href",
      "/inscricao",
    );
    expect(giveaway).not.toBeNull();
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

    expect(prices).toHaveLength(2);
    expect(prices.map((price) => price.textContent?.trim())).toEqual([
      "R$ 300,00",
      "R$ 100,00",
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
