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
    { id: quixadaId, name: "Coro Diocesano de Quixadá", pricingType: "promotional", standardPriceCents: 30000, registrationPriceCents: 10000 },
    { id: sobralId, name: "Coro Diocesano de Sobral", pricingType: "standard", standardPriceCents: 30000, registrationPriceCents: 30000 },
  ],
};
const loadConfiguration = vi.fn(async () => configuration);

async function fillPersonalData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
  await user.type(screen.getByLabelText("CPF"), "52998224725");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de nascimento"), "1990-05-20");
}

async function goToParticipation(user: ReturnType<typeof userEvent.setup>) {
  await fillPersonalData(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Sua participação" });
}

async function fillParticipation(user: ReturnType<typeof userEvent.setup>, choirId = quixadaId) {
  await user.selectOptions(screen.getByLabelText("Coro/Diocese"), choirId);
  await user.selectOptions(screen.getByLabelText("Perfil musical"), "soprano");
  await user.upload(screen.getByLabelText("Foto do participante"), new File(["photo"], "maria.jpg", { type: "image/jpeg" }));
  await screen.findByText("maria.jpg");
}

async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await goToParticipation(user);
  await fillParticipation(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Confira sua inscrição" });
}

describe("RegistrationSection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts with a three-step progress indicator and large personal fields", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    expect(screen.getByRole("heading", { name: "Realize sua inscrição" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você" })).toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    expect(screen.getByLabelText("CPF")).toHaveClass("min-h-14");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Seus dados");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Participação");
    expect(screen.getByLabelText("Etapas da inscrição")).toHaveTextContent("Revisão");
    expect(screen.queryByLabelText("Foto do participante")).not.toBeInTheDocument();
  });

  it("validates the current step before advancing", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe seu nome completo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conte-nos quem é você" })).toBeInTheDocument();
  });

  it("loads configured choirs and all musical profiles in participation", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);
    expect(screen.getByRole("option", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
    const profile = screen.getByLabelText("Perfil musical");
    for (const label of ["Soprano", "Contralto", "Tenor", "Baixo", "Não sei informar"]) {
      expect(within(profile).getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("shows promotional calculation and raffle guidance", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);
    const summary = screen.getByLabelText("Resumo do valor da inscrição");
    expect(summary).toHaveTextContent("Valor normalR$ 300,00");
    expect(summary).toHaveTextContent("Desconto das rifas− R$ 200,00");
    expect(summary).toHaveTextContent("Você paga agoraR$ 100,00");
    expect(screen.getByRole("status")).toHaveTextContent(/25 rifas.*regente/i);
  });

  it("shows the normal price for a choir without promotion", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToParticipation(user);
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), sobralId);
    expect(screen.getByLabelText("Resumo do valor da inscrição")).toHaveTextContent("Valor da inscriçãoR$ 300,00");
    expect(screen.queryByText(/vender rifas/i)).not.toBeInTheDocument();
  });

  it("preserves values when moving back from review", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await goToReview(user);
    expect(screen.getByText("Maria da Silva")).toBeInTheDocument();
    expect(screen.getAllByText("Coro Diocesano de Quixadá").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue(quixadaId);
    expect(screen.getByText("maria.jpg")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
  });

  it("limits birth dates to the current day in Fortaleza", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T01:30:00.000Z"));
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    expect(screen.getByLabelText("Data de nascimento")).toHaveAttribute("max", "2026-09-07");
  });

  it("offers a retry when configuration loading fails", async () => {
    const user = userEvent.setup();
    const retry = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce(configuration);
    render(<RegistrationSection loadConfiguration={retry} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(2));
    await goToParticipation(user);
    expect(screen.getByRole("option", { name: "Coro Diocesano de Quixadá" })).toBeInTheDocument();
  });

  it("submits the reviewed quote and redirects", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockResolvedValue({ ok: true, checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    const navigateToCheckout = vi.fn();
    render(<RegistrationSection loadConfiguration={loadConfiguration} startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Ir para pagamento" }));
    await waitFor(() => expect(startCheckout).toHaveBeenCalledWith(expect.objectContaining({ choirId: quixadaId, voicePart: "soprano", displayedQuote: { pricingType: "promotional", standardPriceCents: 30000, registrationPriceCents: 10000 } })));
    expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl);
  });

  it("keeps review visible when InfinitePay is unavailable", async () => {
    const user = userEvent.setup();
    const message = "O pagamento está temporariamente indisponível porque o checkout externo da InfinitePay ainda não foi ativado.";
    render(<RegistrationSection loadConfiguration={loadConfiguration} startCheckout={vi.fn().mockResolvedValue({ ok: false, message })} navigateToCheckout={vi.fn()} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Ir para pagamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("Maria da Silva")).toBeInTheDocument();
  });

  it("points duplicate CPF registrations to payment recovery", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} startCheckout={vi.fn().mockResolvedValue({ ok: false, message: "Já existe uma inscrição para este CPF. Use Retomar pagamento." })} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Ir para pagamento" }));
    expect(await screen.findByRole("link", { name: "Retomar pagamento" })).toHaveAttribute("href", "#retomar-pagamento");
  });
});