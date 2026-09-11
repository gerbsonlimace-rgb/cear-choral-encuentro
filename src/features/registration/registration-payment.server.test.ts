import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "./infinitepay.server";
import {
  MAX_REGISTRATION_PHOTO_BYTES,
  type PaymentLookup,
  type RegistrationInput,
} from "./registration.domain";

const { storageFromMock, storageRemoveMock, storageUploadMock, supabaseAdminMock } = vi.hoisted(
  () => {
    const storageUploadMock = vi.fn();
    const storageRemoveMock = vi.fn();
    const storageFromMock = vi.fn(() => ({
      upload: storageUploadMock,
      remove: storageRemoveMock,
    }));
    return {
      storageFromMock,
      storageRemoveMock,
      storageUploadMock,
      supabaseAdminMock: { from: vi.fn(), storage: { from: storageFromMock } },
    };
  },
);

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  DEFAULT_INFINITEPAY_HANDLE,
  createRegistrationPaymentService,
  createSupabaseRegistrationPhotoStorage,
  createSupabaseRegistrationRepository,
  type RegistrationPaymentRecord,
  type RegistrationRepository,
} from "./registration-payment.server";

describe("InfinitePay configuration", () => {
  it("defaults new checkouts to the Lucas account", () => {
    expect(DEFAULT_INFINITEPAY_HANDLE).toBe("lucas-soares-xwv");
  });
});

const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const fixedPaidAt = "2026-09-07T15:30:00.000Z";
const checkoutUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const existingCheckoutUrl = "https://checkout.infinitepay.com.br/existing";
const choirId = "22222222-2222-4222-8222-222222222222";
const cpf = "52998224725";
const registrationPhoto = { contentType: "image/jpeg" as const, dataBase64: "cGhvdG8=" };
const registrationPhotoPath = `${fixedOrderNsu}/participant.jpg`;

const trustedSelection = {
  choir: {
    id: choirId,
    name: "Coro Diocesano de Quixadá",
    usesPromotionalPrice: true,
    isActive: true,
    createdAt: "2026-09-09T10:00:00.000Z",
    updatedAt: "2026-09-09T10:00:00.000Z",
  },
  quote: {
    pricingType: "promotional" as const,
    standardPriceCents: 30000,
    registrationPriceCents: 10000,
  },
  shirtPriceCents: 5000,
};

