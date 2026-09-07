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
  await user.type(screen.getByLabelText("Nome completo"), values.name ?? "Maria da Silva");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("Telefone"), "85999999999");
  await user.type(screen.getByLabelText("Cidade"), "Quixadá");
}

describe("RegistrationSection", () => {
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
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
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
