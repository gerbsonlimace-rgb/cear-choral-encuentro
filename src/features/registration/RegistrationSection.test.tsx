import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicRegistrationConfiguration } from "@/features/choirs/choir-pricing.domain";
import { RegistrationSection } from "./RegistrationSection";
import { saveRegistrationDraft } from "./registration-draft";

const safeUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const quixadaId = "11111111-1111-4111-8111-111111111111";
const sobralId = "22222222-2222-4222-8222-222222222222";
const canindeId = "33333333-3333-4333-8333-333333333333";

const configuration: PublicRegistrationConfiguration = {
  choirs: [
    {
      id: quixadaId,
      name: "Coro Diocesano de Quixadá",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    },
    {
      id: sobralId,
      name: "Coro Diocesano de Sobral",
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    },
    {
      id: canindeId,
      name: "Coro Diocesano de Canindé",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    },
  ],
};
const loadConfiguration = vi.fn(async () => configuration);
const available = vi.fn(async () => ({ cpfTaken: false, emailTaken: false }));

async function fillPersonalData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de nascimento"), "1990-05-20");
  await user.upload(
    screen.getByLabelText("Foto do participante"),
    new File(["photo"], "maria.jpg", { type: "image/jpeg" }),
  );
  await screen.findByText("maria.jpg");
}

