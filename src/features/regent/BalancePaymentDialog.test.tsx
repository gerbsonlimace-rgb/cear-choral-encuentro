import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BalancePaymentDialog } from "./BalancePaymentDialog";

const target = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ana Regente",
  balanceCents: 12_000,
};

function setup(overrides: Partial<React.ComponentProps<typeof BalancePaymentDialog>> = {}) {
  const props: React.ComponentProps<typeof BalancePaymentDialog> = {
    target,
    open: true,
    onOpenChange: vi.fn(),
    startCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.com.br/complemento",
      orderNsu: "order-1",
    }),
    navigateToCheckout: vi.fn(),
    ...overrides,
  };
  return { user: userEvent.setup(), props, ...render(<BalancePaymentDialog {...props} />) };
}

describe("BalancePaymentDialog", () => {
  it("shows the participant and exact server-owned balance without a textbox", () => {
    setup();

    expect(screen.getByText(/Ana Regente/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*120,00/)).not.toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("submits the registration only once and navigates to a safe checkout", async () => {
    let resolve!: (value: { checkoutUrl: string; orderNsu: string }) => void;
    const startCheckout = vi.fn(
      () =>
        new Promise<{ checkoutUrl: string; orderNsu: string }>((done) => {
          resolve = done;
        }),
    );
    const { user, props } = setup({ startCheckout });
    const submit = screen.getByRole("button", { name: /Pagar saldo de R\$\s*120,00/ });
    await user.dblClick(submit);

    expect(startCheckout).toHaveBeenCalledExactlyOnceWith({ data: { registrationId: target.id } });
    await act(async () =>
      resolve({
        checkoutUrl: "https://checkout.infinitepay.com.br/complemento",
        orderNsu: "order-1",
      }),
    );
    expect(props.navigateToCheckout).toHaveBeenCalledExactlyOnceWith(
      "https://checkout.infinitepay.com.br/complemento",
    );
  });

  it("rejects unsafe checkout URLs without navigating", async () => {
    const navigateToCheckout = vi.fn();
    const { user } = setup({
      navigateToCheckout,
      startCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: "https://example.com/phishing",
        orderNsu: "order-1",
      }),
    });
    await user.click(screen.getByRole("button", { name: /Pagar saldo de R\$\s*120,00/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir o pagamento. Tente novamente.",
    );
    expect(navigateToCheckout).not.toHaveBeenCalled();
  });
});
