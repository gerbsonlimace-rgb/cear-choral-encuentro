import { createServerFn } from "@tanstack/react-start";
import {
  paymentLookupSchema,
  registrationResumeSchema,
  registrationSchema,
} from "@/features/registration/registration.domain";
import type {
  RegistrationPaymentService,
  RegistrationResumeResult,
} from "@/features/registration/registration-payment.server";

export function getRegistrationCheckoutFailureMessage(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : "";
  if (message.includes("Já existe uma inscrição para este CPF")) return message;
  if (
    message.includes("configuração de preços mudou") ||
    message.includes("Coro selecionado não está disponível")
  )
    return message;
  return "Não foi possível preparar o pagamento. Tente novamente.";
}

export function createRegistrationResumeHandler(
  service: Pick<RegistrationPaymentService, "resumeCheckout">,
) {
  return async (input: unknown): Promise<RegistrationResumeResult> =>
    service.resumeCheckout(registrationResumeSchema.parse(input));
}

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
            : getRegistrationCheckoutFailureMessage(caught),
      };
    }
  });

export const resumeRegistrationCheckout = createServerFn({ method: "POST" })
  .validator(registrationResumeSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    return createRegistrationResumeHandler(getRegistrationPaymentService())(data);
  });

export const verifyRegistrationPayment = createServerFn({ method: "POST" })
  .validator(paymentLookupSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    return getRegistrationPaymentService().reconcilePayment(data);
  });
