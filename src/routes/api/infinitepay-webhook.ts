import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInfinitePayWebhook } = await import(
          "@/features/registration/webhook.server"
        );
        const { getRegistrationPaymentService } = await import(
          "@/features/registration/registration-payment.server"
        );
        return handleInfinitePayWebhook(
          request,
          (lookup) => getRegistrationPaymentService().reconcilePayment(lookup),
        );
      },
    },
  },
});
