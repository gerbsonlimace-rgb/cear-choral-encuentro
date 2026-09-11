import { z } from "zod";
import type { CheckoutItem, PaymentLookup } from "./registration.domain";

const INFINITEPAY_API_URL = "https://api.checkout.infinitepay.io";
const PROVIDER_ERROR_MESSAGE = "Não foi possível comunicar com a InfinitePay.";

const checkoutResponseSchema = z
  .object({
    url: z.string().url().optional(),
    checkout_url: z.string().url().optional(),
  })
  .refine((value) => value.url || value.checkout_url, "URL de checkout ausente.");

const paymentCheckResponseSchema = z.discriminatedUnion("paid", [
  z.object({ paid: z.literal(false) }),
  z.object({
    success: z.literal(true),
    paid: z.literal(true),
    amount: z.number().int().nonnegative(),
    paid_amount: z.number().int().nonnegative(),
    installments: z.number().int().positive(),
    capture_method: z.enum(["pix", "credit_card"]),
  }),
]);

export type PaymentMethod = "pix" | "credit_card";
export type CheckedPayment =
  | { paid: false }
  | {
      paid: true;
      amountCents: number;
      paidAmountCents: number;
      installments: number;
      paymentMethod: PaymentMethod;
    };

export class InfinitePayProviderError extends Error {
  constructor(
    readonly outcome: "confirmed_rejection" | "unknown",
    message = PROVIDER_ERROR_MESSAGE,
  ) {
    super(message);
    this.name = "InfinitePayProviderError";
  }
}

export type InfinitePayClient = {
  createCheckout(input: {
    orderNsu: string;
    items: CheckoutItem[];
    customer?: { name: string; email: string; phoneNumber?: string };
    redirectPath?: "/pagamento" | "/regente/pagamento";
  }): Promise<{ url: string }>;
  checkPayment(input: PaymentLookup): Promise<CheckedPayment>;
};

function isAllowedInfinitePayHost(hostname: string, roots: readonly string[]) {
  return roots.some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

export function isSafeInfinitePayCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "checkout.infinitepay.io" || url.hostname === "checkout.infinitepay.com.br")
    );
  } catch {
    return false;
  }
}

export function sanitizeInfinitePayReceiptUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      isAllowedInfinitePayHost(url.hostname, ["infinitepay.io", "infinitepay.com.br"])
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function withSitePath(siteUrl: string, path: string) {
  return `${siteUrl.replace(/\/+$/, "")}${path}`;
}

async function postJson(fetcher: typeof fetch, path: string, body: unknown) {
  let response: Response;

  try {
    response = await fetcher(`${INFINITEPAY_API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new InfinitePayProviderError("unknown");
  }

  if (!response.ok) {
    const confirmedRejection = [400, 401, 403, 404, 422].includes(response.status);
    throw new InfinitePayProviderError(confirmedRejection ? "confirmed_rejection" : "unknown");
  }

  try {
    return await response.json();
  } catch {
    throw new InfinitePayProviderError("unknown");
  }
}

export function createInfinitePayClient(
  fetcher: typeof fetch,
  config: { handle: string; siteUrl: string },
): InfinitePayClient {
  return {
    async createCheckout(input) {
      let response: z.infer<typeof checkoutResponseSchema>;
      try {
        response = checkoutResponseSchema.parse(
          await postJson(fetcher, "/links", {
            handle: config.handle,
            items: input.items,
            order_nsu: input.orderNsu,
            redirect_url: withSitePath(config.siteUrl, input.redirectPath ?? "/pagamento"),
            webhook_url: withSitePath(config.siteUrl, "/api/infinitepay-webhook"),
            ...(input.customer
              ? {
                  customer: {
                    name: input.customer.name,
                    email: input.customer.email,
                    ...(input.customer.phoneNumber
                      ? { phone_number: input.customer.phoneNumber }
                      : {}),
                  },
                }
              : {}),
          }),
        );
      } catch (caught) {
        if (caught instanceof InfinitePayProviderError) throw caught;
        throw new InfinitePayProviderError("unknown");
      }
      const url = response.url ?? response.checkout_url;

      if (!url || !isSafeInfinitePayCheckoutUrl(url)) {
        throw new InfinitePayProviderError("unknown", "Endereço de checkout inválido");
      }

      return { url };
    },

    async checkPayment(input) {
      const response = paymentCheckResponseSchema.parse(
        await postJson(fetcher, "/payment_check", {
          handle: config.handle,
          order_nsu: input.orderNsu,
          transaction_nsu: input.transactionNsu,
          slug: input.slug,
        }),
      );

      if (!response.paid) {
        return { paid: false };
      }

      return {
        paid: true,
        amountCents: response.amount,
        paidAmountCents: response.paid_amount,
        installments: response.installments,
        paymentMethod: response.capture_method,
      };
    },
  };
}
