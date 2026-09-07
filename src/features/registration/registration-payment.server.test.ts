import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "./infinitepay.server";
import type { PaymentLookup, RegistrationInput } from "./registration.domain";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  createRegistrationPaymentService,
  createSupabaseRegistrationRepository,
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

type DatabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

type SupabaseQueryBuilder = {
  insert: (values: unknown) => Promise<DatabaseResult>;
  update: (values: unknown) => SupabaseQueryBuilder;
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<DatabaseResult>;
  then: (
    onFulfilled: (value: DatabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const successfulDatabaseResult: DatabaseResult = { data: null, error: null };
const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url";

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "registration-1",
    order_nsu: fixedOrderNsu,
    amount_cents: 10000,
    payment_status: "pending",
    infinitepay_transaction_nsu: null,
    payment_method: null,
    installments: null,
    receipt_url: null,
    ...overrides,
  };
}

function createSupabaseHarness(
  options: {
    insertResults?: DatabaseResult[];
    executeResults?: DatabaseResult[];
    maybeSingleResults?: DatabaseResult[];
  } = {},
) {
  const trace: unknown[][] = [];
  const insertResults = [...(options.insertResults ?? [])];
  const executeResults = [...(options.executeResults ?? [])];
  const maybeSingleResults = [...(options.maybeSingleResults ?? [])];

  const builder: SupabaseQueryBuilder = {
    insert: vi.fn(async (values: unknown) => {
      trace.push(["insert", values]);
      return insertResults.shift() ?? successfulDatabaseResult;
    }),
    update: vi.fn((values: unknown) => {
      trace.push(["update", values]);
      return builder;
    }),
    select: vi.fn((columns: string) => {
      trace.push(["select", columns]);
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      trace.push(["eq", column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => {
      trace.push(["maybeSingle"]);
      return maybeSingleResults.shift() ?? successfulDatabaseResult;
    }),
    then: (
      onFulfilled: (value: DatabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      trace.push(["execute"]);
      return Promise.resolve(executeResults.shift() ?? successfulDatabaseResult).then(
        onFulfilled,
        onRejected,
      );
    },
  };

  supabaseAdminMock.from.mockImplementation((table: string) => {
    trace.push(["from", table]);
    return builder;
  });

  return { trace };
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
    supabaseAdminMock.from.mockReset();
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

describe("Supabase registration repository", () => {
  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
  });

  it("inserts every registration field and clears an unselected shirt size", async () => {
    const database = createSupabaseHarness();
    const repository = createSupabaseRegistrationRepository();

    await repository.createPending({
      ...baseInput,
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
    });

    expect(database.trace).toEqual([
      ["from", "registrations"],
      [
        "insert",
        {
          name: "Maria da Silva",
          email: "maria@example.com",
          phone: "85999999999",
          city: "Quixadá",
          institution: "Coro Paroquial",
          role: "singer",
          observations: null,
          include_shirt: false,
          shirt_size: null,
          amount_cents: 10000,
          payment_status: "pending",
          order_nsu: fixedOrderNsu,
        },
      ],
    ]);
  });

  it("surfaces a pending-registration insert failure", async () => {
    createSupabaseHarness({
      insertResults: [{ data: null, error: { message: "insert failed" } }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.createPending({ ...baseInput, orderNsu: fixedOrderNsu, amountCents: 10000 }),
    ).rejects.toThrow("Não foi possível salvar a inscrição");
  });

  it("looks up and maps only payment columns", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [
        {
          data: paymentRow({
            payment_status: "paid",
            infinitepay_transaction_nsu: "transaction-1",
            payment_method: "pix",
            installments: 1,
            receipt_url: "https://receipts.infinitepay.io/receipt/abc",
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findPayment(fixedOrderNsu)).resolves.toEqual({
      id: "registration-1",
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      paymentStatus: "paid",
      transactionNsu: "transaction-1",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
    });
    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", paymentColumns],
      ["eq", "order_nsu", fixedOrderNsu],
      ["maybeSingle"],
    ]);
  });

  it("surfaces a payment lookup failure", async () => {
    createSupabaseHarness({
      maybeSingleResults: [{ data: null, error: { message: "lookup failed" } }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findPayment(fixedOrderNsu)).rejects.toThrow(
      "Não foi possível consultar a inscrição",
    );
  });

  it("saves the checkout URL only while the order is pending", async () => {
    const database = createSupabaseHarness();
    const repository = createSupabaseRegistrationRepository();

    await repository.saveCheckoutUrl(fixedOrderNsu, checkoutUrl);

    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["update", { checkout_url: checkoutUrl }],
      ["eq", "order_nsu", fixedOrderNsu],
      ["eq", "payment_status", "pending"],
      ["execute"],
    ]);
  });

  it("surfaces a checkout URL update failure", async () => {
    createSupabaseHarness({
      executeResults: [{ data: null, error: { message: "update failed" } }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.saveCheckoutUrl(fixedOrderNsu, checkoutUrl)).rejects.toThrow(
      "Não foi possível salvar o checkout",
    );
  });

  it("accepts a conditional-update race won by the same transaction", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [
        { data: null, error: null },
        {
          data: paymentRow({
            payment_status: "paid",
            infinitepay_transaction_nsu: "transaction-1",
            payment_method: "credit_card",
            installments: 2,
            receipt_url: "https://receipts.infinitepay.com.br/receipt/abc",
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markPaid(fixedOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "credit_card",
        installments: 2,
        paidAmountCents: 10420,
        receiptUrl: "https://receipts.infinitepay.com.br/receipt/abc",
        paidAt: fixedPaidAt,
      }),
    ).resolves.toMatchObject({ paymentStatus: "paid", transactionNsu: "transaction-1" });
    expect(database.trace).toEqual([
      ["from", "registrations"],
      [
        "update",
        {
          payment_status: "paid",
          infinitepay_invoice_slug: "invoice-1",
          infinitepay_transaction_nsu: "transaction-1",
          payment_method: "credit_card",
          installments: 2,
          paid_amount_cents: 10420,
          receipt_url: "https://receipts.infinitepay.com.br/receipt/abc",
          paid_at: fixedPaidAt,
        },
      ],
      ["eq", "order_nsu", fixedOrderNsu],
      ["eq", "payment_status", "pending"],
      ["select", paymentColumns],
      ["maybeSingle"],
      ["from", "registrations"],
      ["select", paymentColumns],
      ["eq", "order_nsu", fixedOrderNsu],
      ["maybeSingle"],
    ]);
  });

  it("rejects a conditional-update race won by a different transaction", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        { data: null, error: null },
        {
          data: paymentRow({
            payment_status: "paid",
            infinitepay_transaction_nsu: "transaction-other",
            payment_method: "pix",
            installments: 1,
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markPaid(fixedOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        paidAt: fixedPaidAt,
      }),
    ).rejects.toThrow("Transação divergente ou pedido indisponível");
  });

  it("does not reload after a conditional paid-update database error", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [{ data: null, error: { message: "update failed" } }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markPaid(fixedOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        paidAt: fixedPaidAt,
      }),
    ).rejects.toThrow("Não foi possível confirmar a inscrição");
    expect(database.trace.filter(([operation]) => operation === "from")).toHaveLength(1);
  });

  it("surfaces a database error while reloading a lost update", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        { data: null, error: null },
        { data: null, error: { message: "reload failed" } },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markPaid(fixedOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        paidAt: fixedPaidAt,
      }),
    ).rejects.toThrow("Não foi possível consultar a inscrição");
  });
});
