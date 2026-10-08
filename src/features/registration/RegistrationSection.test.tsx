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
  standardPriceCents: 30000,
  eventPriceCents: 8000,
  choirs: [
    {
      id: quixadaId,
      name: "Coro Diocesano de Quixadá",
      diocese: "Diocese de Quixadá",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
      remainingPriceCents: 20000,
    },
    {
      id: sobralId,
      name: "Coro Diocesano de Sobral",
      diocese: "Diocese de Sobral",
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    },
    {
      id: canindeId,
      name: "Coro Diocesano de Canindé",
      diocese: "Diocese de Quixadá",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    },
  ],
};
const loadConfiguration = vi.fn(async () => configuration);
const available = vi.fn(async () => ({ cpfTaken: false, emailTaken: false }));
const paymentButtonName = (amount: string) =>
  new RegExp(`Ir para pagamento de R\\$\\s*${amount} na InfinitePay`);

async function fillPersonalData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo para certificado"), "Maria da Silva");
  await user.type(screen.getByLabelText("Nome para o crachá"), "Maria Silva");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de nascimento"), "20051990");
  await user.upload(
    screen.getByLabelText("Foto do participante"),
    new File(["photo"], "maria.jpg", { type: "image/jpeg" }),
  );
  await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Quixadá");
  await screen.findByText("maria.jpg");
}

