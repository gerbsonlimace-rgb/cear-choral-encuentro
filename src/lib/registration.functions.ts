import { createServerFn } from "@tanstack/react-start";
import {
  paymentLookupSchema,
  registrationSchema,
} from "@/features/registration/registration.domain";

export type StartRegistrationCheckoutResult =
  { ok: true; checkoutUrl: string; orderNsu: string } | { ok: false; message: string };

export const startRegistrationCheckout = createServerFn({ method: "POST" })
  .validator(registrationSchema)
  .handler(async ({ data }): Promise<StartRegistrationCheckoutResult> => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    const { EXTERNAL_CHECKOUT_DISABLED_MESSAGE } =
      await import("@/features/registration/infinitepay.server");

    try {
      const checkout = await getRegistrationPaymentService().startCheckout(data);
      return { ok: true, ...checkout };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      console.error("[Registration checkout] creation failed", {
        reason: message || "unknown error",
      });

      return {
        ok: false,
        message:
          message === EXTERNAL_CHECKOUT_DISABLED_MESSAGE
            ? EXTERNAL_CHECKOUT_DISABLED_MESSAGE
            : message.includes("Já existe uma inscrição para este CPF") ||
                message.includes("configuração de preços mudou") ||
                message.includes("Coro selecionado não está disponível")
              ? message
              : "Não foi possível preparar o pagamento. Tente novamente.",
      };
    }
  });

export const verifyRegistrationPayment = createServerFn({ method: "POST" })
  .validator(paymentLookupSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    return getRegistrationPaymentService().reconcilePayment(data);
  });
