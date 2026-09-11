import type { PaymentLookup } from "./registration.domain";
import type { PublicPaymentStatus } from "./registration-payment.server";
import type { PortalAccess } from "@/features/regent/regent.domain";

const webhookAccess: PortalAccess = { role: "admin", userId: "infinitepay-webhook", email: null };

export function createPaymentReconciliationDispatcher({
  complement,
  registration,
}: {
  complement: {
    findByOrderNsu(orderNsu: string): Promise<unknown>;
    reconcilePayment(lookup: PaymentLookup, access: PortalAccess): Promise<PublicPaymentStatus>;
  };
  registration: { reconcilePayment(lookup: PaymentLookup): Promise<PublicPaymentStatus> };
}) {
  return async (lookup: PaymentLookup) => {
    const complementPayment = await complement.findByOrderNsu(lookup.orderNsu);
    return complementPayment
      ? complement.reconcilePayment(lookup, webhookAccess)
      : registration.reconcilePayment(lookup);
  };
}
