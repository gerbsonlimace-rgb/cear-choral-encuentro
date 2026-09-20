import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "./infinitepay.server";
import type { DisplayedQuote } from "@/features/choirs/choir-pricing.domain";
import {
  MAX_REGISTRATION_PHOTO_BYTES,
  type PaymentLookup,
  type RegistrationInput,
  type RegistrationLookupResult,
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
      supabaseAdminMock: { from: vi.fn(), rpc: vi.fn(), storage: { from: storageFromMock } },
    };
  },
);

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  DEFAULT_INFINITEPAY_HANDLE,
  DEFAULT_INFINITEPAY_SITE_URL,
  createRegistrationPaymentService,
  createSupabaseRegistrationPhotoStorage,
  createSupabaseRegistrationRepository,
  type RegistrationIdentityRecord,
  type RegistrationPaymentRecord,
  type RegistrationRepository,
  type SupersededCheckoutPaymentRecord,
} from "./registration-payment.server";
import {
  buildRegistrationCheckoutContract,
  type RegistrationCheckoutContract,
} from "./registration-checkout-contract";
import {
  createParticipantProvisioningService,
  createSupabaseParticipantProvisioningRepository,
  type ParticipantAuthAdmin,
} from "@/features/participant/participant-provisioning.server";

describe("InfinitePay configuration", () => {
  it("defaults new checkouts to the Lucas account", () => {
    expect(DEFAULT_INFINITEPAY_HANDLE).toBe("lucas-soares-xwv");
  });

  it("returns customers to the live confirmation page by default", () => {
    expect(DEFAULT_INFINITEPAY_SITE_URL).toBe("https://encontrocorosce.lovable.app");
  });
});

const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";
const previousOrderNsu = "33333333-3333-4333-8333-333333333333";
const fixedPaidAt = "2026-09-07T15:30:00.000Z";
const cpf = "52998224725";
const checkoutUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const choirId = "22222222-2222-4222-8222-222222222222";
const registrationPhoto = { contentType: "image/jpeg" as const, dataBase64: "cGhvdG8=" };
const registrationPhotoPath = `${fixedOrderNsu}/participant.jpg`;
const existingCheckoutUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/existing";

const trustedSelection = {
  choir: {
    id: choirId,
    name: "Coro Diocesano de Quixadá",
    diocese: "Diocese de Quixadá" as const,
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
};

const standardQuote: DisplayedQuote = {
  pricingType: "standard",
  standardPriceCents: 30000,
  registrationPriceCents: 30000,
};

const baseInput: RegistrationInput = {
  name: "Maria da Silva",
  badgeName: "Maria Silva",
  cpf,
  email: "maria@example.com",
  phone: "85999999999",
  birthDate: "1990-05-20",
  diocese: "Diocese de Quixadá",
  choirId,
  otherChoirName: null,
  musicalProfile: "coralista",
  voicePart: "soprano",
  photo: registrationPhoto,
  raffleChoice: "participate",
  displayedQuote: trustedSelection.quote,
};
const {
  photo: _photo,
  raffleChoice: _raffleChoice,
  displayedQuote: _displayedQuote,
  ...baseRegistrationInput
} = baseInput;

function pendingIdentity(
  options: {
    input?: RegistrationInput;
    appliedQuote?: DisplayedQuote;
    trustedQuote?: DisplayedQuote;
    orderNsu?: string;
    checkoutUrl?: string;
    photoPath?: string;
    checkoutContract?: RegistrationCheckoutContract | null;
  } = {},
): RegistrationIdentityRecord {
  const input = options.input ?? baseInput;
  const appliedQuote = options.appliedQuote ?? trustedSelection.quote;
  const trustedQuote = options.trustedQuote ?? trustedSelection.quote;
  return {
    id: "registration-1",
    paymentStatus: "pending",
    birthDate: input.birthDate,
    orderNsu: options.orderNsu ?? previousOrderNsu,
    checkoutUrl: options.checkoutUrl ?? existingCheckoutUrl,
    photoPath: options.photoPath ?? `${previousOrderNsu}/participant.jpg`,
    checkoutContract:
      options.checkoutContract === undefined
        ? buildRegistrationCheckoutContract(input, appliedQuote, trustedQuote)
        : options.checkoutContract,
  };
}

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
    pricingType: "promotional",
    standardPriceCents: 30000,
    registrationPriceCents: 10000,
  };
}

function supersededRecord(
  overrides: Partial<SupersededCheckoutPaymentRecord> = {},
): SupersededCheckoutPaymentRecord {
  return {
    id: "superseded-1",
    registrationId: "registration-1",
    orderNsu: previousOrderNsu,
    amountCents: 10000,
    status: "superseded",
    transactionNsu: null,
    paymentMethod: null,
    installments: null,
    paidAmountCents: null,
    receiptUrl: null,
    paidAt: null,
    ...overrides,
  };
}

