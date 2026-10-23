import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InfinitePayClient } from "@/features/registration/infinitepay.server";
import { InfinitePayProviderError } from "@/features/registration/infinitepay.server";
import type { PaymentLookup } from "@/features/registration/registration.domain";
import type { PortalAccess } from "./regent.domain";
import {
  createRegentPaymentService,
  createSupabaseRegentPaymentRepository,
  resolveRegentInfinitePayConfig,
  type RegentPaymentRecord,
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
const paymentLookup: PaymentLookup = {
  orderNsu,
  transactionNsu: "transaction-123",
  slug: "invoice-123",
  receiptUrl: "https://receipts.infinitepay.com.br/receipt-123",
};

const regent: PortalAccess = {
  role: "regent",
  userId: "regent-user",
  membershipId: "regent-membership",
  choirId,
  choirName: "Coro Diocesano de Quixadá",
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
    markPaid: vi.fn(),
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

  const participant = {
    role: "participant" as const,
    userId: "participant-user",
    registrationId,
    name: "Maria Participante",
  };

  it("charges only the participant's current remaining balance and records the real actor", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid", orderNsu: "previous", amountCents: 4000, status: "paid", checkoutUrl: null },
    ]);
    await service.startCheckout({ registrationId }, participant);
    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationId,
        amountCents: 6000,
        initiatedBy: participant.userId,
        initiatedAs: "participant",
        initiatedByName: participant.name,
      }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectPath: "/participante/pagamento",
        items: [expect.objectContaining({ price: 6000, quantity: 1 })],
      }),
    );
  });

  it("charges the number of promotional raffles selected by the participant", async () => {
    const { service, repository, infinitePay } = setup();
    await service.startCheckout({ registrationId, raffleTickets: 3 }, participant);
    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 3_000, initiatedAs: "participant" }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ quantity: 3, price: 1_000, description: expect.stringContaining("rifa") }] }),
    );
  });

  it("lets an approved free registration pay sold raffles without charging its registration", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.findRegistration).mockResolvedValue({
      ...registration,
      pricingType: "standard",
      standardPriceCents: 0,
      registrationPriceCents: 0,
      remainingPriceCents: 0,
      isFreeRegistration: true,
      paymentOrigin: "exemption",
    });
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid", orderNsu: "previous", amountCents: 5_000, status: "paid", checkoutUrl: null },
    ]);
    await service.startCheckout({ registrationId, raffleTickets: 4 }, participant);
    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 4_000, initiatedAs: "participant" }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ quantity: 4, price: 1_000, description: expect.stringContaining("rifa") }] }),
    );
  });

  it("allows sold raffles above the initial target", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid", orderNsu: "previous", amountCents: 9_000, status: "paid", checkoutUrl: null },
    ]);
    await service.startCheckout({ registrationId, raffleTickets: 2 }, participant);
    expect(repository.reserve).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 2_000 }));
    expect(infinitePay.createCheckout).toHaveBeenCalled();
  });

  it("allows more raffle sales after the original target is fully paid", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid", orderNsu: "previous", amountCents: 10_000, status: "paid", checkoutUrl: null },
    ]);
    await service.startCheckout({ registrationId, raffleTickets: 5 }, participant);
    expect(repository.reserve).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 5_000 }));
  });

  it("charges the configured promotional balance instead of deriving a discount difference", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.findRegistration).mockResolvedValue({
      ...registration,
      standardPriceCents: 30_000,
      registrationPriceCents: 10_000,
      remainingPriceCents: 25_000,
    });

    await service.startCheckout({ registrationId }, regent);

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 25_000 }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ price: 25_000, quantity: 1 })] }),
    );
  });

  it("denies another registration even when it belongs to the same choir", async () => {
    const { service, repository, infinitePay } = setup();
    await expect(
      service.startCheckout(
        { registrationId },
        {
          ...participant,
          registrationId: "another-registration",
        },
      ),
    ).rejects.toThrow("Acesso não autorizado");
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("resumes an existing safe checkout without reserving or charging again", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      {
        id: "open",
        orderNsu,
        amountCents: 10000,
        status: "pending",
        checkoutUrl,
        initiatedAs: "participant",
      },
    ]);
    await expect(service.startCheckout({ registrationId }, participant)).resolves.toEqual({
      orderNsu,
      checkoutUrl,
    });
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("reports an existing partial checkout when the participant selects another quantity", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([{
      id: "open",
      orderNsu,
      amountCents: 3_000,
      status: "pending",
      checkoutUrl,
      initiatedAs: "participant",
    }]);
    await expect(service.startCheckout({ registrationId, raffleTickets: 5 }, participant)).resolves.toEqual({
      orderNsu,
      checkoutUrl,
      existingRaffleTickets: 3,
    });
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it.each(["creating", "pending"] as const)(
    "blocks an unresolved or unsafe %s checkout",
    async (status) => {
      const { service, repository, infinitePay } = setup();
      vi.mocked(repository.listAccountingPayments).mockResolvedValue([
        {
          id: "open",
          orderNsu,
          amountCents: 10000,
          status,
          checkoutUrl: "https://unsafe.example/pay",
        },
      ]);
      await expect(service.startCheckout({ registrationId }, participant)).rejects.toThrow();
      expect(repository.reserve).not.toHaveBeenCalled();
      expect(infinitePay.createCheckout).not.toHaveBeenCalled();
    },
  );

  it("denies verification of another participant's order before calling the provider", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "payment",
      registrationId: "another-registration",
      choirId,
      orderNsu,
      amountCents: 10000,
      status: "pending",
      checkoutUrl,
      initiatedBy: participant.userId,
      initiatedAs: "participant",
      initiatedByName: participant.name,
    });
    await expect(service.reconcilePaymentForAccess(paymentLookup, participant)).rejects.toThrow(
      "Acesso não autorizado",
    );
    expect(infinitePay.checkPayment).not.toHaveBeenCalled();
    expect(repository.markPaid).not.toHaveBeenCalled();
  });

  it("lets the participant continue a safe checkout opened by the regent", async () => {
    const { service, repository, infinitePay } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      {
        id: "open",
        orderNsu,
        amountCents: 10000,
        status: "pending",
        checkoutUrl,
        initiatedAs: "regent",
      },
    ]);
    await expect(service.startCheckout({ registrationId }, participant)).resolves.toEqual({
      checkoutUrl,
      orderNsu,
    });
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("confirms the participant's own payment only after checking the provider amount", async () => {
    const { service, repository, infinitePay } = setup();
    const payment: RegentPaymentRecord = {
      id: "payment",
      registrationId,
      choirId,
      orderNsu,
      amountCents: 8000,
      status: "pending",
      checkoutUrl,
      initiatedBy: participant.userId,
      initiatedAs: "participant",
      initiatedByName: participant.name,
    };
    vi.mocked(repository.findByOrderNsu).mockResolvedValue(payment);
    vi.mocked(infinitePay.checkPayment).mockResolvedValue({
      paid: true,
      amountCents: 8000,
      paidAmountCents: 8000,
      paymentMethod: "pix",
      installments: 1,
    });
    vi.mocked(repository.markPaid).mockResolvedValue({
      ...payment,
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      transactionNsu: paymentLookup.transactionNsu,
    });
    await expect(
      service.reconcilePaymentForAccess(paymentLookup, participant),
    ).resolves.toMatchObject({ status: "paid", paymentMethod: "pix" });
    expect(repository.markPaid).toHaveBeenCalledWith(
      orderNsu,
      expect.objectContaining({ amountCents: 8000, transactionNsu: paymentLookup.transactionNsu }),
    );
    vi.mocked(infinitePay.checkPayment).mockResolvedValue({
      paid: true,
      amountCents: 100,
      paidAmountCents: 100,
      paymentMethod: "pix",
      installments: 1,
    });
    vi.mocked(repository.markPaid).mockClear();
    await expect(service.reconcilePaymentForAccess(paymentLookup, participant)).rejects.toThrow(
      "Valor do pagamento divergente",
    );
    expect(repository.markPaid).not.toHaveBeenCalled();
  });

  it("reserves the current balance snapshot before creating a PII-free provider checkout", async () => {
    const { repository, infinitePay, service } = setup();

    await expect(service.startCheckout({ registrationId }, regent)).resolves.toEqual({
      checkoutUrl,
      orderNsu,
    });

    expect(repository.findRegistration).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(repository.listAccountingPayments).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(repository.reserve).toHaveBeenCalledExactlyOnceWith({
      registrationId,
      choirId,
      amountCents: 10_000,
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
          price: 10_000,
          description: "Saldo da inscrição — II Encontro de Coros",
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

  it("uses the current full balance and administrator return path without participant data", async () => {
    const { repository, infinitePay, service } = setup();
    const admin: PortalAccess = {
      role: "admin",
      userId: "admin-user",
      email: "admin@example.com",
    };

    await service.startCheckout({ registrationId }, admin);

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        choirId,
        initiatedBy: "admin-user",
        initiatedByName: "admin@example.com",
        initiatedAs: "admin",
        amountCents: 10_000,
      }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            quantity: 1,
            price: 10_000,
            description: "Saldo da inscrição — II Encontro de Coros",
          },
        ],
        redirectPath: "/admin/pagamento",
      }),
    );
  });

  it("rejects a registration from another choir before reading its ledger", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findRegistration).mockResolvedValue({
      ...registration,
      choirId: "44444444-4444-4444-8444-444444444444",
    });

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "A inscrição não pertence ao coro autorizado.",
    );

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

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(message);

    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("charges exactly the current balance after confirmed historical complements", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid-1", orderNsu: "paid-order", amountCents: 7_000, status: "paid", checkoutUrl },
    ]);

    await expect(service.startCheckout({ registrationId }, regent)).resolves.toEqual({
      checkoutUrl,
      orderNsu,
    });

    expect(repository.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 3_000 }),
    );
    expect(infinitePay.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            quantity: 1,
            price: 3_000,
            description: "Saldo da inscrição — II Encontro de Coros",
          },
        ],
      }),
    );
  });

  it("blocks a settled registration with no balance", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.listAccountingPayments).mockResolvedValue([
      { id: "paid-1", orderNsu: "paid-order", amountCents: 10_000, status: "paid", checkoutUrl },
    ]);

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "O complemento desta inscrição já está quitado.",
    );

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

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "Já existe um pagamento complementar em aberto.",
    );

    expect(repository.reserve).not.toHaveBeenCalled();
    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
  });

  it("rejects a regent who still must change the temporary password", async () => {
    const { repository, service } = setup();

    await expect(
      service.startCheckout({ registrationId }, { ...regent, passwordChangeRequired: true }),
    ).rejects.toThrow("Altere sua senha antes de acessar a área do regente.");

    expect(repository.findRegistration).not.toHaveBeenCalled();
  });

  it("marks an exact reservation failed after a confirmed provider rejection", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockRejectedValue(
      new InfinitePayProviderError("confirmed_rejection"),
    );

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "Não foi possível comunicar com a InfinitePay.",
    );

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

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
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

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
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

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
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
      amountCents: 10_000,
      status: "creating",
      orderNsu,
      checkoutUrl: null,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });

    await expect(service.startCheckout({ registrationId }, regent)).resolves.toEqual({
      checkoutUrl,
      orderNsu,
    });

    expect(infinitePay.createCheckout).toHaveBeenCalledOnce();
  });

  it("does not call the provider when an ambiguous reservation cannot be proven", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.reserve).mockRejectedValue(new TypeError("response lost"));
    vi.mocked(repository.findByOrderNsu).mockResolvedValue(null);

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "Não foi possível confirmar a reserva do pagamento.",
    );

    expect(infinitePay.createCheckout).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("does not persist a checkout URL that is not a trusted InfinitePay HTTPS address", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(infinitePay.createCheckout).mockResolvedValue({
      url: "https://infinitepay.example.evil/checkout",
    });

    await expect(service.startCheckout({ registrationId }, regent)).rejects.toThrow(
      "A confirmação do checkout está pendente. Atualize a página antes de tentar novamente.",
    );

    expect(repository.markPending).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("confirms an exact paid provider response and stores only verified provider fields", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "pending",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });
    vi.mocked(infinitePay.checkPayment).mockResolvedValue({
      paid: true,
      amountCents: 5_000,
      paidAmountCents: 5_200,
      paymentMethod: "pix",
      installments: 1,
    });
    vi.mocked(repository.markPaid).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "paid",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
      transactionNsu: paymentLookup.transactionNsu,
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: paymentLookup.receiptUrl,
    });

    await expect(service.reconcilePayment(paymentLookup)).resolves.toEqual({
      status: "paid",
      paymentMethod: "pix",
      installments: 1,
      receiptUrl: paymentLookup.receiptUrl,
    });
    expect(repository.markPaid).toHaveBeenCalledWith(orderNsu, {
      amountCents: 5_000,
      transactionNsu: paymentLookup.transactionNsu,
      invoiceSlug: paymentLookup.slug,
      paymentMethod: "pix",
      installments: 1,
      paidAmountCents: 5_200,
      receiptUrl: paymentLookup.receiptUrl,
      paidAt: expect.any(String),
    });
  });

  it.each([
    [
      "a different original amount",
      { amountCents: 4_999, paidAmountCents: 5_200 },
      "Valor do pagamento divergente.",
    ],
    [
      "an insufficient paid amount",
      { amountCents: 5_000, paidAmountCents: 4_999 },
      "Valor pago é inferior ao valor do pedido.",
    ],
  ])("rejects %s before crediting the ledger", async (_case, checked, message) => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "pending",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });
    vi.mocked(infinitePay.checkPayment).mockResolvedValue({
      paid: true,
      paymentMethod: "pix",
      installments: 1,
      ...checked,
    });

    await expect(service.reconcilePayment(paymentLookup)).rejects.toThrow(message);
    expect(repository.markPaid).not.toHaveBeenCalled();
  });

  it("accepts only the same transaction when the order was already confirmed", async () => {
    const { infinitePay, repository, service } = setup();
    const confirmedPayment: RegentPaymentRecord = {
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "paid",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
      transactionNsu: paymentLookup.transactionNsu,
      paymentMethod: "credit_card",
      installments: 2,
    };
    vi.mocked(repository.findByOrderNsu).mockImplementation(async (requestedOrderNsu) =>
      requestedOrderNsu === orderNsu ? confirmedPayment : null,
    );

    await expect(service.reconcilePayment(paymentLookup)).resolves.toMatchObject({
      status: "paid",
    });
    await expect(
      service.reconcilePayment({ ...paymentLookup, transactionNsu: "other-transaction" }),
    ).rejects.toThrow("Transação divergente para pedido já confirmado.");
    await expect(
      service.reconcilePayment({
        ...paymentLookup,
        orderNsu: "44444444-4444-4444-8444-444444444444",
      }),
    ).rejects.toThrow("Pedido não encontrado.");
    expect(infinitePay.checkPayment).not.toHaveBeenCalled();
  });

  it("rejects a ready regent's reconciliation attempt for another choir before provider verification", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId: "44444444-4444-4444-8444-444444444444",
      amountCents: 5_000,
      status: "pending",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });

    await expect(service.reconcilePaymentForAccess(paymentLookup, regent)).rejects.toThrow(
      "A inscrição não pertence ao coro autorizado.",
    );
    expect(infinitePay.checkPayment).not.toHaveBeenCalled();
    expect(repository.markPaid).not.toHaveBeenCalled();
  });

  it("drops an unsafe return receipt before saving a confirmed complement", async () => {
    const { repository, infinitePay, service } = setup();
    vi.mocked(repository.findByOrderNsu).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "pending",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
    });
    vi.mocked(infinitePay.checkPayment).mockResolvedValue({
      paid: true,
      amountCents: 5_000,
      paidAmountCents: 5_000,
      paymentMethod: "pix",
      installments: 1,
    });
    vi.mocked(repository.markPaid).mockResolvedValue({
      id: "payment-1",
      registrationId,
      choirId,
      amountCents: 5_000,
      status: "paid",
      orderNsu,
      checkoutUrl,
      initiatedBy: regent.userId,
      initiatedByName: regent.name,
      initiatedAs: "regent",
      transactionNsu: paymentLookup.transactionNsu,
      paymentMethod: "pix",
      installments: 1,
    });

    await service.reconcilePayment({
      ...paymentLookup,
      receiptUrl: "https://infinitepay.com.br.evil.example/receipt",
    });

    expect(repository.markPaid).toHaveBeenCalledWith(
      orderNsu,
      expect.objectContaining({ receiptUrl: undefined }),
    );
  });
});

