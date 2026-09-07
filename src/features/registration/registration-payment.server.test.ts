import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "./infinitepay.server";
import type { PaymentLookup, RegistrationInput } from "./registration.domain";
import {
  createRegistrationPaymentService,
  type RegistrationPaymentRecord,
  type RegistrationRepository,
} from "./registration-payment.server";

const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const fixedPaidAt = "2026-09-07T15:30:00.000Z";
const checkoutUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";

const baseInput: RegistrationInput = {
  name: "Maria da Silva",
  email: "maria@example.com",
  phone: "85999999999",
  city: "Quixadá",
  institution: "Coro Paroquial",
  role: "singer",
  includeShirt: false,
  shirtSize: "",
  observations: "",
};

const lookup: PaymentLookup = {
  orderNsu: fixedOrderNsu,
  transactionNsu: "transaction-1",
  slug: "invoice-1",
  receiptUrl: "https://receipts.infinitepay.com.br/receipt/abc",
};

function pendingRecord(): RegistrationPaymentRecord {
  return {
    id: "registration-1",
    orderNsu: fixedOrderNsu,
    amountCents: 10000,
    paymentStatus: "pending",
    transactionNsu: null,
    paymentMethod: null,
    installments: null,
    receiptUrl: null,
  };
}

function createFixture() {
  const calls: string[] = [];
  let record: RegistrationPaymentRecord | null = null;

  const repository: RegistrationRepository = {
    createPending: vi.fn(async (input) => {
      calls.push("createPending");
      record = {
        ...pendingRecord(),
        orderNsu: input.orderNsu,
        amountCents: input.amountCents,
      };
    }),
    saveCheckoutUrl: vi.fn(async () => {
      calls.push("saveCheckoutUrl");
    }),
    findPayment: vi.fn(async () => record),
    markPaid: vi.fn(async (orderNsu, confirmation) => {
      calls.push("markPaid");
      record = {
        id: "registration-1",
        orderNsu,
        amountCents: 10000,
        paymentStatus: "paid",
        transactionNsu: confirmation.transactionNsu,
        paymentMethod: confirmation.paymentMethod,
        installments: confirmation.installments,
        receiptUrl: confirmation.receiptUrl ?? null,
      };
      return record;
    }),
  };

  const infinitePay: InfinitePayClient = {
    createCheckout: vi.fn(async () => {
      calls.push("createCheckout");
      return { url: checkoutUrl };
    }),
    checkPayment: vi.fn(async () => ({
      paid: true,
      amountCents: 10000,
      paidAmountCents: 10420,
      installments: 2,
      paymentMethod: "credit_card" as const,
    })),
  };

  const service = createRegistrationPaymentService({
    repository,
    infinitePay,
    randomUUID: () => fixedOrderNsu,
    now: () => fixedPaidAt,
  });

  return {
    calls,
    infinitePay,
    repository,
    service,
    setRecord(next: RegistrationPaymentRecord | null) {
      record = next;
    },
  };
}

describe("registration payment service", () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it("stores a pending registration before requesting checkout", async () => {
    const result = await fixture.service.startCheckout(baseInput);

    expect(fixture.calls).toEqual(["createPending", "createCheckout", "saveCheckoutUrl"]);
    expect(fixture.repository.createPending).toHaveBeenCalledWith({
      ...baseInput,
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
    });
    expect(result).toEqual({ checkoutUrl, orderNsu: fixedOrderNsu });
  });

  it("leaves the registration pending when checkout creation fails", async () => {
    vi.mocked(fixture.infinitePay.createCheckout).mockRejectedValueOnce(
      new Error("InfinitePay indisponível"),
    );

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow();

    await expect(fixture.repository.findPayment(fixedOrderNsu)).resolves.toMatchObject({
      paymentStatus: "pending",
    });
    expect(fixture.repository.saveCheckoutUrl).not.toHaveBeenCalled();
  });

  it("rejects an original amount different from the local order", async () => {
    fixture.setRecord(pendingRecord());
    vi.mocked(fixture.infinitePay.checkPayment).mockResolvedValueOnce({
      paid: true,
      amountCents: 9999,
      paidAmountCents: 10420,
      installments: 2,
      paymentMethod: "credit_card",
    });

    await expect(fixture.service.reconcilePayment(lookup)).rejects.toThrow(
      "Valor do pagamento divergente",
    );
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
  });

  it("rejects an amount paid below the local order", async () => {
    fixture.setRecord(pendingRecord());
    vi.mocked(fixture.infinitePay.checkPayment).mockResolvedValueOnce({
      paid: true,
      amountCents: 10000,
      paidAmountCents: 9999,
      installments: 1,
      paymentMethod: "pix",
    });

    await expect(fixture.service.reconcilePayment(lookup)).rejects.toThrow(
      "Valor pago é inferior ao valor do pedido",
    );
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
  });

  it("accepts a higher paid amount caused by card fee pass-through", async () => {
    fixture.setRecord(pendingRecord());

    const result = await fixture.service.reconcilePayment(lookup);

    expect(result.status).toBe("paid");
    expect(fixture.repository.markPaid).toHaveBeenCalledOnce();
    expect(fixture.repository.markPaid).toHaveBeenCalledWith(fixedOrderNsu, {
      transactionNsu: "transaction-1",
      invoiceSlug: "invoice-1",
      paymentMethod: "credit_card",
      installments: 2,
      paidAmountCents: 10420,
      receiptUrl: "https://receipts.infinitepay.com.br/receipt/abc",
      paidAt: fixedPaidAt,
    });
  });

  it("does not update twice when the same transaction is repeated", async () => {
    fixture.setRecord(pendingRecord());

    await fixture.service.reconcilePayment(lookup);
    await fixture.service.reconcilePayment(lookup);

    expect(fixture.repository.markPaid).toHaveBeenCalledOnce();
    expect(fixture.infinitePay.checkPayment).toHaveBeenCalledOnce();
  });

  it("rejects a different transaction for an already-paid order", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: "transaction-original",
      paymentMethod: "pix",
      installments: 1,
    });

    await expect(fixture.service.reconcilePayment(lookup)).rejects.toThrow(
      "Transação divergente para pedido já confirmado",
    );
    expect(fixture.infinitePay.checkPayment).not.toHaveBeenCalled();
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
  });

  it("keeps an unverified payment pending", async () => {
    fixture.setRecord(pendingRecord());
    vi.mocked(fixture.infinitePay.checkPayment).mockResolvedValueOnce({ paid: false });

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toEqual({ status: "pending" });
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
  });

  it("drops an unsafe receipt URL from the public paid status", async () => {
    fixture.setRecord(pendingRecord());

    await expect(
      fixture.service.reconcilePayment({
        ...lookup,
        receiptUrl: "https://infinitepay.com.br.evil.example/receipt/abc",
      }),
    ).resolves.toEqual({
      status: "paid",
      paymentMethod: "credit_card",
      installments: 2,
    });
  });

  it("returns only payment data from the public status", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: "transaction-1",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
      name: "must not leak",
      shirtSize: "M",
    } as RegistrationPaymentRecord);

    await expect(fixture.service.getPublicStatus(fixedOrderNsu)).resolves.toEqual({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
    });
  });
});
