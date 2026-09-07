import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegistrationSection } from "./RegistrationSection";

const safeUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  values: { name?: string } = {},
) {
  await user.type(screen.getByLabelText("Nome Completo"), values.name ?? "Maria da Silva");
  await user.type(screen.getByLabelText("WhatsApp"), "85999999999");
  await user.type(screen.getByLabelText("Data de Nascimento"), "1990-05-20");
  await user.selectOptions(screen.getByLabelText("Diocese"), "Diocese de Quixadá");
}

describe("RegistrationSection", () => {
  it("shows only the simplified required participant fields and the optional shirt", () => {
    render(<RegistrationSection />);

    expect(screen.getByLabelText("Nome Completo")).toBeRequired();
    expect(screen.getByLabelText("WhatsApp")).toBeRequired();
    expect(screen.getByLabelText("Data de Nascimento")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Data de Nascimento")).toBeRequired();
    expect(screen.getByLabelText("Diocese")).toBeRequired();
    expect(screen.getByRole("checkbox", { name: /Incluir camisa oficial/ })).not.toBeRequired();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Paróquia / Instituição")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Função")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Observações")).not.toBeInTheDocument();
  });

  it("disables the submit button while checkout is being prepared", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockReturnValue(new Promise(() => undefined));
    const navigateToCheckout = vi.fn();

    render(
      <RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />,
    );
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    expect(screen.getByRole("button", { name: "Preparando pagamento…" })).toBeDisabled();
  });

  it("keeps the entered form when checkout creation fails", async () => {
    const user = userEvent.setup();
    const startCheckout = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const navigateToCheckout = vi.fn();

    render(
      <RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />,
    );
    await fillRequiredFields(user, { name: "Maria da Silva" });

    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    const error = await screen.findByText(
      "Não foi possível preparar o pagamento. Tente novamente.",
    );
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Nome Completo")).toHaveValue("Maria da Silva");
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });

  it("redirects after a successful server response", async () => {
    const user = userEvent.setup();
    const startCheckout = vi
      .fn()
      .mockResolvedValue({ checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
    const navigateToCheckout = vi.fn();

    render(
      <RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />,
    );
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));

    await waitFor(() => expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl));
  });
});
