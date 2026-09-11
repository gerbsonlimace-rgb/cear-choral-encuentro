import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "@/features/registration/infinitepay.server";
import { InfinitePayProviderError } from "@/features/registration/infinitepay.server";
import type { PortalAccess } from "./regent.domain";
import {
  createRegentPaymentService,
  createSupabaseRegentPaymentRepository,
  type RegentPaymentRepository,
} from "./regent-payment.server";

const { from, select, eq, inFilter, insert, update, single, maybeSingle } = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  inFilter: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from },
}));

const registrationId = "11111111-1111-4111-8111-111111111111";
const choirId = "22222222-2222-4222-8222-222222222222";
const orderNsu = "33333333-3333-4333-8333-333333333333";
const checkoutUrl = "https://checkout.infinitepay.com.br/complement";

const regent: PortalAccess = {
  role: "regent",
  userId: "regent-user",
  membershipId: "regent-membership",
  choirId,
  name: "Ana Regente",
  email: "ana@example.com",
  passwordChangeRequired: false,
};

const registration = {
  id: registrationId,
  choirId,
  paymentStatus: "paid" as const,
  pricingType: "promotional" as const,
  standardPriceCents: 20_000,
  registrationPriceCents: 10_000,
};

function setup() {
  const repository: RegentPaymentRepository = {
    findRegistration: vi.fn().mockResolvedValue(registration),
    listAccountingPayments: vi.fn().mockResolvedValue([]),
    reserve: vi.fn().mockResolvedValue(undefined),
    findByOrderNsu: vi.fn().mockResolvedValue(null),
    findOpenPayment: vi.fn().mockResolvedValue(null),
    markPending: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const infinitePay: InfinitePayClient = {
    createCheckout: vi.fn().mockResolvedValue({ url: checkoutUrl }),
    checkPayment: vi.fn(),
  };
  const service = createRegentPaymentService({
    repository,
    infinitePay,
    randomUUID: () => orderNsu,
  });
  return { repository, infinitePay, service };
}

describe("regent complement checkout service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserves the current balance snapshot before creating a PII-free provider checkout", async () => {
    const { repository, infinitePay, service } = setup();

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).resolves.toEqual({ checkoutUrl, orderNsu });

    expect(repository.findRegistration).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(repository.listAccountingPayments).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(repository.reserve).toHaveBeenCalledExactlyOnceWith({
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "creating",
      orderNsu,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });
    expect(infinitePay.createCheckout).toHaveBeenCalledExactlyOnceWith({
      orderNsu,
      items: [
        {
          quantity: 1,
          price: 5_000,
          description: "Complemento de inscrição — II Encontro de Coros",
        },
      ],
      redirectPath: "/regente/pagamento",
    });
    expect(repository.markPending).toHaveBeenCalledExactlyOnceWith(orderNsu, checkoutUrl);
    expect(vi.mocked(repository.findRegistration).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.listAccountingPayments).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(repository.listAccountingPayments).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.reserve).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(repository.reserve).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(infinitePay.createCheckout).mock.invocationCallOrder[0],
    );
  });

  it("uses an administrator actor snapshot without participant data", async () => {
    const { repository, service } = setup();
    const admin: PortalAccess = {
      role: "admin",
      userId: "admin-user",
      email: "admin@example.com",
    };

    await service.startCheckout({ registrationId, amountCents: 1 }, admin);

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        choirId,
        initiatedBy: "admin-user",
        initiatedByName: "admin@example.com",
        initiatedAs: "admin",
      }),
    );
  });

  it("rejects a registration from another choir before reading its ledger", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findRegistration).mockResolvedValue({
      ...registration,
      choirId: "44444444-4444-4444-8444-444444444444",
    });

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow("A inscrição não pertence ao coro autorizado.");

    expect(repository.listAccountingPayments).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ["unpaid", { paymentStatus: "pending" as const }, "Aguardando pagamento do participante."],
    [
      "normal",
      { pricingType: "standard" as const, registrationPriceCents: 20_000 },
      "Esta inscrição não possui complemento.",
    ],
  ])("rejects a %s registration", async (_case, change, message) => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findRegistration).mockResolvedValue({ ...registration, ...change });

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow(message);

    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("rejects an amount above the freshly calculated balance", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid-1", orderNsu: "paid-order", amountCents: 7_000, status: "paid", checkoutUrl },
    ]);

    await expect(
      service.startCheckout({ registrationId, amountCents: 3_001 }, regent),
    ).rejects.toThrow("O valor informado excede o saldo complementar disponível.");

    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("rejects an existing creating or pending payment", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      {
        id: "open-1",
        orderNsu: "open-order",
        amountCents: 5_000,
        status: "pending",
        checkoutUrl,
      },
    ]);

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow("Já existe um pagamento complementar em aberto.");

    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("rejects a regent who still must change the temporary password", async () => {
    const { repository, service } = setup();

    await expect(
      service.startCheckout(
        { registrationId, amountCents: 5_000 },
        { ...regent, passwordChangeRequired: true },
      ),
    ).rejects.toThrow("Altere sua senha antes de acessar a área do regente.");

    expect(repository.findRegistration).not.toHaveBeenCalled();
  });

  it("marks an exact reservation failed after a confirmed provider rejection", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockRejectedValue(
      new InfinitePayProviderError("confirmed_rejection"),
    );

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow("Não foi possível comunicar com a InfinitePay.");

    expect(repository.markFailed).toHaveBeenCalledExactlyOnceWith(orderNsu);
    expect(repository.markPending).not.toHaveBeenCalled();
  });

  it("releases the reservation when InfinitePay external checkout is disabled", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockRejectedValue(
      new InfinitePayProviderError(
        "confirmed_rejection",
        "O pagamento está temporariamente indisponível porque o checkout externo da InfinitePay ainda não foi ativado.",
      ),
    );

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow(
      "O pagamento está temporariamente indisponível porque o checkout externo da InfinitePay ainda não foi ativado.",
    );

    expect(repository.markFailed).toHaveBeenCalledExactlyOnceWith(orderNsu);
    expect(repository.markPending).not.toHaveBeenCalled();
  });

  it("reports an unreconciled failed transition as pending without retrying the checkout", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockRejectedValue(
      new InfinitePayProviderError("confirmed_rejection"),
    );
    vi.mocked(repository.markFailed).mockRejectedValue(
      new TypeError("failed transition could not be proven"),
    );

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow(
      "Não foi possível confirmar a liberação da reserva. Atualize a página e verifique o pagamento em aberto antes de tentar novamente.",
    );

    expect(repository.reserve).toHaveBeenCalledOnce();
    expect(infinitePay.createCheckout).toHaveBeenCalledOnce();
    expect(repository.markFailed).toHaveBeenCalledExactlyOnceWith(orderNsu);
    expect(repository.markPending).not.toHaveBeenCalled();
  });

  it("keeps the exact reservation open when the provider outcome is ambiguous", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockRejectedValue(new TypeError("response lost"));

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow(
      "A confirmação do checkout está pendente. Atualize a página antes de tentar novamente.",
    );

    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.markPending).not.toHaveBeenCalled();
  });

  it("continues with an exact reservation when its insert response was lost", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.reserve).mockRejectedValue(new TypeError("response lost"));
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "reserved-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "creating",
      orderNsu,
      checkoutUrl: null,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).resolves.toEqual({ checkoutUrl, orderNsu });

    expect(infinitePay.createCheckout).toHaveBeenCalledOnce();
  });

  it("does not call the provider when an ambiguous reservation cannot be proven", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.reserve).mockRejectedValue(new TypeError("response lost"));
    vi.mocked(repository.findByOrderNsu).mockResolvedValue(null);

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow("Não foi possível confirmar a reserva do pagamento.");

    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("does not persist a checkout URL that is not a trusted InfinitePay HTTPS address", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockResolvedValue({
      url: "https://infinitepay.example.evil/checkout",
    });

    await expect(
      service.startCheckout({ registrationId, amountCents: 5_000 }, regent),
    ).rejects.toThrow(
      "A confirmação do checkout está pendente. Atualize a página antes de tentar novamente.",
    );

    expect(repository.markPending).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });
});