const baseInput: RegistrationInput = {
  name: "Maria da Silva",
  cpf: "52998224725",
  email: "maria@example.com",
  phone: "85999999999",
  birthDate: "1990-05-20",
  choirId,
  voicePart: "soprano",
  photo: registrationPhoto,
  displayedQuote: trustedSelection.quote,
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
  error: { code?: string; message: string } | null;
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
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url,name,choir_name,paid_amount_cents,paid_at";
const identityColumns = "birth_date,payment_status,checkout_url";

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
  let identityRecord: {
    birthDate: string;
    paymentStatus: "pending" | "paid" | "legacy";
    checkoutUrl: string | null;
  } | null = null;

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
    findByCpf: vi.fn(async () => {
      calls.push("findByCpf");
      return identityRecord;
    }),
    clearPendingPhoto: vi.fn(async () => {
      calls.push("clearPendingPhoto");
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

  const photoStorage = {
    upload: vi.fn(async () => {
      calls.push("uploadPhoto");
      return registrationPhotoPath;
    }),
    remove: vi.fn(async () => {
      calls.push("removePhoto");
    }),
  };

  const service = createRegistrationPaymentService({
    repository,
    infinitePay,
    photoStorage,
    randomUUID: () => fixedOrderNsu,
    now: () => fixedPaidAt,
    resolveChoirSelection: vi.fn(async () => trustedSelection),
  });

  return {
    calls,
    infinitePay,
    photoStorage,
    repository,
    service,
    setIdentityRecord(next: typeof identityRecord) {
      identityRecord = next;
    },
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

    expect(fixture.calls).toEqual([
      "findByCpf",
      "uploadPhoto",
      "createPending",
      "createCheckout",
      "saveCheckoutUrl",
    ]);
    const { photo: _photo, ...registrationData } = baseInput;
    expect(fixture.repository.createPending).toHaveBeenCalledWith({
      ...registrationData,
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      choirName: "Coro Diocesano de Quixadá",
      photoPath: registrationPhotoPath,
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });
    expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith({
      orderNsu: fixedOrderNsu,
      items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
      customer: {
        name: "Maria da Silva",
        email: "maria@example.com",
        phoneNumber: "85999999999",
      },
    });
    expect(result).toEqual({ checkoutUrl, orderNsu: fixedOrderNsu });
    expect(fixture.photoStorage.upload).toHaveBeenCalledWith(fixedOrderNsu, registrationPhoto);
  });

  it("rejects an existing CPF before uploading a photo or creating another registration", async () => {
    fixture.setIdentityRecord({
      birthDate: "1990-05-20",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow(
      "Já existe uma inscrição para este CPF. Use Retomar pagamento.",
    );

    expect(fixture.calls).toEqual(["findByCpf"]);
    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
    expect(fixture.repository.createPending).not.toHaveBeenCalled();
  });

  it("resumes the persisted checkout when CPF and birth date match", async () => {
    fixture.setIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual(
      {
        status: "pending",
        checkoutUrl: existingCheckoutUrl,
      },
    );
  });

  it("uses the same public error for an unknown CPF and a mismatched birth date", async () => {
    fixture.setIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1991-01-01" })).rejects.toThrow(
      "Não foi possível localizar uma inscrição com os dados informados.",
    );

    fixture.setIdentityRecord(null);
    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).rejects.toThrow(
      "Não foi possível localizar uma inscrição com os dados informados.",
    );
  });

  it("reports a paid registration without exposing its checkout", async () => {
    fixture.setIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "paid",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual(
      { status: "paid" },
    );
  });

  it("directs a matching pending registration without a checkout to the organization", async () => {
    fixture.setIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: null,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).rejects.toThrow(
      "Procure a organização para continuar o pagamento.",
    );
  });

  it("leaves the registration pending and removes its photo when checkout creation fails", async () => {
    vi.mocked(fixture.infinitePay.createCheckout).mockRejectedValueOnce(
      new Error("InfinitePay indisponível"),
    );

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow();

    await expect(fixture.repository.findPayment(fixedOrderNsu)).resolves.toMatchObject({
      paymentStatus: "pending",
    });
    expect(fixture.repository.saveCheckoutUrl).not.toHaveBeenCalled();
    expect(fixture.repository.clearPendingPhoto).toHaveBeenCalledWith(fixedOrderNsu);
    expect(fixture.photoStorage.remove).toHaveBeenCalledWith(registrationPhotoPath);
  });

  it("rejects a stale displayed price before saving or opening checkout", async () => {
    await expect(
      fixture.service.startCheckout({
        ...baseInput,
        displayedQuote: { ...baseInput.displayedQuote, registrationPriceCents: 9000 },
      }),
    ).rejects.toThrow("configuração de preços mudou");

    expect(fixture.repository.createPending).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
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
    ).resolves.toMatchObject({
      status: "paid",
      paymentMethod: "credit_card",
      installments: 2,
    });
  });

  it("returns only receipt data from the public status", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: "transaction-1",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
      participantName: "Maria da Silva",
      choirName: "Coro Diocesano de Quixadá",
      shirtSize: "M",
    } as RegistrationPaymentRecord);

    const status = await fixture.service.getPublicStatus(fixedOrderNsu);

    expect(status).toMatchObject({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
      participantName: "Maria da Silva",
      choirName: "Coro Diocesano de Quixadá",
    });
    expect(JSON.stringify(status)).not.toContain("transaction-1");
    expect(JSON.stringify(status)).not.toContain('"M"');
  });
});

