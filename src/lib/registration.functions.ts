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

export function createRegistrationResumeHandler(
  service: Pick<RegistrationPaymentService, "resumeCheckout">,
) {
  return async (input: unknown): Promise<RegistrationResumeResult> =>
    service.resumeCheckout(registrationResumeSchema.parse(input));
}

export const startRegistrationCheckout = createServerFn({ method: "POST" })
  .validator(registrationSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    return getRegistrationPaymentService().startCheckout(data);
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
