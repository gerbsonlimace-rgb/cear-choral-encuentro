import { createServerFn } from "@tanstack/react-start";
import {
  paymentLookupSchema,
  registrationSchema,
} from "@/features/registration/registration.domain";

export const startRegistrationCheckout = createServerFn({ method: "POST" })
  .validator(registrationSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } = await import(
      "@/features/registration/registration-payment.server"
    );
    return getRegistrationPaymentService().startCheckout(data);
  });

export const verifyRegistrationPayment = createServerFn({ method: "POST" })
  .validator(paymentLookupSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } = await import(
      "@/features/registration/registration-payment.server"
    );
    return getRegistrationPaymentService().reconcilePayment(data);
  });
