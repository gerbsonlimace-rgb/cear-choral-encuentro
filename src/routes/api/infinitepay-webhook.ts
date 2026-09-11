import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInfinitePayWebhook } = await import("@/features/registration/webhook.server");
        const { getRegistrationPaymentService } =
          await import("@/features/registration/registration-payment.server");
        const { getRegentPaymentService } = await import("@/features/regent/regent-payment.server");
        const { createPaymentReconciliationDispatcher } =
          await import("@/features/registration/payment-dispatch.server");
        const reconcile = createPaymentReconciliationDispatcher({
          complement: getRegentPaymentService(),
          registration: getRegistrationPaymentService(),
        });
        return handleInfinitePayWebhook(request, reconcile);
      },
    },
  },
});