describe("Supabase registration photo storage", () => {
  beforeEach(() => {
    storageFromMock.mockClear();
    storageUploadMock.mockReset();
    storageRemoveMock.mockReset();
  });

  it("rejects decoded photos larger than the bucket limit before uploading", async () => {
    const storage = createSupabaseRegistrationPhotoStorage();
    const oversizedPhoto = {
      contentType: "image/jpeg" as const,
      dataBase64: Buffer.alloc(MAX_REGISTRATION_PHOTO_BYTES + 1).toString("base64"),
    };

    await expect(storage.upload(fixedOrderNsu, oversizedPhoto)).rejects.toThrow(
      "A foto deve ter até 5 MB",
    );
    expect(storageFromMock).not.toHaveBeenCalled();
  });

  it("uploads a new object to the private registration bucket", async () => {
    storageUploadMock.mockResolvedValueOnce({
      data: { path: registrationPhotoPath },
      error: null,
    });
    const storage = createSupabaseRegistrationPhotoStorage();

    await expect(storage.upload(fixedOrderNsu, registrationPhoto)).resolves.toBe(
      registrationPhotoPath,
    );
    expect(storageFromMock).toHaveBeenCalledWith("registration-photos");
    expect(storageUploadMock).toHaveBeenCalledWith(registrationPhotoPath, expect.any(Buffer), {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });
  });
});

describe("Supabase registration repository", () => {
  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
  });

  it("inserts the checkout contact data and clears unused historical fields", async () => {
    const database = createSupabaseHarness();
    const repository = createSupabaseRegistrationRepository();
    const { photo: _photo, ...registrationData } = baseInput;

    await repository.createPending({
      ...registrationData,
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      choirName: "Coro Diocesano de Quixadá",
      photoPath: registrationPhotoPath,
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });

    expect(database.trace).toEqual([
      ["from", "registrations"],
      [
        "insert",
        {
          id: fixedOrderNsu,
          name: "Maria da Silva",
          cpf: "52998224725",
          photo_path: registrationPhotoPath,
          voice_part: "soprano",
          phone: "85999999999",
          birth_date: "1990-05-20",
          choir_id: choirId,
          choir_name: "Coro Diocesano de Quixadá",
          diocese: "Coro Diocesano de Quixadá",
          email: "maria@example.com",
          city: null,
          institution: null,
          role: null,
          observations: null,
          include_shirt: false,
          shirt_size: null,
          pricing_type: "promotional",
          standard_price_cents: 30000,
          registration_price_cents: 10000,
          shirt_price_cents: null,
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
    const { photo: _photo, ...registrationData } = baseInput;

    await expect(
      repository.createPending({
        ...registrationData,
        orderNsu: fixedOrderNsu,
        amountCents: 10000,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      }),
    ).rejects.toThrow("Não foi possível salvar a inscrição");
  });

  it("maps the CPF unique-index race to the stable resume message", async () => {
    createSupabaseHarness({
      insertResults: [
        {
          data: null,
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "registrations_cpf_uidx"',
          },
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();
    const { photo: _photo, ...registrationData } = baseInput;

    await expect(
      repository.createPending({
        ...registrationData,
        orderNsu: fixedOrderNsu,
        amountCents: 10000,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      }),
    ).rejects.toThrow("Já existe uma inscrição para este CPF. Use Retomar pagamento.");
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
      participantName: null,
      choirName: null,
      paidAmountCents: null,
      paidAt: null,
    });

    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", paymentColumns],
      ["eq", "order_nsu", fixedOrderNsu],
      ["maybeSingle"],
    ]);
  });

  it("looks up a registration identity by CPF without selecting participant data", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [
        {
          data: {
            birth_date: "1990-05-12",
            payment_status: "pending",
            checkout_url: existingCheckoutUrl,
          },
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findByCpf(cpf)).resolves.toEqual({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });
    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", identityColumns],
      ["eq", "cpf", cpf],
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