describe("regent InfinitePay configuration", () => {
  it("uses the approved registration account by default while preserving an explicit override", () => {
    expect(resolveRegentInfinitePayConfig({})).toMatchObject({ handle: "antonio-gerbson" });
    expect(
      resolveRegentInfinitePayConfig({ INFINITEPAY_HANDLE: "  alternate-account  " }),
    ).toMatchObject({
      handle: "alternate-account",
    });
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
  const paidDatabasePayment = {
    ...databasePayment,
    status: "paid",
    infinitepay_invoice_slug: paymentLookup.slug,
    infinitepay_transaction_nsu: paymentLookup.transactionNsu,
    payment_method: "pix",
    installments: 1,
    paid_amount_cents: 5_000,
    receipt_url: paymentLookup.receiptUrl,
    paid_at: "2026-09-11T15:30:00.000Z",
  };
  const paymentConfirmation = {
    amountCents: 5_000,
    transactionNsu: paymentLookup.transactionNsu,
    invoiceSlug: paymentLookup.slug,
    paymentMethod: "pix" as const,
    installments: 1,
    paidAmountCents: 5_000,
    receiptUrl: paymentLookup.receiptUrl,
    paidAt: "2026-09-11T15:30:00.000Z",
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

  it.each(["regent", "admin", "participant"])(
    "reads accounting rows initiated by %s",
    async (initiatedAs) => {
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
        data: [
          { ...databasePayment, initiated_as: initiatedAs },
          { ...databasePayment, initiated_as: initiatedAs, id: "paid-1", status: "paid" },
        ],
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
          initiatedAs,
        },
        {
          id: "paid-1",
          orderNsu,
          amountCents: 5_000,
          status: "paid",
          checkoutUrl: null,
          initiatedAs,
        },
      ]);
      expect(inFilter).toHaveBeenCalledExactlyOnceWith("status", ["creating", "pending", "paid"]);
    },
  );

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

  it.each([
    ["status", { status: "pending" }],
    ["order", { order_nsu: "44444444-4444-4444-8444-444444444444" }],
    ["original amount", { amount_cents: 5_001 }],
    ["transaction", { infinitepay_transaction_nsu: "other-transaction" }],
  ])("rejects a returned paid-update row with a different %s", async (_field, change) => {
    maybeSingle.mockResolvedValue({ data: { ...paidDatabasePayment, ...change }, error: null });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(repository.markPaid(orderNsu, paymentConfirmation)).rejects.toThrow(
      "Transação divergente ou pedido indisponível.",
    );
  });

  it("accepts only an exact returned paid-update row", async () => {
    maybeSingle.mockResolvedValue({ data: paidDatabasePayment, error: null });
    const repository = createSupabaseRegentPaymentRepository();

    await expect(repository.markPaid(orderNsu, paymentConfirmation)).resolves.toMatchObject({
      status: "paid",
      orderNsu,
      amountCents: 5_000,
      transactionNsu: paymentLookup.transactionNsu,
    });
  });
});
