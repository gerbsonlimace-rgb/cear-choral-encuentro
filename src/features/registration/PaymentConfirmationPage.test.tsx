import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PaymentLookup } from "./registration.domain";
import { PaymentConfirmationPage } from "./PaymentConfirmationPage";

const lookup: PaymentLookup = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  transactionNsu: "transaction-123",
  slug: "invoice-123",
  receiptUrl: "https://checkout.infinitepay.com.br/receipt-123",
};

describe("PaymentConfirmationPage", () => {
  it("shows a confirmed Pix payment without personal data", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
    expect(screen.getByText("Pix")).toBeVisible();
    expect(screen.queryByText("transaction-123")).not.toBeInTheDocument();
  });

  it("retries a pending payment and then confirms it", async () => {
    vi.useFakeTimers();
    const verifyPayment = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({
        status: "paid" as const,
        paymentMethod: "credit_card" as const,
        installments: 2,
      });

    try {
      render(
        <PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} retryDelayMs={10} />,
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByText("Inscrição confirmada")).toBeVisible();
      expect(screen.getByText("Cartão em 2 parcelas")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not expose or link an untrusted receipt URL", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      receiptUrl: undefined,
    });

    render(
      <PaymentConfirmationPage
        lookup={{ ...lookup, receiptUrl: "https://malicious.example" }}
        verifyPayment={verifyPayment}
      />,
    );

    await screen.findByText("Inscrição confirmada");
    expect(screen.queryByRole("link", { name: "Ver comprovante" })).not.toBeInTheDocument();
  });

  it("does not restart verification when an equivalent lookup is rendered again", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
    });
    const { rerender } = render(
      <PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />,
    );

    await screen.findByText("Inscrição confirmada");
    rerender(<PaymentConfirmationPage lookup={{ ...lookup }} verifyPayment={verifyPayment} />);

    await waitFor(() => expect(verifyPayment).toHaveBeenCalledTimes(1));
  });

  it("stops after three pending verifications until the visitor asks to check again", async () => {
    vi.useFakeTimers();
    const verifyPayment = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({
        status: "paid" as const,
        paymentMethod: "pix" as const,
        installments: 1,
      });

    try {
      render(
        <PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} retryDelayMs={10} />,
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByText("Pagamento ainda não confirmado")).toBeVisible();
      expect(verifyPayment).toHaveBeenCalledTimes(3);

      fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByText("Inscrição confirmada")).toBeVisible();
      expect(verifyPayment).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
