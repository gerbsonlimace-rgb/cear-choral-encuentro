import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PaymentLookup } from "./registration.domain";
import { REGISTRATION_DRAFT_STORAGE_KEY } from "./registration-draft";
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
  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows a terminal review message for a paid superseded checkout", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({ status: "paid_requires_review" });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(
      await screen.findByText("Pagamento recebido e em análise. Não realize outro pagamento."),
    ).toBeVisible();
    expect(screen.getByTestId("payment-confirmation-shell")).toHaveAttribute(
      "data-confirmation-state",
      "review",
    );
    expect(screen.queryByRole("button", { name: "Verificar novamente" })).not.toBeInTheDocument();
    expect(verifyPayment).toHaveBeenCalledTimes(1);
  });

  it("offers portal and WhatsApp shortcuts after payment verification", async () => {
    const whatsappGroupUrl = "https://chat.whatsapp.com/example-invite";
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      participantAccessStatus: "active",
      whatsappGroupUrl,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(screen.queryByRole("link", { name: /grupo do WhatsApp/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Acesso ao portal do participante" })).toBeVisible();
    const groupLink = screen.getByRole("link", { name: "Entrar no grupo do WhatsApp" });
    expect(groupLink).toHaveAttribute("href", whatsappGroupUrl);
    expect(groupLink).toHaveAttribute("target", "_blank");
    expect(groupLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not invent a group invitation when the server returns none", async () => {
    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={vi.fn().mockResolvedValue({
      status: "paid", paymentMethod: "pix", installments: 1, participantAccessStatus: "active",
    })} />);

    await screen.findByText("Inscrição confirmada");
    expect(screen.queryByRole("link", { name: /grupo do WhatsApp/i })).not.toBeInTheDocument();
  });

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

  it("clears the saved registration draft after payment is confirmed", async () => {
    window.localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, "saved draft");
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
    expect(window.localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("shows an honest paid promotional pre-registration confirmation", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      pricingType: "promotional" as const,
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Pré-inscrição confirmada")).toBeVisible();
    expect(screen.getByText("Acesso ao app liberado")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Veja como funciona o app do participante" })).not.toBeInTheDocument();
    expect(screen.getByText(/Meta das rifas \(20 rifas\): R\$\s*200,00/)).toBeVisible();
    expect(screen.getByText(/vaga será confirmada após a conclusão do programa de rifas/i)).toBeVisible();
    expect(screen.queryByText("Vaga confirmada")).not.toBeInTheDocument();
  });

  it("shows a settled standard registration without a remaining-value message", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      pricingType: "standard" as const,
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
    expect(screen.getByText("Vaga confirmada")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Veja como funciona o app do participante" })).toBeVisible();
    expect(screen.queryByText(/Meta das rifas/)).not.toBeInTheDocument();
  });

  it("shows a branded confirmation with registration details, export, and Coralista access", async () => {
    const downloadReceipt = vi.fn().mockResolvedValue(undefined);
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      participantName: "Maria de Lourdes",
      participantEmail: "maria@example.com",
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
    expect(screen.getByText(/acesso ao portal do participante/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Acesso ao portal do participante" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Baixar comprovante em PDF" }));
    await waitFor(() => expect(downloadReceipt).toHaveBeenCalledTimes(1));
  });

  it("keeps processing and confirmed states in one animated shell", async () => {
    let resolvePayment!: (status: {
      status: "paid";
      paymentMethod: "pix";
      installments: 1;
      participantAccessStatus: "active";
      pricingType: "standard";
      standardPriceCents: 30000;
      registrationPriceCents: 30000;
    }) => void;
    const verifyPayment = vi.fn(
      () =>
        new Promise<{
          status: "paid";
          paymentMethod: "pix";
          installments: 1;
          participantAccessStatus: "active";
          pricingType: "standard";
          standardPriceCents: 30000;
          registrationPriceCents: 30000;
        }>((resolve) => {
          resolvePayment = resolve;
        }),
    );

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);
    const shell = screen.getByTestId("payment-confirmation-shell");
    expect(shell).toHaveAttribute("data-confirmation-state", "processing");

    resolvePayment({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      participantAccessStatus: "active",
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
    });

    await waitFor(() => expect(shell).toHaveAttribute("data-confirmation-state", "paid"));
    expect(screen.getByText("Inscrição confirmada")).toBeVisible();
  });

  it("shows the participant portal guidance in a second column", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      participantEmail: "maria@example.com",
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(
      await screen.findByRole("heading", { name: "Acesso ao portal do participante" }),
    ).toBeVisible();
    expect(screen.getByTestId("confirmation-columns")).toHaveClass("lg:grid-cols-2");
    expect(screen.getByText(/Use as informações abaixo/i)).toBeVisible();
  });

  it("shows the portal link, login email, and six-digit CPF password", async () => {
    const verifyPayment = vi.fn().mockResolvedValue({
      status: "paid" as const,
      paymentMethod: "pix" as const,
      installments: 1,
      participantAccessStatus: "active" as const,
      participantPortalUrl: "/acessar",
      participantInitialPassword: "529982",
      participantEmail: "maria@example.com",
    });

    render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

    expect(await screen.findByRole("heading", { name: "Acesso ao portal do participante" })).toBeVisible();
    const portalLink = screen.getByRole("link", { name: "https://encontrocorosce.lovable.app/acessar" });
    expect(portalLink).toHaveAttribute("href", "https://encontrocorosce.lovable.app/acessar");
    expect(screen.getByText("Login (e-mail cadastrado)")).toBeVisible();
    expect(screen.getByText("maria@example.com")).toBeVisible();
    expect(screen.getByText("Senha (6 primeiros dígitos do CPF)")).toBeVisible();
    expect(screen.getByText("529982")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Acessar portal do participante" })).not.toBeInTheDocument();
  });

  it.each([
    [
      "pending",
      "Seu pagamento foi confirmado. Estamos preparando seu acesso à área do participante.",
    ],
    ["conflict", "Seu acesso precisa de atendimento da organização."],
  ] as const)(
    "keeps a paid promotional pre-registration honest while access is %s",
    async (participantAccessStatus, message) => {
      const verifyPayment = vi.fn().mockResolvedValue({
        status: "paid" as const,
        paymentMethod: "pix" as const,
        installments: 1,
        participantAccessStatus,
        pricingType: "promotional" as const,
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      });

      render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);

      expect(await screen.findByText("Pré-inscrição confirmada")).toBeVisible();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Acesso ao portal do participante" })).toBeVisible();
      expect(screen.getByText(/Meta das rifas \(20 rifas\): R\$\s*200,00/)).toBeVisible();
      expect(screen.getByText(/vaga será confirmada após a conclusão do programa de rifas/i)).toBeVisible();
      expect(screen.queryByText("Acesso ao app liberado")).not.toBeInTheDocument();
    },
  );

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

      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Acesso ao portal do participante" })).toBeVisible();
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
