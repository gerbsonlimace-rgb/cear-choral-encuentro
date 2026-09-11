import type { PaymentLookup } from "./registration.domain";
import type { PublicPaymentStatus } from "./registration-payment.server";

export function createPaymentReconciliationDispatcher({
  complement,
  registration,
}: {
  complement: {
    findByOrderNsu(orderNsu: string): Promise<unknown>;
    reconcilePayment(lookup: PaymentLookup): Promise<PublicPaymentStatus>;
  };
  registration: { reconcilePayment(lookup: PaymentLookup): Promise<PublicPaymentStatus> };
}) {
  return async (lookup: PaymentLookup) => {
    const complementPayment = await complement.findByOrderNsu(lookup.orderNsu);
    return complementPayment
      ? complement.reconcilePayment(lookup)
      : registration.reconcilePayment(lookup);
  };
}