function paidReviewRecord(
  overrides: Partial<SupersededCheckoutPaymentRecord> = {},
): SupersededCheckoutPaymentRecord {
  return supersededRecord({
    status: "paid_requires_review",
    transactionNsu: "transaction-1",
    paymentMethod: "pix",
    installments: 1,
    paidAmountCents: 10000,
    paidAt: fixedPaidAt,
    ...overrides,
  });
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
  is: (column: string, value: unknown) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<DatabaseResult>;
  then: (
    onFulfilled: (value: DatabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const successfulDatabaseResult: DatabaseResult = { data: null, error: null };
const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url,name,email,choir_name,paid_amount_cents,paid_at,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents";
const supersededPaymentColumns =
  "id,registration_id,order_nsu,amount_cents,status,infinitepay_transaction_nsu,payment_method,installments,paid_amount_cents,receipt_url,paid_at";
const identityColumns =
  "id,payment_status,birth_date,order_nsu,checkout_url,photo_path,name,email,phone,amount_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents";
const resumeIdentityColumns = "birth_date,payment_status,checkout_url";

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
    pricing_type: "promotional",
    standard_price_cents: 30000,
    registration_price_cents: 10000,
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
    is: vi.fn((column: string, value: unknown) => {
      trace.push(["is", column, value]);
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
  let archivedRecord: SupersededCheckoutPaymentRecord | null = null;
  let identityRecord: RegistrationIdentityRecord | null = null;
  let lookupResult = null as RegistrationLookupResult | null;
  let resumeIdentityRecord: {
    birthDate: string;
    paymentStatus: "pending" | "paid" | "legacy";
    checkoutUrl: string | null;
  } | null = null;
  let checkoutLinkRecord: {
    id: string;
    orderNsu: string;
    amountCents: number;
    paymentStatus: "pending" | "paid" | "legacy";
    checkoutUrl: string | null;
    name: string;
    email: string;
    phone: string;
  } | null = null;

  const repository: RegistrationRepository = {
    findByCpf: vi.fn(async () => identityRecord),
    findRegistrationByIdentity: vi.fn(async () => lookupResult),
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
      return true;
    }),
    updatePendingDetails: vi.fn(async () => true),
    replacePendingCheckout: vi.fn(async () => true),
    findPayment: vi.fn(async () => record),
    findSupersededPayment: vi.fn(async () => archivedRecord),
    markSupersededPaid: vi.fn(async (_orderNsu, confirmation) => {
      calls.push("markSupersededPaid");
      archivedRecord = paidReviewRecord({
        transactionNsu: confirmation.transactionNsu,
        paymentMethod: confirmation.paymentMethod,
        installments: confirmation.installments,
        paidAmountCents: confirmation.paidAmountCents,
        receiptUrl: confirmation.receiptUrl ?? null,
        paidAt: confirmation.paidAt,
      });
      return archivedRecord;
    }),
    markPaid: vi.fn(async (orderNsu, confirmation) => {
      calls.push("markPaid");
      record = {
        ...pendingRecord(),
        orderNsu,
        paymentStatus: "paid",
        transactionNsu: confirmation.transactionNsu,
        paymentMethod: confirmation.paymentMethod,
        installments: confirmation.installments,
        receiptUrl: confirmation.receiptUrl ?? null,
      };
      return record;
    }),
    findForResume: vi.fn(async () => resumeIdentityRecord),
    findForCheckoutLink: vi.fn(async () => checkoutLinkRecord),
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

  const provisionParticipant = vi.fn(
    async (): Promise<{ status: "active" | "pending" | "conflict" }> => ({ status: "active" }),
  );
  const getParticipantCredentials = vi.fn(
    async () =>
      null as {
        portalUrl: "/acessar";
        initialPassword: string;
      } | null,
  );
  const findAuthUserByEmail = vi.fn(async () => null as { id: string } | null);
  const resolveChoirSelection = vi.fn(async () => trustedSelection);
  const resolveStandardRegistrationQuote = vi.fn(async () => ({
    pricingType: "standard" as const,
    standardPriceCents: 30000,
    registrationPriceCents: 30000,
  }));

  const service = createRegistrationPaymentService({
    repository,
    infinitePay,
    photoStorage,
    randomUUID: () => fixedOrderNsu,
    now: () => fixedPaidAt,
    resolveChoirSelection,
    resolveStandardRegistrationQuote,
    provisionParticipant,
    getParticipantCredentials,
    findAuthUserByEmail,
  });

  return {
    calls,
    infinitePay,
    photoStorage,
    provisionParticipant,
    getParticipantCredentials,
    findAuthUserByEmail,
    resolveChoirSelection,
    resolveStandardRegistrationQuote,
    repository,
    service,
    setIdentityRecord(next: typeof identityRecord) {
      identityRecord = next;
    },
    setLookupResult(next: RegistrationLookupResult | null) {
      lookupResult = next;
    },
    setResumeIdentityRecord(next: typeof resumeIdentityRecord) {
      resumeIdentityRecord = next;
    },
    setCheckoutLinkRecord(next: typeof checkoutLinkRecord) {
      checkoutLinkRecord = next;
    },
    setRecord(next: RegistrationPaymentRecord | null) {
      record = next;
    },
    setSupersededRecord(next: SupersededCheckoutPaymentRecord | null) {
      archivedRecord = next;
    },
  };
}

function supersededPaymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "superseded-1",
    registration_id: "registration-1",
    order_nsu: previousOrderNsu,
    amount_cents: 10000,
    status: "superseded",
    infinitepay_transaction_nsu: null,
    payment_method: null,
    installments: null,
    paid_amount_cents: null,
    receipt_url: null,
    paid_at: null,
    ...overrides,
  };
}

describe("registration payment service", () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
    fixture = createFixture();
  });

  it("looks up saved participant data by CPF and birth date", async () => {
    fixture.setLookupResult({
      status: "found",
      name: "Maria da Silva",
      email: "maria@example.com",
      phone: "88999999999",
      choirId,
      musicalProfile: "coralista",
      voicePart: "soprano",
      hasPhoto: true,
      paymentStatus: "pending",
    });

    await expect(
      fixture.service.lookupRegistration({ cpf, birthDate: "1990-01-02" }),
    ).resolves.toEqual(expect.objectContaining({ status: "found", name: "Maria da Silva" }));
    expect(fixture.repository.findRegistrationByIdentity).toHaveBeenCalledWith(cpf, "1990-01-02");
  });

  it("stores a pending registration before requesting checkout", async () => {
    const result = await fixture.service.startCheckout(baseInput);

    expect(fixture.calls).toEqual([
      "uploadPhoto",
      "createPending",
      "createCheckout",
      "saveCheckoutUrl",
    ]);
    expect(fixture.repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        ...baseRegistrationInput,
        orderNsu: fixedOrderNsu,
        amountCents: 10000,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      }),
    );
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

  it("replaces a R$ 100 checkout after phone and full-price selection change", async () => {
    fixture.setIdentityRecord(
      pendingIdentity({ input: { ...baseInput, phone: "(85) 99999-1111" } }),
    );
    const fullPriceInput: RegistrationInput = {
      ...baseInput,
      phone: "(85) 98888-2222",
      raffleChoice: "full_price",
      displayedQuote: standardQuote,
    };

    await fixture.service.startCheckout(fullPriceInput);

    expect(fixture.repository.replacePendingCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOrderNsu: previousOrderNsu,
        expectedCheckoutUrl: existingCheckoutUrl,
        orderNsu: fixedOrderNsu,
        amountCents: 30000,
      }),
    );
    expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNsu: fixedOrderNsu,
        items: [expect.objectContaining({ price: 30000 })],
        customer: expect.objectContaining({ phoneNumber: "(85) 98888-2222" }),
      }),
    );
  });

  it("persists a nonfinancial edit and reuses the matching checkout", async () => {
    fixture.setIdentityRecord(pendingIdentity());

    const result = await fixture.service.startCheckout({
      ...baseInput,
      badgeName: "Novo crachá",
    });

    expect(fixture.repository.updatePendingDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        badgeName: "Novo crachá",
        expectedOrderNsu: previousOrderNsu,
        expectedCheckoutUrl: existingCheckoutUrl,
      }),
    );
    expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(result).toEqual({ checkoutUrl: existingCheckoutUrl, orderNsu: previousOrderNsu });
  });

  it("reuses the checkout for equivalent Brazilian phone formats", async () => {
    fixture.setIdentityRecord(
      pendingIdentity({ input: { ...baseInput, phone: "(85) 99999-9999" } }),
    );

    const result = await fixture.service.startCheckout({
      ...baseInput,
      phone: "+55 85 99999-9999",
    });

    expect(fixture.repository.updatePendingDetails).toHaveBeenCalledOnce();
    expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(result).toEqual({ checkoutUrl: existingCheckoutUrl, orderNsu: previousOrderNsu });
  });

  it("returns the concurrent matching checkout when a detail update loses its condition", async () => {
    const concurrentIdentity = pendingIdentity({
      orderNsu: fixedOrderNsu,
      checkoutUrl,
      photoPath: registrationPhotoPath,
    });
    vi.mocked(fixture.repository.findByCpf!)
      .mockResolvedValueOnce(pendingIdentity())
      .mockResolvedValueOnce(concurrentIdentity);
    vi.mocked(fixture.repository.updatePendingDetails).mockResolvedValueOnce(false);

    await expect(fixture.service.startCheckout(baseInput)).resolves.toEqual({
      checkoutUrl,
      orderNsu: fixedOrderNsu,
    });

    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(fixture.photoStorage.remove).toHaveBeenCalledWith(registrationPhotoPath);
  });

  it("never returns or archives an unsafe existing checkout URL", async () => {
    fixture.setIdentityRecord(pendingIdentity({ checkoutUrl: "https://evil.example/checkout" }));

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow(
      "Não foi possível preparar o pagamento desta inscrição.",
    );

    expect(fixture.repository.updatePendingDetails).not.toHaveBeenCalled();
    expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
  });

  it("does not return an unsafe URL after waiting on a concurrent claim", async () => {
    const claim = `https://pending.invalid/creating/${fixedOrderNsu}/${Date.parse(fixedPaidAt)}`;
    const claimedIdentity = pendingIdentity({
      orderNsu: fixedOrderNsu,
      checkoutUrl: claim,
      photoPath: registrationPhotoPath,
    });
    vi.mocked(fixture.repository.findByCpf!)
      .mockResolvedValueOnce(claimedIdentity)
      .mockResolvedValueOnce({ ...claimedIdentity, checkoutUrl: "https://evil.example/checkout" });

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow(
      "O checkout já está sendo preparado. Tente novamente em instantes.",
    );

    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("uses the concurrent replacement claim and final URL instead of creating twice", async () => {
    const fullPriceInput: RegistrationInput = {
      ...baseInput,
      raffleChoice: "full_price",
      displayedQuote: standardQuote,
    };
    const concurrentClaim = `https://pending.invalid/creating/${fixedOrderNsu}/1`;
    const concurrentIdentity = pendingIdentity({
      input: fullPriceInput,
      appliedQuote: standardQuote,
      orderNsu: fixedOrderNsu,
      checkoutUrl: concurrentClaim,
      photoPath: registrationPhotoPath,
    });
    vi.mocked(fixture.repository.findByCpf!)
      .mockResolvedValueOnce(pendingIdentity())
      .mockResolvedValueOnce(concurrentIdentity)
      .mockResolvedValueOnce({ ...concurrentIdentity, checkoutUrl });
    vi.mocked(fixture.repository.replacePendingCheckout).mockResolvedValueOnce(false);

    await expect(fixture.service.startCheckout(fullPriceInput)).resolves.toEqual({
      checkoutUrl,
      orderNsu: fixedOrderNsu,
    });

    expect(fixture.repository.replacePendingCheckout).toHaveBeenCalledOnce();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(fixture.photoStorage.remove).toHaveBeenCalledWith(registrationPhotoPath);
  });

  it("checks a changed e-mail conflict before archiving the existing checkout", async () => {
    fixture.setIdentityRecord(pendingIdentity());
    fixture.findAuthUserByEmail.mockResolvedValueOnce({ id: "existing-auth-user" });

    await expect(
      fixture.service.startCheckout({ ...baseInput, email: "outra@example.com" }),
    ).rejects.toThrow("Já existe um acesso com este e-mail.");

    expect(fixture.findAuthUserByEmail).toHaveBeenCalledWith("outra@example.com");
    expect(fixture.repository.updatePendingDetails).not.toHaveBeenCalled();
    expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
  });

  it("uses the trusted standard price and persists an informed other choir", async () => {
    const otherInput: RegistrationInput = {
      ...baseInput,
      choirId: null,
      otherChoirName: "Coral Santa Cecília",
      raffleChoice: "full_price",
      displayedQuote: {
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
      },
    };

    await fixture.service.startCheckout(otherInput);

    expect(fixture.resolveChoirSelection).not.toHaveBeenCalled();
    expect(fixture.resolveStandardRegistrationQuote).toHaveBeenCalledOnce();
    expect(fixture.repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        choirId: null,
        otherChoirName: "Coral Santa Cecília",
        choirName: "Coral Santa Cecília",
        amountCents: 30000,
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
      }),
    );
  });

  it("blocks checkout when the email already belongs to an Auth user", async () => {
    fixture.findAuthUserByEmail.mockResolvedValue({ id: "existing-auth-user" });

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow(
      "Já existe um acesso com este e-mail.",
    );
    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
    expect(fixture.repository.createPending).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("resumes the persisted checkout when CPF and birth date match", async () => {
    fixture.setResumeIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual(
      { status: "pending", checkoutUrl: existingCheckoutUrl },
    );
  });

  it("uses the same identity error for an unknown CPF or mismatched birth date", async () => {
    fixture.setResumeIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });

    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1991-01-01" })).rejects.toThrow(
      "Não foi possível localizar uma inscrição com os dados informados.",
    );

    fixture.setResumeIdentityRecord(null);
    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).rejects.toThrow(
      "Não foi possível localizar uma inscrição com os dados informados.",
    );
  });

  it("confirms paid registrations and directs pending records without a checkout to support", async () => {
    fixture.setResumeIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "paid",
      checkoutUrl: existingCheckoutUrl,
    });
    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual(
      {
        status: "paid",
      },
    );

    fixture.setResumeIdentityRecord({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: null,
    });
    await expect(fixture.service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).rejects.toThrow(
      "Procure a organização para continuar o pagamento.",
    );
  });

  it("reuses a safe checkout URL when an administrator requests a payment link", async () => {
    fixture.setCheckoutLinkRecord({
      id: "registration-1",
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      paymentStatus: "pending",
      checkoutUrl: checkoutUrl,
      name: "Maria",
      email: "maria@example.com",
      phone: "85999999999",
    });

    await expect(fixture.service.createCheckoutLink("registration-1")).resolves.toEqual({
      checkoutUrl,
      reused: true,
    });
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("generates and persists a checkout URL when the pending registration has none", async () => {
    fixture.setCheckoutLinkRecord({
      id: "registration-1",
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      paymentStatus: "pending",
      checkoutUrl: null,
      name: "Maria",
      email: "maria@example.com",
      phone: "85999999999",
    });

    await expect(fixture.service.createCheckoutLink("registration-1")).resolves.toEqual({
      checkoutUrl,
      reused: false,
    });
    expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith({
      orderNsu: fixedOrderNsu,
      items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
      customer: { name: "Maria", email: "maria@example.com", phoneNumber: "85999999999" },
    });
    expect(fixture.repository.saveCheckoutUrl).toHaveBeenCalledWith(fixedOrderNsu, checkoutUrl);
  });

  it("does not return a checkout created after a concurrent manual confirmation", async () => {
    fixture.setCheckoutLinkRecord({
      id: "registration-1",
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      paymentStatus: "pending",
      checkoutUrl: null,
      name: "Maria",
      email: "maria@example.com",
      phone: "85999999999",
    });
    vi.mocked(fixture.repository.saveCheckoutUrl).mockImplementationOnce(async () => {
      fixture.setCheckoutLinkRecord({
        id: "registration-1",
        orderNsu: fixedOrderNsu,
        amountCents: 10000,
        paymentStatus: "paid",
        checkoutUrl: null,
        name: "Maria",
        email: "maria@example.com",
        phone: "85999999999",
      });
      return false;
    });

    await expect(fixture.service.createCheckoutLink("registration-1")).rejects.toThrow(
      "confirmada antes de salvar",
    );
  });

  it("uses the trusted full-price quote when the participant opts out of raffles", async () => {
    const fullPriceInput: RegistrationInput = {
      ...baseInput,
      raffleChoice: "full_price",
      displayedQuote: {
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
      },
    };

    await fixture.service.startCheckout(fullPriceInput);

    expect(fixture.repository.createPending).toHaveBeenCalledWith({
      ...baseRegistrationInput,
      orderNsu: fixedOrderNsu,
      amountCents: 30000,
      choirName: "Coro Diocesano de Quixadá",
      photoPath: registrationPhotoPath,
      pricingType: "standard",
      standardPriceCents: 30000,
      registrationPriceCents: 30000,
      checkoutClaim: expect.any(String),
    });
    expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ quantity: 1, price: 30000, description: "Inscrição — II Encontro de Coros" }],
      }),
    );
  });

  it("uses the trusted promotional quote only when the participant joins raffles", async () => {
    await fixture.service.startCheckout(baseInput);

    expect(fixture.repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 10000,
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      }),
    );
    expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
      }),
    );
  });

  it("persists the configured initial and remaining prices when creating a promotion", async () => {
    const configuredQuote = {
      ...trustedSelection,
      quote: {
        ...trustedSelection.quote,
        standardPriceCents: 30_000,
        remainingPriceCents: 25_000,
      },
    };
    vi.mocked(fixture.resolveChoirSelection).mockResolvedValueOnce(configuredQuote);

    await fixture.service.startCheckout({
      ...baseInput,
      displayedQuote: configuredQuote.quote,
    });

    expect(fixture.repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 10_000,
        standardPriceCents: 30_000,
        registrationPriceCents: 10_000,
        remainingPriceCents: 25_000,
      }),
    );
  });

  it("rejects an incoherent displayed quote before uploading or persisting", async () => {
    await expect(
      fixture.service.startCheckout({
        ...baseInput,
        raffleChoice: "full_price",
        displayedQuote: trustedSelection.quote,
      }),
    ).rejects.toThrow("configuração de preços mudou");

    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
    expect(fixture.repository.createPending).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("uploads the participant photo and stores only its private path", async () => {
    await fixture.service.startCheckout(baseInput);

    expect(fixture.photoStorage.upload).toHaveBeenCalledWith(fixedOrderNsu, registrationPhoto);
    const pendingInput = vi.mocked(fixture.repository.createPending).mock.calls[0]?.[0];
    expect(pendingInput).toMatchObject({
      photoPath: registrationPhotoPath,
      voicePart: "soprano",
    });
    expect(pendingInput).not.toHaveProperty("photo");
  });

  it("keeps the private photo when checkout creation fails", async () => {
    vi.mocked(fixture.infinitePay.createCheckout).mockRejectedValueOnce(
      new Error("checkout unavailable"),
    );

    await expect(fixture.service.startCheckout(baseInput)).rejects.toThrow("checkout unavailable");

    expect(fixture.photoStorage.remove).not.toHaveBeenCalled();
  });

  it("replaces the previous photo only after a stale pending claim is reserved", async () => {
    const previousPhotoPath = `${previousOrderNsu}/participant.jpg`;
    fixture.setIdentityRecord({
      id: "registration-1",
      paymentStatus: "pending",
      birthDate: baseInput.birthDate,
      orderNsu: previousOrderNsu,
      checkoutUrl: `https://pending.invalid/creating/${previousOrderNsu}/0`,
      photoPath: previousPhotoPath,
      checkoutContract: null,
    });

    await fixture.service.startCheckout(baseInput);

    expect(fixture.repository.replacePendingCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationId: "registration-1",
        expectedOrderNsu: previousOrderNsu,
        orderNsu: fixedOrderNsu,
        photoPath: registrationPhotoPath,
      }),
    );
    expect(fixture.photoStorage.remove).toHaveBeenCalledWith(previousPhotoPath);
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
    expect(fixture.photoStorage.remove).not.toHaveBeenCalled();
  });

  it("rejects a stale displayed price before changing an existing checkout", async () => {
    fixture.setIdentityRecord(pendingIdentity());

    await expect(
      fixture.service.startCheckout({
        ...baseInput,
        displayedQuote: { ...baseInput.displayedQuote, registrationPriceCents: 9000 },
      }),
    ).rejects.toThrow("configuração de preços mudou");

    expect(fixture.repository.createPending).not.toHaveBeenCalled();
    expect(fixture.repository.updatePendingDetails).not.toHaveBeenCalled();
    expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
    expect(fixture.photoStorage.upload).not.toHaveBeenCalled();
    expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("records a verified superseded payment without marking the registration paid", async () => {
    fixture.setRecord(null);
    fixture.setSupersededRecord(supersededRecord({ amountCents: 10000 }));

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toEqual({
      status: "paid_requires_review",
    });

    expect(fixture.infinitePay.checkPayment).toHaveBeenCalledWith(lookup);
    expect(fixture.repository.markSupersededPaid).toHaveBeenCalledOnce();
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
    expect(fixture.provisionParticipant).not.toHaveBeenCalled();
  });

  it("rejects a superseded payment whose checked amount differs from the archive", async () => {
    fixture.setRecord(null);
    fixture.setSupersededRecord(supersededRecord({ amountCents: 10000 }));
    vi.mocked(fixture.infinitePay.checkPayment).mockResolvedValueOnce({
      paid: true,
      amountCents: 9999,
      paidAmountCents: 10000,
      installments: 1,
      paymentMethod: "pix",
    });

    await expect(fixture.service.reconcilePayment(lookup)).rejects.toThrow(
      "Valor do pagamento divergente.",
    );

    expect(fixture.repository.markSupersededPaid).not.toHaveBeenCalled();
  });

  it("returns an idempotent review state for the same late transaction", async () => {
    fixture.setRecord(null);
    fixture.setSupersededRecord(paidReviewRecord({ transactionNsu: lookup.transactionNsu }));

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toEqual({
      status: "paid_requires_review",
    });

    expect(fixture.infinitePay.checkPayment).not.toHaveBeenCalled();
    expect(fixture.repository.markSupersededPaid).not.toHaveBeenCalled();
  });

  it("rejects a conflicting transaction after an idempotent late-payment replay", async () => {
    fixture.setRecord(null);
    fixture.setSupersededRecord(paidReviewRecord({ transactionNsu: "original" }));

    await expect(
      fixture.service.reconcilePayment({ ...lookup, transactionNsu: "different" }),
    ).rejects.toThrow("Transação divergente");

    expect(fixture.infinitePay.checkPayment).not.toHaveBeenCalled();
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

    expect(result).toMatchObject({
      status: "paid",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });
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

  it("waits for the durable paid write to resolve before provisioning participant access", async () => {
    fixture.setRecord(pendingRecord());
    const confirmed: RegistrationPaymentRecord = {
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: lookup.transactionNsu,
      paymentMethod: "credit_card",
      installments: 2,
    };
    let resolveMarkPaid!: (record: RegistrationPaymentRecord) => void;
    const markPaidPending = new Promise<RegistrationPaymentRecord>((resolve) => {
      resolveMarkPaid = resolve;
    });
    vi.mocked(fixture.repository.markPaid).mockImplementationOnce(() => markPaidPending);

    const reconciliation = fixture.service.reconcilePayment(lookup);

    await vi.waitFor(() => expect(fixture.repository.markPaid).toHaveBeenCalledOnce());
    expect(fixture.provisionParticipant).not.toHaveBeenCalled();

    resolveMarkPaid(confirmed);

    await expect(reconciliation).resolves.toMatchObject({
      status: "paid",
      participantAccessStatus: "active",
    });
    expect(fixture.provisionParticipant).toHaveBeenCalledWith("registration-1");
  });

  it("retries participant provisioning for an already-paid idempotent replay", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: lookup.transactionNsu,
      paymentMethod: "pix",
      installments: 1,
    });
    fixture.provisionParticipant.mockResolvedValueOnce({ status: "conflict" });

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toMatchObject({
      status: "paid",
      participantAccessStatus: "conflict",
    });
    expect(fixture.repository.markPaid).not.toHaveBeenCalled();
    expect(fixture.infinitePay.checkPayment).not.toHaveBeenCalled();
    expect(fixture.provisionParticipant).toHaveBeenCalledWith("registration-1");
  });

  it("keeps a newly confirmed payment paid when participant provisioning is delayed", async () => {
    fixture.setRecord(pendingRecord());
    fixture.provisionParticipant.mockRejectedValueOnce(new Error("auth unavailable"));

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toMatchObject({
      status: "paid",
      participantAccessStatus: "pending",
    });
    expect(fixture.repository.markPaid).toHaveBeenCalledOnce();
  });

  it("does not provision participant access when marking the payment fails", async () => {
    fixture.setRecord(pendingRecord());
    vi.mocked(fixture.repository.markPaid).mockRejectedValueOnce(new Error("database unavailable"));

    await expect(fixture.service.reconcilePayment(lookup)).rejects.toThrow("database unavailable");
    expect(fixture.provisionParticipant).not.toHaveBeenCalled();
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

  it("releases the group invitation only through verified payment reconciliation", async () => {
    fixture.setRecord(pendingRecord());
    expect(await fixture.service.getPublicStatus(fixedOrderNsu)).not.toHaveProperty(
      "whatsappGroupUrl",
    );

    const confirmed = await fixture.service.reconcilePayment(lookup);
    expect(confirmed).toMatchObject({
      status: "paid",
      whatsappGroupUrl: "https://chat.whatsapp.com/DMasqDLthuP1HmhJzHxqxw",
    });
    expect(await fixture.service.getPublicStatus(fixedOrderNsu)).not.toHaveProperty(
      "whatsappGroupUrl",
    );
    expect(await fixture.service.reconcilePayment(lookup)).toMatchObject({
      whatsappGroupUrl: "https://chat.whatsapp.com/DMasqDLthuP1HmhJzHxqxw",
    });
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
      participantAccessStatus: "active",
    });
  });

  it("returns trusted pricing snapshots rather than provider-paid amount in the public status", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: "transaction-1",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
      participantName: "Maria da Silva",
      participantEmail: "maria@example.com",
      choirName: "Coro Diocesano de Quixadá",
      paidAmountCents: 10420,
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    } as RegistrationPaymentRecord);

    const status = await fixture.service.getPublicStatus(fixedOrderNsu);

    expect(status).toMatchObject({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      participantAccessStatus: "pending",
      receiptUrl: "https://receipts.infinitepay.io/receipt/abc",
      participantName: "Maria da Silva",
      participantEmail: "maria@example.com",
      choirName: "Coro Diocesano de Quixadá",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });
    expect(JSON.stringify(status)).not.toContain("transaction-1");
    expect(JSON.stringify(status)).not.toContain('"M"');
  });

  it("returns participant portal credentials only after confirmed provisioning", async () => {
    fixture.setRecord(pendingRecord());
    fixture.getParticipantCredentials.mockResolvedValue({
      portalUrl: "/acessar",
      initialPassword: "5299822472515011990",
    });

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toMatchObject({
      status: "paid",
      participantAccessStatus: "active",
      participantPortalUrl: "/acessar",
      participantInitialPassword: "5299822472515011990",
    });
    expect(fixture.getParticipantCredentials).toHaveBeenCalledWith("registration-1");
  });

  it("includes participant credentials when a paid confirmation URL is replayed", async () => {
    fixture.setRecord({
      ...pendingRecord(),
      paymentStatus: "paid",
      transactionNsu: "transaction-1",
      paymentMethod: "pix",
      installments: 1,
    });
    fixture.getParticipantCredentials.mockResolvedValue({
      portalUrl: "/acessar",
      initialPassword: "5299822472515011990",
    });

    await expect(fixture.service.reconcilePayment(lookup)).resolves.toMatchObject({
      status: "paid",
      participantAccessStatus: "active",
      participantPortalUrl: "/acessar",
      participantInitialPassword: "5299822472515011990",
    });
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
    supabaseAdminMock.rpc.mockReset();
  });

  it("inserts the checkout contact data and clears unused historical fields", async () => {
    const database = createSupabaseHarness();
    const repository = createSupabaseRegistrationRepository();
    const { photo: _photo, ...registrationData } = baseInput;

    await repository.createPending({
      ...baseRegistrationInput,
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
          name: "Maria da Silva",
          badge_name: "Maria Silva",
          cpf: "52998224725",
          photo_path: registrationPhotoPath,
          musical_profile: "coralista",
          voice_part: "soprano",
          phone: "85999999999",
          birth_date: "1990-05-20",
          choir_id: choirId,
          choir_name: "Coro Diocesano de Quixadá",
          other_choir_name: null,
          diocese: "Diocese de Quixadá",
          email: "maria@example.com",
          city: null,
          institution: null,
          role: null,
          observations: null,
          include_shirt: false,
          shirt_size: null,
          shirt_price_cents: null,
          pricing_type: "promotional",
          standard_price_cents: 30000,
          registration_price_cents: 10000,
          amount_cents: 10000,
          payment_status: "pending",
          order_nsu: fixedOrderNsu,
        },
      ],
    ]);
  });

  it("reads the persisted musical profile and voice part for registration resume", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        {
          data: {
            name: "Maria da Silva",
            badge_name: "Maria Silva",
            email: "maria@example.com",
            phone: "85999999999",
            birth_date: "1990-05-20",
            diocese: "Diocese de QuixadÃ¡",
            choir_id: choirId,
            other_choir_name: null,
            musical_profile: "coralista",
            voice_part: "soprano",
            photo_path: registrationPhotoPath,
            payment_status: "pending",
          },
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findRegistrationByIdentity(cpf, "1990-05-20")).resolves.toMatchObject({
      status: "found",
      musicalProfile: "coralista",
      voicePart: "soprano",
    });
  });

  it("carries the persisted public-registration CPF through paid provisioning without returning it", async () => {
    const registration = {
      id: "registration-1",
      order_nsu: fixedOrderNsu,
      amount_cents: 10000,
      payment_status: "pending",
      infinitepay_transaction_nsu: null,
      payment_method: null,
      installments: null,
      receipt_url: null,
      email: "maria@example.com",
      birth_date: "1990-05-20",
      cpf: null as string | null,
    };
    const account = {
      id: "22222222-2222-4222-8222-222222222222",
      registration_id: registration.id,
      user_id: null as string | null,
      access_status: "pending" as "pending" | "active",
      provisioning_claim_id: null as string | null,
    };
    const events: unknown[] = [];
    supabaseAdminMock.rpc = vi.fn(async (_name: string, input: { p_claim_id: string }) => {
      account.provisioning_claim_id = input.p_claim_id;
      return { error: null };
    });
    supabaseAdminMock.from.mockImplementation((table: string) => {
      const query = {
        insert: vi.fn(async (values: Record<string, unknown>) => {
          if (table === "registrations") Object.assign(registration, values);
          else events.push(values);
          return { data: null, error: null };
        }),
        update: vi.fn((values: Record<string, unknown>) => {
          if (table === "registrations") Object.assign(registration, values);
          if (table === "participant_accounts") {
            Object.assign(account, values);
            account.access_status = values.access_status as "active";
            account.user_id = values.user_id as string;
            account.provisioning_claim_id = null;
          }
          return query;
        }),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data:
            table === "registrations"
              ? registration
              : table === "participant_accounts"
                ? account
                : null,
          error: null,
        })),
      };
      return query;
    });
    const repository = createSupabaseRegistrationRepository();
    await repository.createPending({
      ...baseRegistrationInput,
      orderNsu: fixedOrderNsu,
      amountCents: 10000,
      choirName: "Coro Diocesano de Quixadá",
      photoPath: registrationPhotoPath,
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });
    await repository.markPaid(fixedOrderNsu, {
      transactionNsu: "transaction-1",
      invoiceSlug: "invoice-1",
      paymentMethod: "pix",
      installments: 1,
      paidAmountCents: 10000,
      paidAt: fixedPaidAt,
    });
    const auth: ParticipantAuthAdmin = {
      findUserByEmail: async () => null,
      createUser: async () => ({ id: "33333333-3333-4333-8333-333333333333" }),
      deleteUser: async () => {},
      updatePassword: async () => {},
      createMagicLink: async () => "https://example.supabase.co/auth/v1/verify?token=one-time",
    };

    await expect(
      createParticipantProvisioningService({
        repository: createSupabaseParticipantProvisioningRepository(),
        auth,
        createClaimId: () => "44444444-4444-4444-8444-444444444444",
      }).provision(registration.id),
    ).resolves.toEqual({ status: "active" });
    expect(registration.cpf).toBe(cpf);
    expect(account.access_status).toBe("active");
    expect(events).not.toContainEqual(expect.objectContaining({ cpf }));
  });

  it("surfaces a pending-registration insert failure", async () => {
    createSupabaseHarness({
      insertResults: [{ data: null, error: { message: "insert failed" } }],
    });
    const repository = createSupabaseRegistrationRepository();
    const { photo: _photo, ...registrationData } = baseInput;

    await expect(
      repository.createPending({
        ...baseRegistrationInput,
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
            pricing_type: "promotional",
            standard_price_cents: 30000,
            registration_price_cents: 10000,
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
      participantEmail: null,
      participantName: null,
      choirName: null,
      paidAmountCents: null,
      paidAt: null,
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
    });

    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", paymentColumns],
      ["eq", "order_nsu", fixedOrderNsu],
      ["maybeSingle"],
    ]);
  });

  it("looks up a superseded checkout by order without joining participant data", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [{ data: supersededPaymentRow(), error: null }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findSupersededPayment(previousOrderNsu)).resolves.toEqual(
      supersededRecord(),
    );
    expect(database.trace).toEqual([
      ["from", "registration_superseded_checkouts"],
      ["select", supersededPaymentColumns],
      ["eq", "order_nsu", previousOrderNsu],
      ["maybeSingle"],
    ]);
  });

  it("marks only a superseded checkout as paid for review", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [
        {
          data: supersededPaymentRow({
            status: "paid_requires_review",
            infinitepay_transaction_nsu: "transaction-1",
            payment_method: "pix",
            installments: 1,
            paid_amount_cents: 10000,
            receipt_url: "https://receipt.infinitepay.io/late",
            paid_at: fixedPaidAt,
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markSupersededPaid(previousOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        receiptUrl: "https://receipt.infinitepay.io/late",
        paidAt: fixedPaidAt,
      }),
    ).resolves.toMatchObject({
      status: "paid_requires_review",
      transactionNsu: "transaction-1",
    });

    expect(database.trace).toContainEqual(["from", "registration_superseded_checkouts"]);
    expect(database.trace).toContainEqual(["eq", "order_nsu", previousOrderNsu]);
    expect(database.trace).toContainEqual(["eq", "status", "superseded"]);
    expect(database.trace).toContainEqual(["select", supersededPaymentColumns]);
  });

  it("accepts the same superseded transaction after a conditional-update race", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        { data: null, error: null },
        {
          data: supersededPaymentRow({
            status: "paid_requires_review",
            infinitepay_transaction_nsu: "transaction-1",
            payment_method: "pix",
            installments: 1,
            paid_amount_cents: 10000,
            paid_at: fixedPaidAt,
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markSupersededPaid(previousOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        paidAt: fixedPaidAt,
      }),
    ).resolves.toMatchObject({ transactionNsu: "transaction-1" });
  });

  it("rejects a different superseded transaction after a conditional-update race", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        { data: null, error: null },
        {
          data: supersededPaymentRow({
            status: "paid_requires_review",
            infinitepay_transaction_nsu: "transaction-other",
            payment_method: "pix",
            installments: 1,
            paid_amount_cents: 10000,
            paid_at: fixedPaidAt,
          }),
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.markSupersededPaid(previousOrderNsu, {
        transactionNsu: "transaction-1",
        invoiceSlug: "invoice-1",
        paymentMethod: "pix",
        installments: 1,
        paidAmountCents: 10000,
        paidAt: fixedPaidAt,
      }),
    ).rejects.toThrow("Transação divergente");
  });

  it("maps the complete active checkout contract for an existing CPF", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [
        {
          data: {
            id: "registration-1",
            payment_status: "pending",
            birth_date: "1990-05-20",
            order_nsu: fixedOrderNsu,
            checkout_url: null,
            photo_path: registrationPhotoPath,
            name: "Maria",
            email: "maria@example.com",
            phone: "+55 85 99999-9999",
            amount_cents: 10000,
            pricing_type: "promotional",
            standard_price_cents: 30000,
            registration_price_cents: 10000,
            remaining_price_cents: 25000,
          },
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findByCpf(cpf)).resolves.toEqual({
      id: "registration-1",
      paymentStatus: "pending",
      birthDate: "1990-05-20",
      orderNsu: fixedOrderNsu,
      checkoutUrl: null,
      photoPath: registrationPhotoPath,
      checkoutContract: {
        customer: {
          name: "Maria",
          email: "maria@example.com",
          phoneNumber: "+5585999999999",
        },
        items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
        amountCents: 10000,
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
        remainingPriceCents: 25000,
      },
    });
    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", identityColumns],
      ["eq", "cpf", cpf],
      ["maybeSingle"],
    ]);
  });

  it("returns a null checkout contract for incomplete historical snapshots", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        {
          data: {
            id: "registration-1",
            payment_status: "pending",
            birth_date: "1990-05-20",
            order_nsu: previousOrderNsu,
            checkout_url: existingCheckoutUrl,
            photo_path: registrationPhotoPath,
            name: "Maria",
            email: "maria@example.com",
            phone: "85999999999",
            amount_cents: 10000,
            pricing_type: null,
            standard_price_cents: null,
            registration_price_cents: null,
            remaining_price_cents: null,
          },
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findByCpf(cpf)).resolves.toMatchObject({ checkoutContract: null });
  });

  it("updates pending participant details without changing checkout identity", async () => {
    const database = createSupabaseHarness({
      maybeSingleResults: [{ data: { id: "registration-1" }, error: null }],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.updatePendingDetails({
        ...baseRegistrationInput,
        registrationId: "registration-1",
        expectedOrderNsu: previousOrderNsu,
        expectedCheckoutUrl: existingCheckoutUrl,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
      }),
    ).resolves.toBe(true);

    expect(database.trace).toContainEqual(["eq", "order_nsu", previousOrderNsu]);
    expect(database.trace).toContainEqual(["eq", "checkout_url", existingCheckoutUrl]);
    const update = database.trace.find(([operation]) => operation === "update")?.[1];
    expect(update).not.toHaveProperty("order_nsu");
    expect(update).not.toHaveProperty("checkout_url");
    expect(update).not.toHaveProperty("amount_cents");
    expect(update).not.toHaveProperty("pricing_type");
  });

  it("replaces a pending checkout through the typed atomic RPC", async () => {
    supabaseAdminMock.rpc.mockResolvedValueOnce({ data: true, error: null });
    const repository = createSupabaseRegistrationRepository();
    const checkoutClaim = `https://pending.invalid/creating/${fixedOrderNsu}`;

    await expect(
      repository.replacePendingCheckout({
        ...baseRegistrationInput,
        registrationId: "registration-1",
        expectedOrderNsu: previousOrderNsu,
        expectedCheckoutUrl: existingCheckoutUrl,
        orderNsu: fixedOrderNsu,
        checkoutClaim,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
        amountCents: 30000,
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
        remainingPriceCents: null,
      }),
    ).resolves.toBe(true);

    expect(supabaseAdminMock.rpc).toHaveBeenCalledWith(
      "replace_pending_registration_checkout",
      expect.objectContaining({
        p_registration_id: "registration-1",
        p_expected_order_nsu: previousOrderNsu,
        p_expected_checkout_url: existingCheckoutUrl,
        p_new_order_nsu: fixedOrderNsu,
        p_checkout_claim: checkoutClaim,
        p_amount_cents: 30000,
        p_remaining_price_cents: null,
      }),
    );
  });

  it("translates an atomic replacement database error without logging participant data", async () => {
    supabaseAdminMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "database details" },
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(
      repository.replacePendingCheckout({
        ...baseRegistrationInput,
        registrationId: "registration-1",
        expectedOrderNsu: previousOrderNsu,
        expectedCheckoutUrl: existingCheckoutUrl,
        orderNsu: fixedOrderNsu,
        checkoutClaim: `https://pending.invalid/creating/${fixedOrderNsu}`,
        choirName: "Coro Diocesano de Quixadá",
        photoPath: registrationPhotoPath,
        amountCents: 30000,
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
        remainingPriceCents: null,
      }),
    ).rejects.toThrow("Não foi possível atualizar a inscrição.");
  });

  it("preserves legacy payment status instead of guessing it is unpaid", async () => {
    createSupabaseHarness({
      maybeSingleResults: [
        {
          data: {
            id: "registration-legacy",
            payment_status: "legacy",
            birth_date: "1990-05-20",
            order_nsu: null,
            checkout_url: null,
          },
          error: null,
        },
      ],
    });
    const repository = createSupabaseRegistrationRepository();

    await expect(repository.findByCpf(cpf)).resolves.toMatchObject({
      id: "registration-legacy",
      paymentStatus: "legacy",
    });
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

  it("looks up only the identity fields needed to resume a checkout", async () => {
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

    await expect(repository.findForResume(cpf)).resolves.toEqual({
      birthDate: "1990-05-12",
      paymentStatus: "pending",
      checkoutUrl: existingCheckoutUrl,
    });
    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["select", resumeIdentityColumns],
      ["eq", "cpf", cpf],
      ["maybeSingle"],
    ]);
  });

  it("saves the checkout URL only while the order is pending and has no link", async () => {
    const database = createSupabaseHarness();
    const repository = createSupabaseRegistrationRepository();

    await repository.saveCheckoutUrl(fixedOrderNsu, checkoutUrl);

    expect(database.trace).toEqual([
      ["from", "registrations"],
      ["update", { checkout_url: checkoutUrl }],
      ["eq", "order_nsu", fixedOrderNsu],
      ["eq", "payment_status", "pending"],
      ["is", "checkout_url", null],
      ["select", "id"],
      ["maybeSingle"],
    ]);
  });

  it("surfaces a checkout URL update failure", async () => {
    createSupabaseHarness({
      maybeSingleResults: [{ data: null, error: { message: "update failed" } }],
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
