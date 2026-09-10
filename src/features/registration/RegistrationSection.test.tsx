import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicRegistrationConfiguration } from "@/features/choirs/choir-pricing.domain";
import { RegistrationSection } from "./RegistrationSection";

const safeUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const quixadaId = "11111111-1111-4111-8111-111111111111";
const sobralId = "22222222-2222-4222-8222-222222222222";

const configuration: PublicRegistrationConfiguration = {
  shirtPriceCents: 5000,
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
  await user.type(screen.getByLabelText("Nome Completo"), "Maria da Silva");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de Nascimento"), "1990-05-20");
  await user.selectOptions(screen.getByLabelText("Coro/Diocese"), quixadaId);
}

describe("RegistrationSection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads the administratively configured choirs and shirt price", async () => {
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);

    expect(
      await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coro Diocesano de Sobral" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Incluir camisa oficial/ })).toBeInTheDocument();
    expect(screen.getAllByText("R$ 50,00").length).toBeGreaterThan(0);
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

  it("hides the shirt offer when its value is not configured", async () => {
    render(
      <RegistrationSection
        loadConfiguration={async () => ({ ...configuration, shirtPriceCents: null })}
      />,
    );

    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    expect(
      screen.queryByRole("checkbox", { name: /Incluir camisa oficial/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Camisa oficial", { selector: "span" })).not.toBeInTheDocument();
  });

  it("limits birth dates to the current day in Fortaleza", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T01:30:00.000Z"));
    render(<RegistrationSection loadConfiguration={loadConfiguration} />);
    expect(screen.getByLabelText("Data de Nascimento")).toHaveAttribute("max", "2026-09-07");
  });

  it("keeps the entered form when checkout creation fails", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockRejectedValue(new Error("A configuração de preços mudou."));
    const reloadConfiguration = vi
      .fn()
      .mockResolvedValueOnce(configuration)
      .mockResolvedValueOnce({ ...configuration, shirtPriceCents: null });
    render(
      <RegistrationSection loadConfiguration={reloadConfiguration} startCheckout={startCheckout} />,
    );
    await screen.findByRole("option", { name: "Coro Diocesano de Quixadá" });
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(await screen.findByText(/configuração de preços mudou/i)).toBeInTheDocument();
    await waitFor(() => expect(reloadConfiguration).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Nome Completo")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("Coro/Diocese")).toHaveValue("");
    expect(
      screen.queryByRole("checkbox", { name: /Incluir camisa oficial/ }),
    ).not.toBeInTheDocument();
  });

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
      .mockResolvedValue({ checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
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
          displayedQuote: {
            pricingType: "promotional",
            standardPriceCents: 30000,
            registrationPriceCents: 10000,
          },
          displayedShirtPriceCents: 5000,
        }),
      ),
    );
    expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl);
  });
});
