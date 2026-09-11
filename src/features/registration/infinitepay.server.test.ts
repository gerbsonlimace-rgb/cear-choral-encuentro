import { describe, expect, it, vi } from "vitest";
import { createInfinitePayClient, sanitizeInfinitePayReceiptUrl } from "./infinitepay.server";

const config = {
  handle: "antonio-gerbson",
  siteUrl: "https://encontrocorosce.lovable.app",
};

const checkoutInput = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  items: [{ quantity: 1 as const, price: 10000, description: "Inscrição — II Encontro de Coros" }],
  customer: {
    name: "Maria",
    phoneNumber: "85999999999",
    email: "legacy@example.com",
  },
};

describe("InfinitePay client", () => {
  it("creates a checkout with server-owned identifiers and URLs", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ url: "https://checkout.infinitepay.com.br/antonio-gerbson/abc" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const client = createInfinitePayClient(fetcher, config);

    const result = await client.createCheckout(checkoutInput);

    expect(result.url).toContain("checkout.infinitepay.com.br");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      handle: "antonio-gerbson",
      items: checkoutInput.items,
      order_nsu: "11111111-1111-4111-8111-111111111111",
      redirect_url: "https://encontrocorosce.lovable.app/pagamento",
      webhook_url: "https://encontrocorosce.lovable.app/api/infinitepay-webhook",
      customer: {
        name: "Maria",
        email: "legacy@example.com",
        phone_number: "85999999999",
      },
    });
  });

  it("creates a complement checkout without customer data and with the regent return path", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ url: "https://checkout.infinitepay.com.br/antonio-gerbson/complement" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const client = createInfinitePayClient(fetcher, config);

    await expect(
      client.createCheckout({
        orderNsu: "22222222-2222-4222-8222-222222222222",
        items: [
          {
            quantity: 1,
            price: 5_000,
            description: "Complemento de inscrição — II Encontro de Coros",
          },
        ],
        redirectPath: "/regente/pagamento",
      }),
    ).resolves.toEqual({
      url: "https://checkout.infinitepay.com.br/antonio-gerbson/complement",
    });

    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      handle: "antonio-gerbson",
      items: [
        {
          quantity: 1,
          price: 5_000,
          description: "Complemento de inscrição — II Encontro de Coros",
        },
      ],
      order_nsu: "22222222-2222-4222-8222-222222222222",
      redirect_url: "https://encontrocorosce.lovable.app/regente/pagamento",
      webhook_url: "https://encontrocorosce.lovable.app/api/infinitepay-webhook",
    });
  });

  it("rejects a checkout URL outside InfinitePay", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://malicious.example/steal" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createInfinitePayClient(fetcher, config);

    await expect(client.createCheckout(checkoutInput)).rejects.toThrow(
      "Endereço de checkout inválido",
    );
  });

  it("maps a verified payment_check response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          paid: true,
          amount: 10000,
          paid_amount: 10420,
          installments: 2,
          capture_method: "credit_card",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createInfinitePayClient(fetcher, config);

    await expect(
      client.checkPayment({
        orderNsu: "11111111-1111-4111-8111-111111111111",
        transactionNsu: "transaction-1",
        slug: "invoice-1",
      }),
    ).resolves.toEqual({
      paid: true,
      amountCents: 10000,
      paidAmountCents: 10420,
      installments: 2,
      paymentMethod: "credit_card",
    });

    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      handle: "antonio-gerbson",
      order_nsu: "11111111-1111-4111-8111-111111111111",
      transaction_nsu: "transaction-1",
      slug: "invoice-1",
    });
  });

  it("rejects a paid response when the provider reports unsuccessful verification", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          paid: true,
          amount: 10000,
          paid_amount: 10000,
          installments: 1,
          capture_method: "pix",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      createInfinitePayClient(fetcher, config).checkPayment({
        orderNsu: "11111111-1111-4111-8111-111111111111",
        transactionNsu: "transaction-1",
        slug: "invoice-1",
      }),
    ).rejects.toThrow();
  });

  it("rejects a paid response when the provider omits its verification result", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paid: true,
          amount: 10000,
          paid_amount: 10000,
          installments: 1,
          capture_method: "pix",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      createInfinitePayClient(fetcher, config).checkPayment({
        orderNsu: "11111111-1111-4111-8111-111111111111",
        transactionNsu: "transaction-1",
        slug: "invoice-1",
      }),
    ).rejects.toThrow();
  });

  it("uses the documented checkout_url alternate response field", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ checkout_url: "https://checkout.infinitepay.io/antonio-gerbson/abc" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      createInfinitePayClient(fetcher, config).createCheckout(checkoutInput),
    ).resolves.toEqual({
      url: "https://checkout.infinitepay.io/antonio-gerbson/abc",
    });
  });

  it("does not return a malformed provider checkout response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      createInfinitePayClient(fetcher, config).createCheckout(checkoutInput),
    ).rejects.toThrow();
  });

  it("returns the public provider error when checkout creation is unsuccessful", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(
      createInfinitePayClient(fetcher, config).createCheckout(checkoutInput),
    ).rejects.toMatchObject({
      message: "Não foi possível comunicar com a InfinitePay.",
      outcome: "unknown",
    });
  });

  it("classifies a validated provider rejection so its reservation can be released", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("invalid checkout", { status: 422 }));

    await expect(
      createInfinitePayClient(fetcher, config).createCheckout(checkoutInput),
    ).rejects.toMatchObject({
      message: "Não foi possível comunicar com a InfinitePay.",
      outcome: "confirmed_rejection",
    });
  });

  it("maps a minimal unpaid payment_check response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ paid: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      createInfinitePayClient(fetcher, config).checkPayment({
        orderNsu: "11111111-1111-4111-8111-111111111111",
        transactionNsu: "transaction-1",
        slug: "invoice-1",
      }),
    ).resolves.toEqual({ paid: false });
  });

  it("does not treat a paid response missing a verification field as paid", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ paid: true, amount: 10000, paid_amount: 10000, installments: 1 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    await expect(
      createInfinitePayClient(fetcher, config).checkPayment({
        orderNsu: "11111111-1111-4111-8111-111111111111",
        transactionNsu: "transaction-1",
        slug: "invoice-1",
      }),
    ).rejects.toThrow();
  });
});

describe("sanitizeInfinitePayReceiptUrl", () => {
  it("accepts HTTPS receipt URLs on InfinitePay domains", () => {
    expect(sanitizeInfinitePayReceiptUrl("https://receipts.infinitepay.com.br/receipt/abc")).toBe(
      "https://receipts.infinitepay.com.br/receipt/abc",
    );
  });

  it("rejects non-HTTPS and lookalike receipt URLs", () => {
    expect(sanitizeInfinitePayReceiptUrl("http://infinitepay.io/receipt/abc")).toBeUndefined();
    expect(
      sanitizeInfinitePayReceiptUrl("https://infinitepay.io.evil.example/receipt/abc"),
    ).toBeUndefined();
  });
});
