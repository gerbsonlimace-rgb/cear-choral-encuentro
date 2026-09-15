import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicRegistrationConfiguration } from "@/features/choirs/choir-pricing.domain";
import { RegistrationSection } from "./RegistrationSection";

const safeUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const quixadaId = "11111111-1111-4111-8111-111111111111";
const sobralId = "22222222-2222-4222-8222-222222222222";

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
  ],
};

const loadConfiguration = vi.fn(async () => configuration);

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de nascimento"), "1990-05-20");
  await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);
  await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
  await user.upload(
    screen.getByLabelText("Foto do participante"),
    new File(["photo"], "maria.jpg", { type: "image/jpeg" }),
  );
  await screen.findByText("maria.jpg");
}

describe("RegistrationSection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the highlighted registration form with a required photo and payment summary", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    expect(screen.getByRole("heading", { name: "Realize sua inscrição" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Já fez sua inscrição?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Participação" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    expect(screen.getByLabelText("CPF")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Nome completo")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Foto do participante")).toBeRequired();
    expect(screen.getByLabelText("Resumo do valor da inscrição")).toBeInTheDocument();
    expect(screen.queryByLabelText("Prévia do crachá")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /camisa/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Camisa oficial")).not.toBeInTheDocument();
  });

  it("starts the personal form with CPF and birth date", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    const fieldOrder = [
      ["CPF", "order-1"],
      ["Data de nascimento", "order-2"],
      ["Nome completo", "order-3"],
      ["E-mail", "order-4"],
      ["WhatsApp", "order-5"],
    ] as const;
    for (const [label, orderClass] of fieldOrder) {
      expect(screen.getByLabelText(label).closest(`.${orderClass}`)).toBeInTheDocument();
    }
  });

  it("prefills saved participant data after CPF and birth date lookup", async () => {
    const user = userEvent.setup();
    const lookupRegistration = vi.fn(async () => ({
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
        loadConfiguration={loadConfiguration}
        lookupRegistration={lookupRegistration}
      />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.type(screen.getByLabelText("Data de nascimento"), "1990-05-20");
    await user.tab();

    await waitFor(() => expect(lookupRegistration).toHaveBeenCalledWith({
      cpf: "52998224725",
      birthDate: "1990-05-20",
    }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@example.com");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("85999999999");
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue(quixadaId);
    expect(screen.getByLabelText("Perfil musical")).toHaveValue("soprano");
    expect(screen.getByText(/dados salvos e preenchemos/i)).toBeInTheDocument();
  });

  it("shows the promotional discount calculation and raffle message for the selected choir", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);

    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(within(summary).getByText("Valor normal")).toBeInTheDocument();
    expect(within(summary).getByText("R$ 300,00")).toBeInTheDocument();
    expect(within(summary).getByText("Desconto das rifas")).toBeInTheDocument();
    expect(within(summary).getByText("− R$ 200,00")).toBeInTheDocument();
    expect(within(summary).getByText("Você paga agora")).toBeInTheDocument();
    expect(within(summary).getByText("R$ 100,00")).toBeInTheDocument();
    const raffleStatus = screen.getByRole("status");
    expect(raffleStatus).toHaveTextContent(
      /prezado coralista, o coro diocesano de quixadá aderiu ao programa de venda de rifas.*25 rifas.*regente/i,
    );
    expect(
      within(raffleStatus).getByText("Coro Diocesano de Quixadá", { exact: true }).tagName,
    ).toBe("STRONG");
  });

  it("loads the administratively configured choirs", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    expect(
      await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coro Diocesano de Sobral" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /camisa/i })).not.toBeInTheDocument();
  });

  it("offers the five musical profiles", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    const profile = screen.getByLabelText("Perfil musical");
    for (const label of ["Soprano", "Contralto", "Tenor", "Baixo", "Não sei informar"]) {
      expect(within(profile).getByRole("option", { name: label })).toBeInTheDocument();
    }

    await user.selectOptions(profile, "contralto");
    expect(profile).toHaveValue("contralto");
  });

  it("automatically applies and explains the promotional price", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);

    expect(screen.getByLabelText("Resumo do valor da inscrição")).toHaveTextContent(
      "Você paga agoraR$ 100,00",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/25 rifas.*regente/i);
  });

  it("uses the normal price for a choir without promotion", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Sobral" });

    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), sobralId);

    expect(screen.getByLabelText("Resumo do valor da inscrição")).toHaveTextContent(
      "Valor da inscriçãoR$ 300,00",
    );
    expect(screen.queryByText(/vender rifas/i)).not.toBeInTheDocument();
  });

  it("limits birth dates to the current day in Fortaleza", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T01:30:00.000Z"));
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    expect(screen.getByLabelText("Data de nascimento")).toHaveAttribute("max", "2026-09-07");
  });

  it("keeps the entered form when checkout creation fails", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: false, message: "A configuração de preços mudou." });
    const reloadConfiguration = vi
      .fn()
      .mockResolvedValueOnce(configuration)
      .mockResolvedValueOnce({ ...configuration });
    render(
      <RegistrationSection loadConfiguration={reloadConfiguration} startCheckout={startCheckout} />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(await screen.findByText(/configuração de preços mudou/i)).toBeInTheDocument();
    await waitFor(() => expect(reloadConfiguration).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue("");
  });

  it("shows the InfinitePay activation notice without leaving the page", async () => {
    const user = userEvent.setup();
    const activationMessage =
      "O pagamento está temporariamente indisponível porque o checkout externo da InfinitePay ainda não foi ativado.";
    const startCheckout = vi.fn().mockResolvedValue({ ok: false, message: activationMessage });
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationSection
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(activationMessage);
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });

  it("keeps the form when the server rejects a duplicate CPF", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockResolvedValue({
      ok: false,
      message: "Já existe uma inscrição para este CPF. Use Retomar pagamento.",
    });
    render(
      <RegistrationSection loadConfiguration={loadConfiguration} startCheckout={startCheckout} />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível preparar o pagamento. Tente novamente.",
    );
    expect(screen.queryByRole("link", { name: "Retomar pagamento" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue(quixadaId);
    const photoInput = screen.getByLabelText("Foto do participante") as HTMLInputElement;
    expect(photoInput.files).toHaveLength(1);
    expect(photoInput.files?.[0]?.name).toBe("maria.jpg");
  }, 10_000);

  it("offers a retry when the initial configuration request fails", async () => {
    const user = userEvent.setup();
    const retryConfiguration = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(configuration);
    render(<RegistrationSection loadConfiguration={retryConfiguration} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" }),
    ).toBeInTheDocument();
    expect(retryConfiguration).toHaveBeenCalledTimes(2);
  });

  it("submits the displayed automatic quote and redirects", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    const navigateToCheckout = vi.fn();
    render(
      <RegistrationSection
        loadConfiguration={loadConfiguration}
        startCheckout={startCheckout}
        navigateToCheckout={navigateToCheckout}
      />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          choirId: quixadaId,
          voicePart: "soprano",
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

  it("keeps the form when a known CPF conflict is returned", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockResolvedValue({
      ok: false,
      message: "Já existe uma inscrição para este CPF. Use Retomar pagamento.",
    });
    render(
      <RegistrationSection loadConfiguration={loadConfiguration} startCheckout={startCheckout} />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível preparar o pagamento. Tente novamente.",
    );
    expect(screen.queryByRole("link", { name: "Retomar pagamento" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
  });
});