describe("Supabase complement payment repository", () => {
  const databasePayment = {
    id: "payment-1",
    registration_id: registrationId,
    choir_id: choirId,
    amount_cents: 5_000,
    status: "creating",
    order_nsu: orderNsu,
    checkout_url: null,
    initiated_by: regent.userId,
    initiated_by_name: regent.name,
    initiated_as: "regent",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select, eq, in: inFilter, insert, update, single, maybeSingle };
    from.mockReturnValue(query);
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    insert.mockReturnValue(query);
    update.mockReturnValue(query);
  });

  it.each([
    [
      "registration_complement_payments_open_uidx",
      "Já existe um pagamento complementar em aberto.",
    ],
    [
      "Complement amount exceeds outstanding balance",
      "O valor informado excede o saldo complementar disponível.",
    ],
  ])("maps a database race involving %s to a stable message", async (detail, message) => {
    single.mockResolvedValue({
      data: null,
      error: {
        code: detail.includes("uidx") ? "23505" : "23514",
        message: detail,
      },
    });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(
      repository.reserve({
        registrationId,
        choirId,
        amountCents: 5_000,
        status: "creating",
        orderNsu,
        initiatedBy: regent.userId,
        initiatedByName: regent.name,
        initiatedAs: "regent",
      }),
    ).rejects.toThrow(message);
  });

  it("persists only the server-owned reservation and proves the exact returned row", async () => {
    single.mockResolvedValue({ data: databasePayment, error: null });
    const repository = createSupabaseRegentPaymentRepository();
    const input = {
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "creating" as const,
      orderNsu,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent" as const,
    };

    await expect(repository.reserve(input)).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledExactlyOnceWith({
      registration_id: registrationId,
      choir_id: choirId,
      amount_cents: 5_000,
      status: "creating",
      order_nsu: orderNsu,
      initiated_by: regent.userId,
      initiated_by_name: regent.name,
      initiated_as: "regent",
    });
  });

  it("re-reads the registration snapshots and only paid or open ledger rows", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: registrationId,
        choir_id: choirId,
        payment_status: "paid",
        pricing_type: "promotional",
        standard_price_cents: 20_000,
        registration_price_cents: 10_000,
      },
      error: null,
    });
    inFilter.mockResolvedValueOnce({
      data: [databasePayment, { ...databasePayment, id: "paid-1", status: "paid" }],
      error: null,
    });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(repository.findRegistration(registrationId)).resolves.toEqual(registration);
    await expect(repository.listAccountingPayments(registrationId)).resolves.toEqual([
      {
        id: "payment-1",
        orderNsu,
        amountCents: 5_000,
        status: "creating",
        checkoutUrl: null,
      },
      {
        id: "paid-1",
        orderNsu,
        amountCents: 5_000,
        status: "paid",
        checkoutUrl: null,
      },
    ]);
    expect(inFilter).toHaveBeenCalledExactlyOnceWith("status", ["creating", "pending", "paid"]);
  });

  it("reconciles a lost pending-update response from the exact persisted URL", async () => {
    maybeSingle.mockRejectedValueOnce(new TypeError("response lost")).mockResolvedValueOnce({
      data: { ...databasePayment, status: "pending", checkout_url: checkoutUrl },
      error: null,
    });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(repository.markPending(orderNsu, checkoutUrl)).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledExactlyOnceWith({
      status: "pending",
      checkout_url: checkoutUrl,
    });
  });

  it("reconciles a lost failed-update response without touching another order", async () => {
    maybeSingle.mockRejectedValueOnce(new TypeError("response lost")).mockResolvedValueOnce({
      data: { ...databasePayment, status: "failed" },
      error: null,
    });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(repository.markFailed(orderNsu)).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledExactlyOnceWith({ status: "failed" });
    expect(eq).toHaveBeenCalledWith("order_nsu", orderNsu);
  });
});
