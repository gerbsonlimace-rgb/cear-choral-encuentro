import type { ComplementPaymentPublicStatus } from "@/features/regent/regent-payment.server";
import type { PaymentLookup } from "./registration.domain";
import type {
  PublicPaymentStatus,
  RegistrationPaymentService,
} from "./registration-payment.server";

type ReconciliationStatus = Pick<PublicPaymentStatus, "status"> | ComplementPaymentPublicStatus;

type ComplementPaymentService = {
  getComplementPaymentStatus(orderNsu: string): Promise<ComplementPaymentPublicStatus | null>;
  reconcilePayment(lookup: PaymentLookup): Promise<ComplementPaymentPublicStatus>;
};

type RegistrationReconciliationService = Pick<RegistrationPaymentService, "reconcilePayment">;

export function createPaymentReconciliationDispatcher({
  complement,
  registration,
}: {
  complement: ComplementPaymentService;
  registration: RegistrationReconciliationService;
}) {
  return async (lookup: PaymentLookup): Promise<ReconciliationStatus> => {
    const complementStatus = await complement.getComplementPaymentStatus(lookup.orderNsu);
    if (complementStatus) return complement.reconcilePayment(lookup);
    return registration.reconcilePayment(lookup);
  };
}

export async function dispatchPaymentReconciliation(
  lookup: PaymentLookup,
): Promise<ReconciliationStatus> {
  const [{ getRegentPaymentService }, { getRegistrationPaymentService }] = await Promise.all([
    import("@/features/regent/regent-payment.server"),
    import("./registration-payment.server"),
  ]);
  return createPaymentReconciliationDispatcher({
    complement: getRegentPaymentService(),
    registration: getRegistrationPaymentService(),
  })(lookup);
}