async function goToParticipation(user: ReturnType<typeof userEvent.setup>) {
  await fillPersonalData(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Sua participação" });
}

async function fillParticipation(user: ReturnType<typeof userEvent.setup>, choirId = quixadaId) {
  await user.selectOptions(screen.getByLabelText("Coro/Diocese"), choirId);
  await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
}

async function goToReview(
  user: ReturnType<typeof userEvent.setup>,
  choirId = quixadaId,
  raffleChoice: "participate" | "full_price" | null = "participate",
) {
  await goToParticipation(user);
  await fillParticipation(user, choirId);
  if (raffleChoice) {
    await user.click(
      screen.getByLabelText(
        raffleChoice === "participate"
          ? "Quero participar do Programa de Venda de Rifas"
          : "Prefiro pagar a inscrição integral",
      ),
    );
  }
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Confira sua inscrição" });
}

describe("RegistrationSection", { timeout: 10_000 }, () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("starts with a compact three-step form and participant badge header", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    expect(screen.getByRole("heading", { name: "Realize sua inscrição" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você" })).toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    expect(screen.getByLabelText("CPF")).toHaveClass("min-h-11");
    expect(
      Array.from(
        screen
          .getByRole("heading", { name: "Conte-nos quem é você" })
          .closest("fieldset")!
          .querySelectorAll("input"),
      )
        .slice(0, 3)
        .map((input) => input.id),
    ).toEqual(["cpf", "name", "email"]);
    expect(
      Array.from(
        screen
          .getByRole("heading", { name: "Conte-nos quem é você" })
          .closest("fieldset")!
          .querySelectorAll("input"),
      )
        .slice(0, 3)
        .map((input) => input.id),
    ).toEqual(["cpf", "name", "email"]);
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Seus dados");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Participação");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Revisão");
    expect(screen.getByLabelText("Foto do participante")).toBeRequired();
    expect(screen.getByLabelText("Prévia do crachá")).toBeInTheDocument();
    await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(85) 99999-9999");
  });

  it("allows the personal-data fieldset to shrink inside a narrow card", () => {
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(screen.getByLabelText("Nome completo").closest("fieldset")).toHaveClass("min-w-0");
  });

  it("validates the current step before advancing", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe seu nome completo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você" })).toBeInTheDocument();
  });

  it("allows saved registrations to continue without blocking the wizard", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn(async () => ({
      status: "found" as const,
      name: "Maria da Silva",
      email: "maria@example.com",
      phone: "85999999999",
      choirId: quixadaId,
      voicePart: "soprano" as const,
      hasPhoto: true,
      paymentStatus: "pending" as const,
    }));
    render(
      <RegistrationSection
        lookupRegistration={lookup}
        loadConfiguration={loadConfiguration}
      />,
    );
    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(lookup).toHaveBeenCalledWith({ cpf: "52998224725", birthDate: "1990-05-20" });
    expect(await screen.findByRole("heading", { name: "Sua participação" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Retomar pagamento" })).not.toBeInTheDocument();
  });

  it("keeps the choir selected while a slower saved-registration lookup finishes", async () => {
    const user = userEvent.setup();
    let resolveLookup!: (value: {
      status: "found";
      name: string;
      email: string;
      phone: string;
      choirId: string;
      voicePart: "soprano";
      hasPhoto: boolean;
      paymentStatus: "pending";
    }) => void;
    const lookup = vi.fn(
      () =>
        new Promise<Parameters<typeof resolveLookup>[0]>((resolve) => {
          resolveLookup = resolve;
        }),
    );

    render(
      <RegistrationSection
        lookupRegistration={lookup}
        loadConfiguration={loadConfiguration}
      />,
    );
    await fillPersonalData(user);
    await waitFor(() => expect(resolveLookup).toBeTypeOf("function"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Sua participação" });

    const choir = screen.getByLabelText("Coro/Diocese");
    await user.selectOptions(choir, sobralId);
    resolveLookup({
      status: "found",
      name: "Maria da Silva",
      email: "maria@example.com",
      phone: "85999999999",
      choirId: "44444444-4444-4444-8444-444444444444",
      voicePart: "soprano",
      hasPhoto: true,
      paymentStatus: "pending",
    });

    await waitFor(() => expect(choir).toHaveValue(sobralId));
    await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Confira sua inscrição" })).toBeVisible();
    expect(screen.getAllByText("Coro Diocesano de Sobral").length).toBeGreaterThan(0);
  });

  it("returns an inconsistent saved review to the choir selection step", async () => {
    saveRegistrationDraft({
      form: {
        name: "Maria da Silva",
        cpf: "529.982.247-25",
        email: "maria@example.com",
        phone: "(85) 99999-9999",
        birthDate: "1990-05-20",
        choirId: "44444444-4444-4444-8444-444444444444",
        raffleChoice: "full_price",
        voicePart: "soprano",
      },
      photo: { contentType: "image/jpeg", dataBase64: "dGVzdA==" },
      photoFileName: "maria.jpg",
      currentStep: 3,
    });

    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(await screen.findByRole("heading", { name: "Sua participação" })).toBeVisible();
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue("");
    expect(screen.getByText("Selecione um coro/diocese.")).toBeVisible();
  });

  it("loads configured choirs and all musical profiles in participation", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    expect(screen.getByRole("option", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
    const profile = screen.getByLabelText("Perfil musical");
    for (const label of ["Soprano", "Contralto", "Tenor", "Baixo", "Não sei informar"]) {
      expect(within(profile).getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("explains both payment choices before the participant continues", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);

    const choices = screen.getByRole("radiogroup", {
      name: "Como deseja realizar sua inscrição?",
    });
    expect(choices).toHaveTextContent(/Pague R\$ 100,00 agora/);
    expect(choices).toHaveTextContent(/25 rifas/);
    expect(choices).toHaveTextContent(/restante de R\$ 200,00 até 30 de outubro/);
    expect(choices).toHaveTextContent(/vaga será confirmada após esse pagamento/);
    expect(choices).toHaveTextContent(/Pague R\$ 300,00 agora/);
    expect(choices).toHaveTextContent(/Pix ou em até 5x no cartão/);
  });

  it("requires an explicit raffle choice before advancing and focuses the group", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);
    await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const raffleChoice = screen.getByRole("radiogroup", {
      name: "Como deseja realizar sua inscrição?",
    });
    expect(
      screen.getByLabelText("Quero participar do Programa de Venda de Rifas"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Prefiro pagar a inscrição integral")).not.toBeChecked();
    expect(
      await screen.findByText("Escolha como deseja realizar sua inscrição."),
    ).toBeInTheDocument();
    await waitFor(() => expect(raffleChoice).toHaveFocus());
    expect(screen.getByRole("heading", { name: "Sua participação" })).toBeInTheDocument();
  });

  it("shows the raffle pre-registration and remaining balance after the participant opts in", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(summary).toHaveTextContent(/Pré-inscrição agora:\s*R\$ 100,00/);
    expect(summary).toHaveTextContent(/Valor restante:\s*R\$ 200,00/);
    expect(summary).toHaveTextContent(/25 rifas/);
    expect(summary).toHaveTextContent(
      /Sua vaga será confirmada após o pagamento do valor restante/,
    );
    expect(screen.getByText("Programa de rifas").parentElement).toHaveTextContent("Participarei");
  });

  it("shows only the full amount due now when the participant declines the raffle program", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user, quixadaId, "full_price");

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(summary).toHaveTextContent("Valor da inscriçãoR$ 300,00");
    expect(summary).toHaveTextContent(/vaga será confirmada após a confirmação desse pagamento/);
    expect(summary).not.toHaveTextContent("Pré-inscrição agora");
    expect(summary).not.toHaveTextContent("Valor restante");
    expect(screen.getByText("Programa de rifas").parentElement).toHaveTextContent(
      "Pagamento integral",
    );
  });

  it("shows the normal price for a choir without promotion", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), sobralId);
    await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Resumo do valor da inscrição")).toHaveTextContent(
      "Valor da inscriçãoR$ 300,00",
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Como deseja realizar sua inscrição?" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/vender rifas/i)).not.toBeInTheDocument();
  });

  it("preserves an explicit choice between raffle-enabled choirs and resets it after a standard choir", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);

    const choir = screen.getByLabelText("Coro/Diocese");
    await user.selectOptions(choir, quixadaId);
    await user.click(screen.getByLabelText("Prefiro pagar a inscrição integral"));
    await user.selectOptions(choir, canindeId);
    expect(screen.getByLabelText("Prefiro pagar a inscrição integral")).toBeChecked();

    await user.selectOptions(choir, sobralId);
    expect(
      screen.queryByRole("radiogroup", { name: "Como deseja realizar sua inscrição?" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(choir, canindeId);
    expect(
      screen.getByLabelText("Quero participar do Programa de Venda de Rifas"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Prefiro pagar a inscrição integral")).not.toBeChecked();
  });

  it("preserves values when moving back from review", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);
    expect(screen.getByText("Maria da Silva")).toBeInTheDocument();
    expect(screen.getAllByText("Coro Diocesano de Quixadá").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue(quixadaId);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByText("maria.jpg")).toBeInTheDocument();
  });

  it("restores partially entered personal data after the page reloads", async () => {
    const user = userEvent.setup();
    const firstPage = render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    firstPage.unmount();

    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@example.com");
  });

  it("returns to the completed review with its photo after leaving for InfinitePay", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockResolvedValue({
      ok: true,
      checkoutUrl: safeUrl,
      orderNsu: fixedOrderNsu,
    });
    const navigateToCheckout = vi.fn();
    const firstPage = render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await goToReview(user);

    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    await waitFor(() => expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl));
    firstPage.unmount();

    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(await screen.findByRole("heading", { name: "Confira sua inscrição" })).toBeVisible();
    expect(screen.getByText("Maria da Silva")).toBeVisible();
    expect(screen.getByText("maria.jpg")).toBeVisible();
    expect(screen.getAllByText("Coro Diocesano de Quixadá").length).toBeGreaterThan(0);
  });

  it("limits birth dates to the current day in Fortaleza", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T01:30:00.000Z"));
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    expect(screen.getByLabelText("Data de nascimento")).toHaveAttribute("max", "2026-09-07");
  });

  it("offers a retry when configuration loading fails", async () => {
    const user = userEvent.setup();
    const retry = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(configuration);
    render(<RegistrationSection checkAvailability={available} loadConfiguration={retry} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(2));
    await goToParticipation(user);
    expect(screen.getByRole("option", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
  });

  it("explains the secure InfinitePay redirection on the review step", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);

    expect(
      screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("InfinitePay")).toBeInTheDocument();
    expect(
      screen.getByText("Você será direcionado ao ambiente seguro da InfinitePay."),
    ).toBeInTheDocument();
  });

  it("does not open InfinitePay on an unclicked form submission", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockResolvedValue({
      ok: true,
      checkoutUrl: safeUrl,
      orderNsu: fixedOrderNsu,
    });
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await goToReview(user);

    const paymentButton = screen.getByRole("button", {
      name: "Pagar com segurança na InfinitePay",
    });
    const form = paymentButton.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(startCheckout).not.toHaveBeenCalled());
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });

  it("shows that the participant payment is being prepared before redirecting", async () => {
    const user = userEvent.setup();
    let resolveCheckout!: (value: { ok: true; checkoutUrl: string; orderNsu: string }) => void;
    const startCheckout = vi.fn(
      () =>
        new Promise<{ ok: true; checkoutUrl: string; orderNsu: string }>((resolve) => {
          resolveCheckout = resolve;
        }),
    );
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await goToReview(user);

    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    expect(await screen.findByRole("button", { name: "Preparando seu pagamento…" })).toBeDisabled();

    resolveCheckout({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    await waitFor(() => expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl));
  });

  it("submits the reviewed quote and redirects", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: quixadaId,
          voicePart: "soprano",
          raffleChoice: "participate",
          displayedQuote: {
            pricingType: "promotional",
            standardPriceCents: 30000,
            registrationPriceCents: 10000,
          },
        }),
      ),
    );
    expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl);
  });

  it("submits the full-price choice for a raffle-enabled choir", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={vi.fn()}
      />,
    );
    await goToReview(user, quixadaId, "full_price");
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: quixadaId,
          raffleChoice: "full_price",
          displayedQuote: {
            pricingType: "standard",
            standardPriceCents: 30000,
            registrationPriceCents: 30000,
          },
        }),
      ),
    );
  });

  it("submits the full-price choice for a choir outside the raffle program", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={vi.fn()}
      />,
    );
    await goToReview(user, sobralId, null);
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: sobralId,
          raffleChoice: "full_price",
          displayedQuote: {
            pricingType: "standard",
            standardPriceCents: 30000,
            registrationPriceCents: 30000,
          },
        }),
      ),
    );
  });

  it("keeps review visible when InfinitePay is unavailable", async () => {
    const user = userEvent.setup();
    const message =
      "O pagamento está temporariamente indisponível porque o checkout externo da InfinitePay ainda não foi ativado.";
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={vi.fn().mockResolvedValue({ ok: false, message })}
        navigateToCheckout={vi.fn()}
      />,
    );
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("Maria da Silva")).toBeInTheDocument();
  });

  it("surfaces checkout errors without a recovery section", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={vi.fn().mockResolvedValue({
          ok: false,
          message: "Já existe uma inscrição para este CPF. Use Retomar pagamento.",
        })}
      />,
    );
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível preparar o pagamento");
    expect(screen.queryByRole("link", { name: "Retomar pagamento" })).not.toBeInTheDocument();
  });

  it("shows the email conflict at the payment step", async () => {
    const user = userEvent.setup();
    const message = "Já existe um acesso com este e-mail.";
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={loadConfiguration}
        startCheckout={vi.fn().mockResolvedValue({ ok: false, message })}
      />,
    );
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Pagar com segurança na InfinitePay" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
