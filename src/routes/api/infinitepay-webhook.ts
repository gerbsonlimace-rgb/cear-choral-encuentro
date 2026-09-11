import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInfinitePayWebhook } = await import("@/features/registration/webhook.server");
        const { dispatchPaymentReconciliation } =
          await import("@/features/registration/payment-dispatch.server");
        return handleInfinitePayWebhook(request, dispatchPaymentReconciliation);
      },
    },
  },
});
