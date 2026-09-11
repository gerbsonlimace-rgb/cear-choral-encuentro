import { describe, expect, it, vi } from "vitest";
import { createPaymentReconciliationDispatcher } from "./payment-dispatch.server";

const lookup = {
  orderNsu: "33333333-3333-4333-8333-333333333333",
  transactionNsu: "tx-1",
  slug: "invoice-1",
};

describe("payment reconciliation dispatcher", () => {
  it("routes complement orders to the complement service", async () => {
    const complement = {
      findByOrderNsu: vi.fn().mockResolvedValue({ status: "pending" }),
      reconcilePayment: vi.fn().mockResolvedValue({ status: "paid" }),
    };
    const registration = { reconcilePayment: vi.fn() };
    await expect(
      createPaymentReconciliationDispatcher({ complement, registration })(lookup),
    ).resolves.toEqual({ status: "paid" });
    expect(complement.reconcilePayment).toHaveBeenCalledWith(
      lookup,
      expect.objectContaining({ role: "admin" }),
    );
    expect(registration.reconcilePayment).not.toHaveBeenCalled();
  });

  it("preserves registration reconciliation for non-complement orders", async () => {
    const complement = {
      findByOrderNsu: vi.fn().mockResolvedValue(null),
      reconcilePayment: vi.fn(),
    };
    const registration = { reconcilePayment: vi.fn().mockResolvedValue({ status: "pending" }) };
    await expect(
      createPaymentReconciliationDispatcher({ complement, registration })(lookup),
    ).resolves.toEqual({ status: "pending" });
    expect(registration.reconcilePayment).toHaveBeenCalledWith(lookup);
    expect(complement.reconcilePayment).not.toHaveBeenCalled();
  });
});
