import { describe, expect, it, vi } from "vitest";
import type { PaymentLookup } from "./registration.domain";
import { createPaymentReconciliationDispatcher } from "./payment-dispatch.server";

const lookup: PaymentLookup = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  transactionNsu: "transaction-123",
  slug: "invoice-123",
};

describe("payment reconciliation dispatcher", () => {
  it("reconciles a complement order through its own ledger service", async () => {
    const complement = {
      getComplementPaymentStatus: vi.fn().mockResolvedValue({ status: "pending" }),
      reconcilePayment: vi.fn().mockResolvedValue({ status: "paid" }),
    };
    const registration = { reconcilePayment: vi.fn() };
    const dispatch = createPaymentReconciliationDispatcher({ complement, registration });

    await expect(dispatch(lookup)).resolves.toEqual({ status: "paid" });
    expect(complement.reconcilePayment).toHaveBeenCalledWith(lookup);
    expect(registration.reconcilePayment).not.toHaveBeenCalled();
  });

  it("keeps original registration orders on the existing reconciliation service", async () => {
    const complement = {
      getComplementPaymentStatus: vi.fn().mockResolvedValue(null),
      reconcilePayment: vi.fn(),
    };
    const registration = { reconcilePayment: vi.fn().mockResolvedValue({ status: "paid" }) };
    const dispatch = createPaymentReconciliationDispatcher({ complement, registration });

    await expect(dispatch(lookup)).resolves.toEqual({ status: "paid" });
    expect(complement.reconcilePayment).not.toHaveBeenCalled();
    expect(registration.reconcilePayment).toHaveBeenCalledWith(lookup);
  });
});
