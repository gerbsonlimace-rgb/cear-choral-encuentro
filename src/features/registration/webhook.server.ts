import { z } from "zod";
import type { PaymentLookup } from "./registration.domain";
import type { PublicPaymentStatus } from "./registration-payment.server";

const webhookSchema = z.object({
  invoice_slug: z.string().trim().min(1).max(200),
  amount: z.number().int().positive(),
  paid_amount: z.number().int().positive(),
  installments: z.number().int().positive(),
  capture_method: z.enum(["pix", "credit_card"]),
  transaction_nsu: z.string().trim().min(1).max(200),
  order_nsu: z.string().uuid(),
  receipt_url: z.string().url().optional(),
  items: z.array(z.unknown()).optional(),
});

const failedResponse = () =>
  Response.json(
    { success: false, message: "Não foi possível confirmar o pedido." },
    { status: 400 },
  );

export async function handleInfinitePayWebhook(
  request: Request,
  reconcile: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    console.error("[InfinitePay webhook] invalid JSON");
    return failedResponse();
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[InfinitePay webhook] invalid payload");
    return failedResponse();
  }

  try {
    const result = await reconcile({
      orderNsu: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      slug: parsed.data.invoice_slug,
      receiptUrl: parsed.data.receipt_url,
    });
    if (result.status !== "paid") {
      console.error("[InfinitePay webhook] reconciliation pending");
      return failedResponse();
    }
    return Response.json({ success: true, message: null }, { status: 200 });
  } catch {
    console.error("[InfinitePay webhook] reconciliation failed");
    return failedResponse();
  }
}
