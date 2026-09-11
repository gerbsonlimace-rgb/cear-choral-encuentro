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
  await screen.findByRole("img", { name: "Foto de Maria da Silva no crachá" });
}

describe("RegistrationSection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the compact registration form with a required participant photo", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    expect(screen.getByRole("heading", { name: "Dados pessoais" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Participação" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    expect(screen.getByLabelText("CPF")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Nome completo")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Foto do participante")).toBeRequired();
    expect(screen.getAllByLabelText("Prévia do crachá")).toHaveLength(1);
    expect(screen.queryByRole("checkbox", { name: /camisa/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Camisa oficial")).not.toBeInTheDocument();
  });

  it("fills the badge preview with the participant name, choir and selected photo", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    const [badge] = screen.getAllByLabelText("Prévia do crachá");
    await user.type(screen.getByLabelText("Nome completo"), "Maria da Silva");
    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);
    await user.upload(
      screen.getByLabelText("Foto do participante"),
      new File(["photo"], "maria.jpg", { type: "image/jpeg" }),
    );

    expect(within(badge).getByText("Maria da Silva")).toBeInTheDocument();
    expect(within(badge).getByText("Coro Diocesano de Quixadá")).toBeInTheDocument();
    const photo = await within(badge).findByRole("img", {
      name: "Foto de Maria da Silva no crachá",
    });
    expect(photo).toHaveAttribute("src", expect.stringMatching(/^data:image\/jpeg;base64,/));
  });

  it("loads the administratively configured choirs", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    expect(
      await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coro Diocesano de Sobral" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /camisa/i })).not.toBeInTheDocument();
  });

  it("offers the five musical profiles and fills the badge live", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    const profile = screen.getByLabelText("Perfil musical");
    for (const label of ["Soprano", "Contralto", "Tenor", "Baixo", "Não sei informar"]) {
      expect(within(profile).getByRole("option", { name: label })).toBeInTheDocument();
    }

    await user.selectOptions(profile, "contralto");
    expect(
      within(screen.getByLabelText("Prévia do crachá")).getByText("Contralto"),
    ).toBeInTheDocument();
  });

  it("automatically applies and explains the promotional price", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });

    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);

    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      /valor promocional.*vender rifas.*subsidiar o valor restante/i,
    );
  });

  it("uses the normal price for a choir without promotion", async () => {
    const user = userEvent.setup();
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    await screen.findByRole("option", { name: "Coro Diocesano de Sobral" });

    await user.selectOptions(screen.getByLabelText("Coro/Diocese"), sobralId);

    expect(screen.getAllByText("R$ 300,00").length).toBeGreaterThan(0);
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

  it("keeps the form and points a duplicate CPF to Retomar pagamento", async () => {
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

    const resumeLink = await screen.findByRole("link", { name: "Retomar pagamento" });
    expect(resumeLink).toHaveAttribute("href", "#retomar-pagamento");
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

  it("keeps the form and points a known CPF conflict to Retomar pagamento", async () => {
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

    expect(await screen.findByRole("link", { name: "Retomar pagamento" })).toHaveAttribute(
      "href",
      "#retomar-pagamento",
    );
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
  });
});
