import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PaymentLookup } from "./registration.domain";
import { PaymentConfirmationPage } from "./PaymentConfirmationPage";

const lookup: PaymentLookup = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  transactionNsu: "transaction-123",
  slug: "invoice-123",
  receiptUrl: "https://checkout.infinitepay.com.br/receipt-123",
};

const nextLookup: PaymentLookup = {
  orderNsu: "22222222-2222-4222-8222-222222222222",
  transactionNsu: "transaction-456",
  slug: "invoice-456",
  receiptUrl: "https://checkout.infinitepay.com.br/receipt-456",
};

describe("PaymentConfirmationPage", () => {
  it("explains when the payment lookup is missing and offers a way home", () => {
    render(<PaymentConfirmationPage lookup={null} verifyPayment={vi.fn()} />);

    expect(screen.getByText("Não foi possível identificar este pagamento.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

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

  it("shows a branded confirmation with registration details, export, and Coralista access", async () => {
    const downloadReceipt = vi.fn().mockResolvedValue(undefined);
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      participantName: "Maria de Lourdes",
      choirName: "Coro Diocesano de Quixadá",
      amountCents: 12000,
      paidAmountCents: 12000,
      paidAt: "2026-09-11T18:30:00.000Z",
      orderNsu: lookup.orderNsu,
    });

    render(
      <PaymentConfirmationPage
        lookup={lookup}
        verifyPayment={verifyPayment}
        downloadReceipt={downloadReceipt}
      />,
    );

    expect(await screen.findByText("Maria de Lourdes")).toBeVisible();
    expect(screen.getByText("Coro Diocesano de Quixadá")).toBeVisible();
    expect(screen.getByText("R$ 120,00")).toBeVisible();
    expect(screen.getByText(/acesso ao portal está pronto/i)).toBeVisible();

    const accessLink = screen.getByRole("link", { name: "Acessar o portal do participante" });
    expect(accessLink).toHaveAttribute("href", "/acessar");

    fireEvent.click(screen.getByRole("button", { name: "Baixar comprovante em PDF" }));
    await waitFor(() => expect(downloadReceipt).toHaveBeenCalledTimes(1));
  });

  it("shows the portal link and initial password only after participant access is active", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      participantPortalUrl: "/acessar",
      participantInitialPassword: "5299822472515011990",
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(
      await screen.findByRole("link", { name: "Acessar o portal do participante" }),
    ).toHaveAttribute("href", "/acessar");
    expect(screen.getByText("Senha inicial")).toBeVisible();
    expect(screen.getByText("5299822472515011990")).toBeVisible();
  });

  it.each([
    [
      "pending",
      "Seu pagamento foi confirmado. Estamos preparando seu acesso à área do participante.",
    ],
    ["conflict", "Seu acesso precisa de atendimento da organização."],
  ] as const)(
    "keeps a paid %s participant access state honest",
    async (participantAccessStatus, message) => {
      const verifyPayment = vi.fn().mockResolvedValue({
        status: "paid" as const,
        paymentMethod: "pix" as const,
        installments: 1,
        participantAccessStatus,
      });

      render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

      expect(await screen.findByText(message)).toBeVisible();
      expect(
        screen.queryByRole("link", { name: "Acessar o portal do participante" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Senha inicial")).not.toBeInTheDocument();
      expect(screen.queryByText("Não faça outro pagamento.")).not.toBeInTheDocument();
    },
  );

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

  it("uses singular wording for a one-installment card payment", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "credit_card" as const,
      installments: 1,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Cartão em 1 parcela")).toBeVisible();
  });

  it("links only the receipt returned by server verification", async () => {
    const receiptUrl = "https://receipts.infinitepay.io/receipt/confirmed";
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      receiptUrl,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByRole("link", { name: "Ver comprovante" })).toHaveAttribute(
      "href",
      receiptUrl,
    );
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

  it("does not commit a previous payment confirmation while switching to a new lookup", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      receiptUrl: "https://receipts.example/confirmed-a",
    });
    let committedContentForNextLookup = "";

    function LookupSwitch() {
      const [activeLookup, setActiveLookup] = useState(lookup);

      useLayoutEffect(() => {
        if (activeLookup.orderNsu === nextLookup.orderNsu) {
          committedContentForNextLookup = document.body.textContent ?? "";
        }
      }, [activeLookup]);

      return (
        <>
          <button onClick={() => setActiveLookup(nextLookup)}>Carregar outro pagamento</button>
          <PaymentConfirmationPage lookup={activeLookup} verifyPayment={verifyPayment} />
        </>
      );
    }

    render(<LookupSwitch />);
    await screen.findByText("Inscrição confirmada");

    fireEvent.click(screen.getByRole("button", { name: "Carregar outro pagamento" }));

    expect(committedContentForNextLookup).toContain("Confirmando pagamento…");
    expect(committedContentForNextLookup).not.toContain("Inscrição confirmada");
    expect(committedContentForNextLookup).not.toContain("Ver comprovante");
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
      expect(screen.getByText("Não faça outro pagamento.")).toBeVisible();
      expect(verifyPayment).toHaveBeenCalledTimes(3);

      fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
      await vi.advanceTimersByTimeAsync(0);

      expect(screen.getByText("Inscrição confirmada")).toBeVisible();
      expect(verifyPayment).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers manually after a temporary verification error", async () => {
    const verifyPayment = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary provider error"))
      .mockResolvedValueOnce({
        status: "paid" as const,
        paymentMethod: "pix" as const,
        installments: 1,
      });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Não foi possível verificar agora")).toBeVisible();
    expect(screen.getByText("Não faça outro pagamento.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));

    expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
    expect(verifyPayment).toHaveBeenCalledTimes(2);
  });

  it("cancels a scheduled pending retry after unmount", async () => {
    vi.useFakeTimers();
    const verifyPayment = vi.fn().mockResolvedValue({ status: "pending" as const });

    try {
      const { unmount } = render(
        <PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} retryDelayMs={10} />,
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(verifyPayment).toHaveBeenCalledTimes(1);

      unmount();
      await vi.advanceTimersByTimeAsync(20);

      expect(verifyPayment).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