async function goToParticipation(user: ReturnType<typeof userEvent.setup>) {
  await fillPersonalData(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Sua participação" });
}

async function fillParticipation(user: ReturnType<typeof userEvent.setup>, choirId = quixadaId) {
  const choirName = configuration.choirs.find((choir) => choir.id === choirId)?.name;
  if (!choirName) throw new Error(`Unknown choir fixture: ${choirId}`);
  await user.click(screen.getByRole("radio", { name: choirName }));
  await user.click(screen.getByRole("radio", { name: "Coralista" }));
  await user.click(screen.getByRole("radio", { name: "Soprano" }));
}

async function goToReview(
  user: ReturnType<typeof userEvent.setup>,
  choirId = quixadaId,
  raffleChoice: "participate" | "full_price" | null = "participate",
) {
  await goToParticipation(user);
  await fillParticipation(user, choirId);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Tipo de inscrição" });
  if (raffleChoice) {
    await user.click(
      screen.getByLabelText(
        raffleChoice === "participate"
          ? "Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"
          : "Inscrição + Hospedagem e Alimentação — Pagamento integral",
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

  it("starts with a compact four-step form and participant badge header", async () => {
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
    ).toEqual(["cpf", "name", "badgeName"]);
    expect(
      Array.from(
        screen
          .getByRole("heading", { name: "Conte-nos quem é você" })
          .closest("fieldset")!
          .querySelectorAll("input"),
      )
        .slice(0, 3)
        .map((input) => input.id),
    ).toEqual(["cpf", "name", "badgeName"]);
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Meus dados");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Coro e perfil");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Tipo de inscrição");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Revisão");
    expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("Foto do participante")).toBeRequired();
    expect(screen.getByLabelText("Diocese")).toBeRequired();
    const actions = screen.getByRole("group", { name: "Ações da inscrição" });
    expect(actions).toHaveClass("registration-actions--sticky");
    expect(within(actions).getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(within(actions).getByRole("button", { name: "Continuar" })).toBeVisible();
    expect(screen.queryByText("Ver exemplo de crachá")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Exemplo de crachá")).not.toBeInTheDocument();
    expect(screen.getByText("Nome completo usado no certificado.")).toBeInTheDocument();
    expect(
      screen.getByText("Nome curto que aparecerá no crachá. Ex.: Antonio Lima."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Foto recente, de frente, mostrando apenas o rosto."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(85) 99999-9999");
  });

  it("offers event-only participation for R$ 80 in payment step after the choir is selected", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await goToParticipation(user);

    expect(screen.queryByRole("radio", { name: "Inscrição no Evento" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    expect(screen.queryByRole("radio", { name: "Inscrição no Evento" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Tipo de inscrição" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Inscrição no Evento" })).toBeInTheDocument();
    expect(screen.getByText("R$ 80,00")).toBeInTheDocument();
  }, 20_000);

  it("shows R$ 80 without raffle choices for event-only participation", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Tipo de inscrição" })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Inscrição no Evento" }));
    expect(screen.getByTestId("registration-option-event")).toHaveTextContent("R$ 80,00");
    expect(screen.getByTestId("registration-option-event")).toHaveTextContent(
      "Certificado de participação",
    );
    expect(screen.queryByText("Como deseja realizar sua inscrição?")).not.toBeInTheDocument();
  });

  it("submits a free choir for approval without opening checkout", async () => {
    const user = userEvent.setup();
    const freeConfiguration: PublicRegistrationConfiguration = {
      standardPriceCents: null,
      eventPriceCents: 8000,
      choirs: [{ id: quixadaId, name: "Coro Diocesano de Quixadá", diocese: "Diocese de Quixadá",
        pricingType: "free", standardPriceCents: 0, registrationPriceCents: 0 }],
    };
    const startCheckout = vi.fn().mockResolvedValue({ ok: true, status: "pending_approval" });
    const navigateToCheckout = vi.fn();
    render(<RegistrationSection checkAvailability={available}
      loadConfiguration={vi.fn(async () => freeConfiguration)}
      startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />);
    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Sua participação" });
    await fillParticipation(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Inscrição gratuita" })).toBeVisible();
    expect(screen.queryByText(/InfinitePay · ambiente oficial/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Resumo da inscrição" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Pagamento de hoje" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar inscrição gratuita" }));
    expect(await screen.findByRole("heading", { name: "Inscrição enviada" })).toBeVisible();
    expect(startCheckout).toHaveBeenCalledWith(expect.objectContaining({
      choirId: quixadaId, raffleChoice: "full_price",
      displayedQuote: { pricingType: "free", standardPriceCents: 0, registrationPriceCents: 0 },
    }));
    expect(navigateToCheckout).not.toHaveBeenCalled();
  }, 20_000);

  it("shows the three home registration modalities as independent options", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Tipo de inscrição" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Inscrição no Evento" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: "Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: "Inscrição + Hospedagem e Alimentação — Pagamento integral",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/As vendas cobrem integralmente os R\$ 200,00 restantes do retiro!/)).toBeInTheDocument();
    expect(screen.getByText("PARTICIPAÇÃO INDIVIDUAL")).toBeInTheDocument();
    expect(screen.getByText("EXPERIÊNCIA COMPLETA SUBSIDIADA")).toBeInTheDocument();
    expect(screen.getByText("20 Rifas Cobrem o Resto")).toBeInTheDocument();
    expect(screen.getByText("Prêmio da rifa")).toBeVisible();
    expect(screen.getByText("R$ 1.000,00")).toBeVisible();
    expect(screen.getByText("Maior vendedor")).toBeVisible();
    expect(screen.getByText("R$ 500,00")).toBeVisible();
    expect(screen.queryByText(/rifas paroquiais/i)).not.toBeInTheDocument();
    expect(screen.getByText("SEM GESTÃO DE RIFAS")).toBeInTheDocument();
    expect(screen.getByText("Valor total único")).toBeInTheDocument();

    const baseBenefits = [
      "Acesso integral a todas as formações litúrgicas",
      "Kit oficial do participante com partituras impressas",
      "Certificado de participação diocesano (horas acadêmicas)",
    ];
    for (const optionId of [
      "registration-option-event",
      "registration-option-raffle",
      "registration-option-full-price",
    ]) {
      const option = screen.getByTestId(optionId);
      for (const benefit of baseBenefits) {
        expect(within(option).getByText(benefit)).toBeVisible();
      }
    }
    for (const optionId of ["registration-option-raffle", "registration-option-full-price"]) {
      const option = screen.getByTestId(optionId);
      expect(within(option).getByText("Hospedagem no Centro Diocesano de Pastoral")).toBeVisible();
      expect(within(option).getByText("Alimentação completa durante todos os dias (pensão total)")).toBeVisible();
    }

    const raffleOption = screen.getByRole("radio", {
      name: "Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas",
    });
    const fullPriceOption = screen.getByRole("radio", {
      name: "Inscrição + Hospedagem e Alimentação — Pagamento integral",
    });
    await user.click(raffleOption);
    expect(raffleOption).toBeChecked();
    await user.click(fullPriceOption);
    expect(fullPriceOption).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Inscrição no Evento" }));
    expect(screen.getByRole("radio", { name: "Inscrição no Evento" })).toBeChecked();
  }, 20_000);

  it("reveals the exact installment table for each modality in the wizard", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await goToParticipation(user);
    await fillParticipation(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Tipo de inscrição" });

    const event = screen.getByTestId("registration-option-event");
    const raffle = screen.getByTestId("registration-option-raffle");
    const complete = screen.getByTestId("registration-option-full-price");

    await user.click(within(event).getByRole("button", { name: "Ver parcelas" }));
    await user.click(within(raffle).getByRole("button", { name: "Ver parcelas" }));
    await user.click(within(complete).getByRole("button", { name: "Ver parcelas" }));

    expect(screen.getAllByRole("dialog")).toHaveLength(3);
    const eventInstallments = within(screen.getAllByRole("dialog")[0]).getAllByRole("listitem");
    expect(eventInstallments[0]).toHaveTextContent("1x de R$ 83,51");
    expect(eventInstallments.at(-1)).toHaveTextContent("12x de R$ 8,00");
    expect(screen.getByText("12x de R$ 8,00")).toBeVisible();
    expect(screen.getByText("12x de R$ 10,00")).toBeVisible();
    expect(screen.getByText("12x de R$ 30,00")).toBeVisible();
  }, 20_000);

  it("shows the CPF conflict returned for a rejected free submission", async () => {
    const user = userEvent.setup();
    const message = "Já existe uma inscrição para este CPF.";
    const freeConfiguration: PublicRegistrationConfiguration = {
      standardPriceCents: null,
      eventPriceCents: 8000,
      choirs: [
        {
          id: quixadaId,
          name: "Coro Diocesano de Quixadá",
          diocese: "Diocese de Quixadá",
          pricingType: "free",
          standardPriceCents: 0,
          registrationPriceCents: 0,
        },
      ],
    };
    render(
      <RegistrationSection
        checkAvailability={available}
        loadConfiguration={vi.fn(async () => freeConfiguration)}
        startCheckout={vi.fn().mockResolvedValue({ ok: false, message })}
      />,
    );

    await goToParticipation(user);
    await fillParticipation(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Inscrição gratuita" });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Enviar inscrição gratuita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  }, 20_000);

  it("allows the personal-data fieldset to shrink inside a narrow card", () => {
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(screen.getByLabelText("Nome completo para certificado").closest("fieldset")).toHaveClass(
      "min-w-0",
    );
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

  it("prevents advancing with an invalid Brazilian mobile number", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await fillPersonalData(user);
    const phone = screen.getByLabelText("WhatsApp");
    await user.clear(phone);
    await user.type(phone, "55859917823");
    expect(phone).toHaveValue("(55) 85991-7823");

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um WhatsApp brasileiro válido.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você" })).toBeVisible();
  });

  it("allows saved registrations to continue without blocking the wizard", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn(async () => ({
      status: "found" as const,
      name: "Maria da Silva",
      badgeName: "Maria Silva",
      email: "maria@example.com",
      phone: "85999999999",
      choirId: sobralId,
      diocese: "Diocese de Quixadá" as const,
      musicalProfile: "coralista" as const,
      voicePart: "soprano" as const,
      hasPhoto: true,
      paymentStatus: "pending" as const,
    }));
    render(
      <RegistrationSection lookupRegistration={lookup} loadConfiguration={loadConfiguration} />,
    );
    await fillPersonalData(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(lookup).toHaveBeenCalledWith({ cpf: "52998224725", birthDate: "1990-05-20" });
    expect(await screen.findByRole("heading", { name: "Sua participação" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByDisplayValue("Maria Silva")).toBeInTheDocument();
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
      musicalProfile: "coralista";
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
      <RegistrationSection lookupRegistration={lookup} loadConfiguration={loadConfiguration} />,
    );
    await fillPersonalData(user);
    await waitFor(() => expect(resolveLookup).toBeTypeOf("function"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Sua participação" });

    const choir = screen.getByRole("radio", { name: "Coro Diocesano de Sobral" });
    await user.click(choir);
    resolveLookup({
      status: "found",
      name: "Maria da Silva",
      email: "maria@example.com",
      phone: "85999999999",
      choirId: "44444444-4444-4444-8444-444444444444",
      musicalProfile: "coralista",
      voicePart: "soprano",
      hasPhoto: true,
      paymentStatus: "pending",
    });

    await waitFor(() => expect(choir).toBeChecked());
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Tipo de inscrição" });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Confira sua inscrição" })).toBeVisible();
    expect(screen.getAllByText("Coro Diocesano de Sobral").length).toBeGreaterThan(0);
  });

  it("returns an inconsistent saved review to the choir selection step", async () => {
    saveRegistrationDraft({
      form: {
        name: "Maria da Silva",
        badgeName: "Maria Silva",
        cpf: "529.982.247-25",
        email: "maria@example.com",
        phone: "(85) 99999-9999",
        birthDate: "1990-05-20",
        diocese: "Diocese de Quixadá",
        choirId: "44444444-4444-4444-8444-444444444444",
        otherChoirName: "",
        musicalProfile: "coralista",
        raffleChoice: "full_price",
        voicePart: "soprano",
      },
      photo: { contentType: "image/jpeg", dataBase64: "dGVzdA==" },
      photoFileName: "maria.jpg",
      currentStep: 4,
    });

    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(await screen.findByRole("heading", { name: "Sua participação" })).toBeVisible();
    expect(screen.queryByLabelText("Diocese")).not.toBeInTheDocument();
    for (const choice of screen.getAllByRole("radio", { name: /Coro|Outro/ })) {
      expect(choice).not.toBeChecked();
    }
    expect(screen.getByText("Selecione um coro.")).toBeVisible();
  });

  it("keeps Diocese in Meus dados and loads every choir as a selectable row", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    const diocese = screen.getByLabelText("Diocese");
    expect(diocese).toBeRequired();
    for (const label of [
      "Arquidiocese de Fortaleza",
      "Diocese de Baturité",
      "Diocese do Crato",
      "Diocese de Crateús",
      "Diocese de Iguatu",
      "Diocese de Itapipoca",
      "Diocese de Limoeiro do Norte",
      "Diocese de Quixadá",
      "Diocese de Sobral",
      "Diocese de Tianguá",
    ]) {
      expect(within(diocese).getByRole("option", { name: label })).toBeInTheDocument();
    }
    await goToParticipation(user);
    expect(screen.queryByLabelText("Diocese")).not.toBeInTheDocument();
    const choirChoices = screen.getByRole("radiogroup", { name: "Coro" });
    for (const label of [
      "Coro Diocesano de Quixadá",
      "Coro Diocesano de Sobral",
      "Coro Diocesano de Canindé",
      "Outro",
    ]) {
      expect(within(choirChoices).getByRole("radio", { name: label })).toBeInTheDocument();
    }
    expect(within(choirChoices).getAllByRole("radio")).toHaveLength(4);
    const profile = screen.getByRole("radiogroup", { name: "Perfil musical" });
    for (const label of ["Regente", "Instrumentista", "Coralista"]) {
      expect(within(profile).getByRole("radio", { name: label })).toBeInTheDocument();
    }
    await user.click(within(profile).getByRole("radio", { name: "Coralista" }));
    const voicePart = screen.getByRole("radiogroup", { name: "Naipe vocal" });
    for (const label of ["Soprano", "Contralto", "Tenor", "Baixo", "Não sei informar"]) {
      expect(within(voicePart).getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("requires an explicit choir row and allows an informed other choir", async () => {
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
    await goToParticipation(user);

    expect(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" })).not.toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const choirChoices = screen.getByRole("radiogroup", { name: "Coro" });
    expect(choirChoices).toHaveAttribute("aria-required", "true");
    expect(choirChoices).toHaveAttribute("aria-invalid", "true");
    expect(choirChoices).toHaveAccessibleDescription("Selecione um coro.");
    expect(screen.getByRole("alert")).toHaveTextContent("Selecione um coro.");

    await user.click(screen.getByRole("radio", { name: "Outro" }));
    const otherChoir = screen.getByLabelText("Informe o nome do coro");
    expect(otherChoir).toBeRequired();
    const otherChoirOption = screen.getByRole("radio", { name: "Outro" }).closest("label");
    const profile = screen.getByRole("radiogroup", { name: "Perfil musical" });
    expect(otherChoirOption).not.toBeNull();
    expect(otherChoirOption!.compareDocumentPosition(otherChoir) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(otherChoir.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.queryByLabelText("Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).not.toBeInTheDocument();
    await user.type(otherChoir, "Coral Santa Cecília");
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Tipo de inscrição" });
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Confira sua inscrição" })).toBeVisible();
    expect(screen.getAllByText("Coral Santa Cecília").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: paymentButtonName("300,00") }));
    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: null,
          otherChoirName: "Coral Santa Cecília",
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

  it("does not preselect a choir even when the selected diocese has no configured choir", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await fillPersonalData(user);
    await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Baturité");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Sua participação" });

    expect(screen.getByRole("radio", { name: "Outro" })).not.toBeChecked();
    expect(screen.queryByLabelText("Informe o nome do coro")).not.toBeInTheDocument();
  });

  it("explains both payment choices before the participant continues", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));

    expect(
      screen.queryByRole("radiogroup", { name: "Escolha o tipo de inscrição" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Tipo de inscrição" })).toBeVisible();

    const choices = screen.getByRole("radiogroup", { name: "Escolha o tipo de inscrição" });
    expect(screen.getByRole("radio", { name: "Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Inscrição + Hospedagem e Alimentação — Pagamento integral" })).toBeVisible();
    expect(choices).toHaveTextContent(/Você paga apenas R\$ 100 agora/);
    expect(choices).toHaveTextContent(/20 rifas de R\$ 10,00/);
    expect(choices).toHaveTextContent(/cobrem integralmente os R\$ 200,00 restantes/);
    expect(choices).toHaveTextContent(/Valor total únicoR\$ 300,00/);
  });

  it("requires an explicit raffle choice before advancing and focuses the group", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const raffleChoice = screen.getByRole("radiogroup", { name: "Escolha o tipo de inscrição" });
    expect(
      screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).not.toBeChecked();
    expect(
      await screen.findByText("Escolha um tipo de inscrição para continuar."),
    ).toBeInTheDocument();
    await waitFor(() => expect(raffleChoice).toHaveFocus());
    expect(screen.getByRole("heading", { name: "Tipo de inscrição" })).toBeInTheDocument();
  });

  it("shows the raffle pre-registration and 20-ticket target after the participant opts in", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(summary).toHaveTextContent(/Você paga hoje:\s*R\$ 100,00/);
    expect(summary).toHaveTextContent(/Meta das rifas:\s*R\$ 200,00/);
    expect(summary).toHaveTextContent(/arrecadar R\$ 200,00 com 20 rifas/);
    expect(summary).not.toHaveTextContent(
      /Sua vaga será confirmada após o pagamento do valor restante, que pode ser feito via Pix ou em até 5x no cartão\./,
    );
    expect(screen.getByText("Programa de rifas").parentElement).toHaveTextContent("Participarei");
  }, 20_000);

  it("shows only the full amount due now when the participant declines the raffle program", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user, quixadaId, "full_price");

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(summary).toHaveTextContent("Você paga hojeR$ 300,00");
    expect(summary).toHaveTextContent(/vaga será confirmada após a confirmação desse pagamento/);
    expect(summary).not.toHaveTextContent("Meta das rifas");
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
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Tipo de inscrição" });
    expect(screen.getByTestId("registration-option-full-price")).toHaveTextContent(/Valor total únicoR\$ 300,00/);
    expect(
      screen.queryByRole("radiogroup", { name: "Escolha o tipo de inscrição" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).toBeChecked();
    expect(screen.queryByText(/vender rifas/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Resumo do valor da inscrição")).toHaveTextContent(
      "Você paga hojeR$ 300,00",
    );
  });

  it("preserves an explicit choice between raffle-enabled choirs and resets it after a standard choir", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToParticipation(user);

    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral"));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Canindé" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.queryByRole("radiogroup", { name: "Escolha o tipo de inscrição" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).not.toBeChecked();
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
    expect(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Diocese")).toHaveValue("Diocese de Quixadá");
    expect(screen.getByLabelText("Nome completo para certificado")).toHaveValue("Maria da Silva");
    expect(screen.getByText("maria.jpg")).toBeInTheDocument();
  });

  it("restores partially entered personal data after the page reloads", async () => {
    const user = userEvent.setup();
    const firstPage = render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    await user.type(screen.getByLabelText("Nome completo para certificado"), "Maria da Silva");
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.type(screen.getByLabelText("Data de nascimento"), "2005");
    firstPage.unmount();

    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );

    expect(screen.getByLabelText("Nome completo para certificado")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@example.com");
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue("20/05");
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

    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
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

  it("uses masked numeric typing for the birth date without a native calendar", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    const birthDate = screen.getByLabelText("Data de nascimento");
    expect(birthDate).toHaveAttribute("type", "text");
    expect(birthDate).toHaveAttribute("inputmode", "numeric");
    expect(birthDate).toHaveAttribute("placeholder", "dd/mm/aaaa");
    expect(birthDate).toHaveAttribute("maxlength", "10");

    await user.type(birthDate, "20051990");
    expect(birthDate).toHaveValue("20/05/1990");
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
    expect(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
  });

  it("puts the payment summary before the review details so it is seen first on mobile", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    const detailsHeading = screen.getByRole("heading", { name: "Confira seus dados" });

    expect(
      summary.compareDocumentPosition(detailsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(summary).toHaveTextContent(/Você paga hoje:\s*R\$ 100,00/);
    expect(summary).toHaveTextContent(/Meta das rifas:\s*R\$ 200,00/);
  });

  it("names the exact payment amount before redirecting to InfinitePay", async () => {
    const user = userEvent.setup();
    render(
      <RegistrationSection checkAvailability={available} loadConfiguration={loadConfiguration} />,
    );
    await goToReview(user);

    expect(
      screen.getByRole("button", {
        name: /Ir para pagamento de R\$\s*100,00 na InfinitePay/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("InfinitePay")).toBeInTheDocument();
    expect(
      screen.getByText(/Você será direcionado para pagar R\$\s*100,00 no ambiente seguro da InfinitePay\./),
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
      name: paymentButtonName("100,00"),
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

    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
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
    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: quixadaId,
          diocese: "Diocese de Quixadá",
          voicePart: "soprano",
          raffleChoice: "participate",
          displayedQuote: {
            pricingType: "promotional",
            standardPriceCents: 30000,
            registrationPriceCents: 10000,
            remainingPriceCents: 20000,
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
    await user.click(screen.getByRole("button", { name: paymentButtonName("300,00") }));

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
    await user.click(screen.getByRole("button", { name: paymentButtonName("300,00") }));

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
    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
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
    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível preparar o pagamento",
    );
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
    await user.click(screen.getByRole("button", { name: paymentButtonName("100,00") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("renders the personal step as a light profile surface with grouped sections", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    expect(screen.getByTestId("registration-shell")).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("heading", { name: "Dados do participante" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identificação civil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contato e diocese" })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Foto do participante"),
      new File(["photo"], "profile.jpg", { type: "image/jpeg" }),
    );

    expect(
      await screen.findByRole("img", { name: "Prévia da foto de perfil" }),
    ).toHaveAttribute("src", expect.stringContaining("data:image/jpeg;base64,"));
  });

  it("filters clear-surface choir rows and exposes vocal profile rows", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);

    const quixada = screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" });
    expect(quixada.closest("label")).toHaveAttribute("data-surface", "clear");
    expect(screen.getByRole("radiogroup", { name: "Perfil musical" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Naipe vocal" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    expect(screen.getByRole("radiogroup", { name: "Naipe vocal" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Soprano" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Buscar coro ou diocese" });
    await user.type(search, "Sobral");

    expect(screen.queryByRole("radio", { name: "Coro Diocesano de Quixadá" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" })).toBeInTheDocument();
  });

  it("marks the selected payment card while keeping the price data dynamic", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Quixadá" }));
    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    await user.click(screen.getByRole("radio", { name: "Soprano" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const raffleOption = screen.getByTestId("registration-option-raffle");
    const fullPriceOption = screen.getByTestId("registration-option-full-price");
    expect(raffleOption).toHaveAttribute("data-surface", "clear");
    expect(raffleOption).toHaveAttribute("data-selected", "false");
    await user.click(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas"));
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Entrada com programa de rifas")).toBeChecked();
    expect(screen.getByLabelText("Inscrição + Hospedagem e Alimentação — Pagamento integral")).not.toBeChecked();
  });

  it("groups the review into data and payment sections with direct edit actions", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToReview(user);

    expect(screen.getByRole("heading", { name: "Confira seus dados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pagamento de hoje" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar dados pessoais" }));
    expect(screen.getByRole("heading", { name: "Dados do participante" })).toBeInTheDocument();
  });

  it("uses the profile list to reveal the visible vocal rows", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);

    const profile = screen.getByRole("radiogroup", { name: "Perfil musical" });
    expect(within(profile).getByRole("radio", { name: "Coralista" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Naipe vocal" })).not.toBeInTheDocument();
    await user.click(within(profile).getByRole("radio", { name: "Coralista" }));
    expect(screen.getByRole("radiogroup", { name: "Naipe vocal" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.getAllByRole("radio", { name: "Soprano" })).toHaveLength(1);
  });

  it("lets the review jump directly to choir and payment edits", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToReview(user);

    await user.click(screen.getByRole("button", { name: "Editar coro e perfil" }));
    expect(screen.getByRole("heading", { name: /Sua participa/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Tipo de inscrição" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: /Confira sua inscri/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar tipo de inscrição" }));
    expect(screen.getByRole("heading", { name: "Tipo de inscrição" })).toBeInTheDocument();
  });

  it("shows the choir first, uses simple lists, and adds visual profile cues", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);

    const radioGroups = screen.getAllByRole("radiogroup");
    expect(radioGroups[0]).toHaveAccessibleName("Coro");
    expect(radioGroups[0]).toHaveAttribute("data-selection-layout", "list");
    expect(radioGroups[1]).toHaveAccessibleName("Perfil musical");
    expect(radioGroups[1]).toHaveAttribute("data-selection-layout", "list");

    const choirChoices = radioGroups[0];
    expect(choirChoices).toHaveAttribute("data-selection-layout", "list");
    const profile = radioGroups[1];
    expect(profile).toBeInTheDocument();
    expect(within(profile).getAllByTestId("musical-profile-icon")).toHaveLength(3);
    expect(screen.queryByText(/sem\s+sele.*naipe vocal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Naipe vocal" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Coralista" }));
    expect(screen.getByRole("radiogroup", { name: "Naipe vocal" })).toHaveAttribute(
      "data-selection-layout",
      "list",
    );

    await user.click(screen.getByRole("radio", { name: "Regente" }));
    expect(screen.queryByRole("radiogroup", { name: "Naipe vocal" })).not.toBeInTheDocument();
  });

  it("submits non-coralista profiles without a voice part", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    render(
      <RegistrationSection
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={vi.fn()}
      />,
    );
    await goToParticipation(user);
    await user.click(screen.getByRole("radio", { name: "Coro Diocesano de Sobral" }));
    await user.click(screen.getByRole("radio", { name: "Regente" }));
    expect(screen.queryByRole("radiogroup", { name: "Naipe vocal" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Tipo de inscrição" });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: /Confira sua inscri/ });
    await user.click(screen.getByRole("button", { name: paymentButtonName("300,00") }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ musicalProfile: "regente", voicePart: null }),
      ),
    );
  });
});
