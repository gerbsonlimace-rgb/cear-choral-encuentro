import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleInfinitePayWebhook } from "./webhook.server";

const validBody = {
  invoice_slug: "abc123",
  amount: 10000,
  paid_amount: 10420,
  installments: 2,
  capture_method: "credit_card",
  transaction_nsu: "transaction-1",
  order_nsu: "11111111-1111-4111-8111-111111111111",
  receipt_url: "https://receipt.infinitepay.io/123",
  items: [],
};

const jsonRequest = (body: unknown) =>
  new Request("https://site.test/api/infinitepay-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("InfinitePay webhook", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await handleInfinitePayWebhook(
      new Request("https://site.test/api/infinitepay-webhook", { method: "POST", body: "{" }),
      vi.fn(),
    );

    expect(response.status).toBe(400);
  });

  it("verifies a valid webhook before acknowledging it", async () => {
    const reconcile = vi.fn().mockResolvedValue({
      status: "paid",
      paymentMethod: "credit_card",
      installments: 2,
      participantAccessStatus: "active",
    });

    const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);

    expect(reconcile).toHaveBeenCalledWith({
      orderNsu: validBody.order_nsu,
      transactionNsu: validBody.transaction_nsu,
      slug: validBody.invoice_slug,
      receiptUrl: validBody.receipt_url,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: null });
  });

  it("acknowledges a confirmed payment while participant access is still pending", async () => {
    const reconcile = vi.fn().mockResolvedValue({
      status: "paid",
      paymentMethod: "credit_card",
      installments: 2,
      participantAccessStatus: "pending",
    });

    const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: null });
  });

  it("acknowledges a confirmed complement without trusting webhook payment fields", async () => {
    const reconcile = vi.fn().mockResolvedValue({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
    });

    const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);

    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith({
      orderNsu: validBody.order_nsu,
      transactionNsu: validBody.transaction_nsu,
      slug: validBody.invoice_slug,
      receiptUrl: validBody.receipt_url,
    });
  });

  it("acknowledges and logs a superseded checkout payment for review", async () => {
    const reconcile = vi.fn().mockResolvedValue({ status: "paid_requires_review" });

    const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);

    expect(response.status).toBe(200);
    expect(consoleError).toHaveBeenCalledWith(
      "[InfinitePay webhook] superseded checkout paid",
      { orderNsu: validBody.order_nsu },
    );
  });

  it("rejects an otherwise valid payload with an unexpected property", async () => {
    const reconcile = vi.fn();

    const response = await handleInfinitePayWebhook(
      jsonRequest({ ...validBody, unexpected: "untrusted" }),
      reconcile,
    );

    expect(response.status).toBe(400);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("returns 400 when provider verification fails", async () => {
    const reconcile = vi.fn().mockRejectedValue(new Error("Valor do pagamento divergente"));

    expect((await handleInfinitePayWebhook(jsonRequest(validBody), reconcile)).status).toBe(400);
    expect(consoleError).toHaveBeenCalledWith("[InfinitePay webhook] reconciliation failed", {
      orderNsu: validBody.order_nsu,
      reason: "reconciliation_error",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("Valor do pagamento divergente");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(validBody.receipt_url);
  });

  it("returns 400 when reconciliation is still pending so InfinitePay retries", async () => {
    const reconcile = vi.fn().mockResolvedValue({ status: "pending" });

    const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);

    expect(response.status).toBe(400);
    expect(consoleError).toHaveBeenCalledWith("[InfinitePay webhook] reconciliation failed", {
      orderNsu: validBody.order_nsu,
      reason: "pending",
    });
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Não foi possível confirmar o pedido.",
    });
  });
});
