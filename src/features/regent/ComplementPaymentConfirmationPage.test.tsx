import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaymentLookup } from "@/features/registration/registration.domain";
import { ComplementPaymentConfirmationPage } from "./ComplementPaymentConfirmationPage";

const lookup: PaymentLookup = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  transactionNsu: "transaction-123",
  slug: "invoice-123",
};

describe("ComplementPaymentConfirmationPage", () => {
  it("shows a confirmed complement and a safe return to the regent portal", async () => {
    render(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={vi.fn().mockResolvedValue({
          status: "paid",
          paymentMethod: "pix",
          installments: 1,
        })}
      />,
    );

    expect(await screen.findByText("Complemento confirmado")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar à área do regente" })).toHaveAttribute(
      "href",
      "/regente",
    );
  });

  it("shows processing while verification is in flight", () => {
    render(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={async () => await new Promise<never>(() => undefined)}
      />,
    );

    expect(screen.getByText("Confirmando pagamento…")).toBeVisible();
  });

  it("offers a retry after a payment remains unconfirmed", async () => {
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
        <ComplementPaymentConfirmationPage
          lookup={lookup}
          verifyPayment={verifyPayment}
          retryDelayMs={10}
        />,
      );
      await vi.advanceTimersByTimeAsync(25);

      expect(screen.getByText("Pagamento complementar ainda não confirmado")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
      await vi.advanceTimersByTimeAsync(0);
      expect(screen.getByText("Complemento confirmado")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a non-confirmed state when verification fails", async () => {
    render(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={vi.fn().mockRejectedValue(new Error("provider unavailable"))}
      />,
    );

    expect(await screen.findByText("Não foi possível verificar agora")).toBeVisible();
  });
});
