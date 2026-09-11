import {
  InfinitePayProviderError,
  createInfinitePayClient,
  isSafeInfinitePayCheckoutUrl,
  sanitizeInfinitePayReceiptUrl,
  type InfinitePayClient,
} from "@/features/registration/infinitepay.server";
import type { PaymentLookup } from "@/features/registration/registration.domain";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ComplementCheckoutInput, ComplementPaymentStatus } from "./regent-payments.domain";
import { calculateComplementState } from "./regent-payments.domain";
import type { PortalAccess } from "./regent.domain";

const OPEN_PAYMENT_MESSAGE = "Já existe um pagamento complementar em aberto.";
const BALANCE_MESSAGE = "O valor informado excede o saldo complementar disponível.";
const CHOIR_MESSAGE = "A inscrição não pertence ao coro autorizado.";
const RESERVATION_UNKNOWN_MESSAGE = "Não foi possível confirmar a reserva do pagamento.";
const CHECKOUT_UNKNOWN_MESSAGE =
  "A confirmação do checkout está pendente. Atualize a página antes de tentar novamente.";
const RESERVATION_RELEASE_UNKNOWN_MESSAGE =
  "Não foi possível confirmar a liberação da reserva. Atualize a página e verifique o pagamento em aberto antes de tentar novamente.";

export type RegentPaymentRegistration = {
  id: string;
  choirId: string | null;
  paymentStatus: "legacy" | "pending" | "paid";
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
};

export type RegentAccountingPayment = {
  id: string;
  orderNsu: string;
  amountCents: number;
  status: ComplementPaymentStatus;
  checkoutUrl: string | null;
};

export type RegentPaymentReservation = {
  registrationId: string;
  choirId: string;
  amountCents: number;
  status: "creating";
  orderNsu: string;
  initiatedBy: string;
  initiatedByName: string;
  initiatedAs: "regent" | "admin";
};

export type RegentPaymentRecord = Omit<RegentPaymentReservation, "status"> & {
  id: string;
  status: ComplementPaymentStatus;
  checkoutUrl: string | null;
  transactionNsu?: string | null;
  paymentMethod?: "pix" | "credit_card" | null;
  installments?: number | null;
  receiptUrl?: string | null;
};

export type ComplementPaymentPublicStatus =
  | { status: "pending" }
  | {
      status: "paid";
      paymentMethod: "pix" | "credit_card";
      installments: number;
      receiptUrl?: string;
    };

export type RegentPaymentRepository = {
  findRegistration(registrationId: string): Promise<RegentPaymentRegistration | null>;
  listAccountingPayments(registrationId: string): Promise<RegentAccountingPayment[]>;
  reserve(input: RegentPaymentReservation): Promise<void>;
  findByOrderNsu(orderNsu: string): Promise<RegentPaymentRecord | null>;
  findOpenPayment(registrationId: string): Promise<RegentPaymentRecord | null>;
  markPending(orderNsu: string, checkoutUrl: string): Promise<void>;
  markFailed(orderNsu: string): Promise<void>;
  markPaid(
    orderNsu: string,
    confirmation: {
      amountCents: number;
      transactionNsu: string;
      invoiceSlug: string;
      paymentMethod: "pix" | "credit_card";
      installments: number;
      paidAmountCents: number;
      receiptUrl?: string;
      paidAt: string;
    },
  ): Promise<RegentPaymentRecord>;
};

class RegentPaymentConflict extends Error {}
class RegentPaymentRepositoryOutcomeUnknown extends Error {}

function actorSnapshot(access: PortalAccess) {
  if (access.role === "regent") {
    return { initiatedByName: access.name, initiatedAs: "regent" as const };
  }
  const email = access.email?.trim();
  return {
    initiatedByName: email && email.length >= 2 && email.length <= 254 ? email : "Administrador",
    initiatedAs: "admin" as const,
  };
}

function isExactReservation(row: RegentPaymentRecord, expected: RegentPaymentReservation) {
  return (
    row.registrationId === expected.registrationId &&
    row.choirId === expected.choirId &&
    row.amountCents === expected.amountCents &&
    row.orderNsu === expected.orderNsu &&
    row.status === expected.status &&
    row.checkoutUrl === null &&
    row.initiatedBy === expected.initiatedBy &&
    row.initiatedByName === expected.initiatedByName &&
    row.initiatedAs === expected.initiatedAs
  );
}

function eligibilityMessage(reason: string) {
  switch (reason) {
    case "standard_price":
      return "Esta inscrição não possui complemento.";
    case "awaiting_participant_payment":
      return "Aguardando pagamento do participante.";
    case "settled":
      return "O complemento desta inscrição já está quitado.";
    default:
      return "Esta inscrição não permite pagamento complementar.";
  }
}

function safePaidTotal(payments: RegentAccountingPayment[]) {
  let total = 0;
  for (const payment of payments) {
    if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) {
      throw new Error("Não foi possível calcular o saldo complementar.");
    }
    if (payment.status === "paid") {
      total += payment.amountCents;
      if (!Number.isSafeInteger(total)) {
        throw new Error("Não foi possível calcular o saldo complementar.");
      }
    }
  }
  return total;
}

export function createRegentPaymentService({
  repository,
  infinitePay,
  randomUUID,
  now = () => new Date().toISOString(),
}: {
  repository: RegentPaymentRepository;
  infinitePay: InfinitePayClient;
  randomUUID: () => string;
  now?: () => string;
}) {
  return {
    findByOrderNsu: repository.findByOrderNsu,
    async startCheckout(input: ComplementCheckoutInput, access: PortalAccess) {
      if (access.role === "regent" && access.passwordChangeRequired) {
        throw new Error("Altere sua senha antes de acessar a área do regente.");
      }
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
        throw new Error("Informe um valor válido para o pagamento.");
      }

      const registration = await repository.findRegistration(input.registrationId);
      if (!registration?.choirId) throw new Error("Inscrição indisponível para pagamento.");
      if (access.role === "regent" && registration.choirId !== access.choirId) {
        throw new Error(CHOIR_MESSAGE);
      }
      const authorizedChoirId = registration.choirId;

      // This is deliberately the final application-side read before reserve.
      // The database trigger repeats the calculation under the registration lock.
      const payments = await repository.listAccountingPayments(registration.id);
      if (
        payments.some((payment) => payment.status === "creating" || payment.status === "pending")
      ) {
        throw new Error(OPEN_PAYMENT_MESSAGE);
      }
      const state = calculateComplementState({
        paymentStatus: registration.paymentStatus,
        pricingType: registration.pricingType,
        standardPriceCents: registration.standardPriceCents,
        registrationPriceCents: registration.registrationPriceCents,
        confirmedComplementCents: safePaidTotal(payments),
        openPayment: null,
      });
      if (!state.eligible) throw new Error(eligibilityMessage(state.reason));
      if (input.amountCents > state.balanceCents) throw new Error(BALANCE_MESSAGE);

      const orderNsu = randomUUID();
      const reservation: RegentPaymentReservation = {
        registrationId: registration.id,
        choirId: authorizedChoirId,
        amountCents: input.amountCents,
        status: "creating",
        orderNsu,
        initiatedBy: access.userId,
        ...actorSnapshot(access),
      };

      try {
        await repository.reserve(reservation);
      } catch (caught) {
        if (caught instanceof RegentPaymentConflict) throw caught;
        const exact = await repository.findByOrderNsu(orderNsu).catch(() => null);
        if (!exact || !isExactReservation(exact, reservation)) {
          const open = await repository.findOpenPayment(registration.id).catch(() => null);
          if (open) throw new Error(OPEN_PAYMENT_MESSAGE);
          throw new Error(RESERVATION_UNKNOWN_MESSAGE);
        }
      }

      let checkout: { url: string };
      try {
        checkout = await infinitePay.createCheckout({
          orderNsu,
          items: [
            {
              quantity: 1,
              price: input.amountCents,
              description: "Complemento de inscrição — II Encontro de Coros",
            },
          ],
          redirectPath: "/regente/pagamento",
        });
      } catch (caught) {
        if (
          caught instanceof InfinitePayProviderError &&
          caught.outcome === "confirmed_rejection"
        ) {
          try {
            await repository.markFailed(orderNsu);
          } catch {
            throw new Error(RESERVATION_RELEASE_UNKNOWN_MESSAGE);
          }
          throw caught;
        }
        throw new Error(CHECKOUT_UNKNOWN_MESSAGE);
      }

      if (!isSafeInfinitePayCheckoutUrl(checkout.url)) {
        throw new Error(CHECKOUT_UNKNOWN_MESSAGE);
      }
      try {
        await repository.markPending(orderNsu, checkout.url);
      } catch {
        throw new Error(CHECKOUT_UNKNOWN_MESSAGE);
      }

      return { checkoutUrl: checkout.url, orderNsu };
    },

    async reconcilePayment(lookup: PaymentLookup): Promise<ComplementPaymentPublicStatus> {
      const payment = await repository.findByOrderNsu(lookup.orderNsu);
      if (!payment) throw new Error("Pedido não encontrado.");

      if (payment.status === "paid") {
        if (payment.transactionNsu !== lookup.transactionNsu) {
          throw new Error("Transação divergente para pedido já confirmado.");
        }
        return toComplementPaymentPublicStatus(payment);
      }
      if (payment.status !== "pending") return { status: "pending" };

      const checked = await infinitePay.checkPayment(lookup);
      if (!checked.paid) return { status: "pending" };
      if (checked.amountCents !== payment.amountCents) {
        throw new Error("Valor do pagamento divergente.");
      }
      if (checked.paidAmountCents < payment.amountCents) {
        throw new Error("Valor pago é inferior ao valor do pedido.");
      }

      const confirmed = await repository.markPaid(lookup.orderNsu, {
        amountCents: payment.amountCents,
        transactionNsu: lookup.transactionNsu,
        invoiceSlug: lookup.slug,
        paymentMethod: checked.paymentMethod,
        installments: checked.installments,
        paidAmountCents: checked.paidAmountCents,
        receiptUrl: sanitizeInfinitePayReceiptUrl(lookup.receiptUrl),
        paidAt: now(),
      });
      return toComplementPaymentPublicStatus(confirmed);
    },

    async getComplementPaymentStatus(
      orderNsu: string,
    ): Promise<ComplementPaymentPublicStatus | null> {
      const payment = await repository.findByOrderNsu(orderNsu);
      return payment ? toComplementPaymentPublicStatus(payment) : null;
    },
  };
}

function toComplementPaymentPublicStatus(
  record: RegentPaymentRecord,
): ComplementPaymentPublicStatus {
  if (
    record.status !== "paid" ||
    !record.paymentMethod ||
    !record.installments ||
    !record.transactionNsu
  ) {
    return { status: "pending" };
  }
  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
  };
}

const registrationColumns =
  "id,choir_id,payment_status,pricing_type,standard_price_cents,registration_price_cents" as const;
const paymentColumns =
  "id,registration_id,choir_id,amount_cents,status,order_nsu,checkout_url,infinitepay_invoice_slug,infinitepay_transaction_nsu,payment_method,installments,paid_amount_cents,receipt_url,paid_at,initiated_by,initiated_by_name,initiated_as" as const;

type PaymentDatabaseRow = {
  id: string;
  registration_id: string;
  choir_id: string;
  amount_cents: number;
  status: string;
  order_nsu: string;
  checkout_url: string | null;
  infinitepay_invoice_slug?: string | null;
  infinitepay_transaction_nsu?: string | null;
  payment_method?: string | null;
  installments?: number | null;
  paid_amount_cents?: number | null;
  receipt_url?: string | null;
  paid_at?: string | null;
  initiated_by: string;
  initiated_by_name: string;
  initiated_as: string;
  infinitepay_invoice_slug?: string | null;
  infinitepay_transaction_nsu?: string | null;
  payment_method?: string | null;
  installments?: number | null;
  paid_amount_cents?: number | null;
  receipt_url?: string | null;
  paid_at?: string | null;
};

function isPaymentStatus(value: string): value is ComplementPaymentStatus {
  return ["creating", "pending", "paid", "failed", "expired"].includes(value);
}

function mapPaymentRow(row: PaymentDatabaseRow): RegentPaymentRecord {
  if (
    !isPaymentStatus(row.status) ||
    !Number.isSafeInteger(row.amount_cents) ||
    row.amount_cents <= 0 ||
    (row.initiated_as !== "regent" && row.initiated_as !== "admin")
  ) {
    throw new Error("Registro de pagamento complementar inválido.");
  }
  return {
    id: row.id,
    registrationId: row.registration_id,
    choirId: row.choir_id,
    amountCents: row.amount_cents,
    status: row.status,
    orderNsu: row.order_nsu,
    checkoutUrl: row.checkout_url,
    initiatedBy: row.initiated_by,
    initiatedByName: row.initiated_by_name,
    initiatedAs: row.initiated_as,
    ...(row.infinitepay_transaction_nsu !== undefined
      ? { transactionNsu: row.infinitepay_transaction_nsu }
      : {}),
    ...(row.payment_method === "pix" || row.payment_method === "credit_card"
      ? { paymentMethod: row.payment_method }
      : {}),
    ...(row.installments !== undefined ? { installments: row.installments } : {}),
    ...(row.receipt_url !== undefined ? { receiptUrl: row.receipt_url } : {}),
  };
}

function databaseErrorText(error: { message?: string; details?: string; hint?: string }) {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

function throwReserveError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  const text = databaseErrorText(error);
  if (error.code === "23505" && text.includes("registration_complement_payments_open_uidx")) {
    throw new RegentPaymentConflict(OPEN_PAYMENT_MESSAGE);
  }
  if (error.code === "23514" && text.includes("Complement amount exceeds outstanding balance")) {
    throw new RegentPaymentConflict(BALANCE_MESSAGE);
  }
  if (
    error.code === "23514" &&
    (text.includes("Complement requires a paid promotional registration") ||
      text.includes("Registration pricing snapshots are incomplete or inconsistent"))
  ) {
    throw new RegentPaymentConflict("Esta inscrição não permite pagamento complementar.");
  }
  if (error.code === "23514" && text.includes("Registration belongs to another choir")) {
    throw new RegentPaymentConflict(CHOIR_MESSAGE);
  }
  if (["23502", "23503", "23505", "23514", "42501", "P0001"].includes(error.code ?? "")) {
    throw new RegentPaymentConflict("Não foi possível reservar o pagamento complementar.");
  }
  throw new RegentPaymentRepositoryOutcomeUnknown();
}

export function createSupabaseRegentPaymentRepository(): RegentPaymentRepository {
  const findByOrderNsu = async (orderNsu: string) => {
    const { data, error } = await supabaseAdmin
      .from("registration_complement_payments")
      .select(paymentColumns)
      .eq("order_nsu", orderNsu)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar o pagamento complementar.");
    return data ? mapPaymentRow(data as PaymentDatabaseRow) : null;
  };

  async function reconcileStatus(
    orderNsu: string,
    status: "pending" | "failed",
    checkoutUrl?: string,
  ) {
    const current = await findByOrderNsu(orderNsu);
    if (
      current?.status === status &&
      (status !== "pending" || current.checkoutUrl === checkoutUrl)
    ) {
      return;
    }
    throw new RegentPaymentRepositoryOutcomeUnknown();
  }

  return {
    async findRegistration(registrationId) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .select(registrationColumns)
        .eq("id", registrationId)
        .maybeSingle();
      if (error) throw new Error("Não foi possível consultar a inscrição.");
      if (!data) return null;
      if (
        !["legacy", "pending", "paid"].includes(data.payment_status) ||
        (data.pricing_type !== null &&
          data.pricing_type !== "standard" &&
          data.pricing_type !== "promotional")
      ) {
        throw new Error("Registro de inscrição inválido.");
      }
      return {
        id: data.id,
        choirId: data.choir_id,
        paymentStatus: data.payment_status as RegentPaymentRegistration["paymentStatus"],
        pricingType: data.pricing_type as RegentPaymentRegistration["pricingType"],
        standardPriceCents: data.standard_price_cents,
        registrationPriceCents: data.registration_price_cents,
      };
    },

    async listAccountingPayments(registrationId) {
      const { data, error } = await supabaseAdmin
        .from("registration_complement_payments")
        .select(paymentColumns)
        .eq("registration_id", registrationId)
        .in("status", ["creating", "pending", "paid"]);
      if (error) throw new Error("Não foi possível calcular o saldo complementar.");
      return (data ?? []).map((row) => {
        const payment = mapPaymentRow(row as PaymentDatabaseRow);
        return {
          id: payment.id,
          orderNsu: payment.orderNsu,
          amountCents: payment.amountCents,
          status: payment.status,
          checkoutUrl: payment.checkoutUrl,
        };
      });
    },

    async reserve(input) {
      let response: {
        data: PaymentDatabaseRow | null;
        error: { code?: string; message?: string; details?: string; hint?: string } | null;
      };
      try {
        response = (await supabaseAdmin
          .from("registration_complement_payments")
          .insert({
            registration_id: input.registrationId,
            choir_id: input.choirId,
            amount_cents: input.amountCents,
            status: input.status,
            order_nsu: input.orderNsu,
            initiated_by: input.initiatedBy,
            initiated_by_name: input.initiatedByName,
            initiated_as: input.initiatedAs,
          })
          .select(paymentColumns)
          .single()) as unknown as typeof response;
      } catch {
        throw new RegentPaymentRepositoryOutcomeUnknown();
      }
      if (response.error) throwReserveError(response.error);
      if (!response.data || !isExactReservation(mapPaymentRow(response.data), input)) {
        throw new RegentPaymentRepositoryOutcomeUnknown();
      }
    },

    findByOrderNsu,

    async findOpenPayment(registrationId) {
      const { data, error } = await supabaseAdmin
        .from("registration_complement_payments")
        .select(paymentColumns)
        .eq("registration_id", registrationId)
        .in("status", ["creating", "pending"])
        .maybeSingle();
      if (error) throw new Error("Não foi possível consultar o pagamento complementar.");
      return data ? mapPaymentRow(data as PaymentDatabaseRow) : null;
    },

    async markPending(orderNsu, checkoutUrl) {
      try {
        const { data, error } = await supabaseAdmin
          .from("registration_complement_payments")
          .update({ status: "pending", checkout_url: checkoutUrl })
          .eq("order_nsu", orderNsu)
          .eq("status", "creating")
          .select(paymentColumns)
          .maybeSingle();
        if (!error && data) {
          const row = mapPaymentRow(data as PaymentDatabaseRow);
          if (row.status === "pending" && row.checkoutUrl === checkoutUrl) return;
        }
      } catch {
        // A thrown response does not establish whether the update committed.
      }
      await reconcileStatus(orderNsu, "pending", checkoutUrl);
    },

    async markFailed(orderNsu) {
      try {
        const { data, error } = await supabaseAdmin
          .from("registration_complement_payments")
          .update({ status: "failed" })
          .eq("order_nsu", orderNsu)
          .eq("status", "creating")
          .select(paymentColumns)
          .maybeSingle();
        if (!error && data && mapPaymentRow(data as PaymentDatabaseRow).status === "failed") return;
      } catch {
        // Reconcile the exact row below; never infer rollback from transport loss.
      }
      await reconcileStatus(orderNsu, "failed");
    },

    async markPaid(orderNsu, confirmation) {
      try {
        const { data, error } = await supabaseAdmin
          .from("registration_complement_payments")
          .update({
            status: "paid",
            infinitepay_invoice_slug: confirmation.invoiceSlug,
            infinitepay_transaction_nsu: confirmation.transactionNsu,
            payment_method: confirmation.paymentMethod,
            installments: confirmation.installments,
            paid_amount_cents: confirmation.paidAmountCents,
            receipt_url: confirmation.receiptUrl ?? null,
            paid_at: confirmation.paidAt,
          })
          .eq("order_nsu", orderNsu)
          .eq("status", "pending")
          .select(paymentColumns)
          .maybeSingle();
        if (!error && data) return mapPaymentRow(data as PaymentDatabaseRow);
      } catch {
        // Reconcile the exact transaction because the provider call is idempotent.
      }

      const existing = await findByOrderNsu(orderNsu);
      if (
        existing?.status === "paid" &&
        existing.amountCents === confirmation.amountCents &&
        existing.transactionNsu === confirmation.transactionNsu
      ) {
        return existing;
      }
      throw new Error("Transação divergente ou pedido indisponível.");
    },
  };
}

let regentPaymentService: ReturnType<typeof createRegentPaymentService> | undefined;

export function getRegentPaymentService() {
  if (!regentPaymentService) {
    regentPaymentService = createRegentPaymentService({
      repository: createSupabaseRegentPaymentRepository(),
      infinitePay: createInfinitePayClient(fetch, {
        handle: process.env.INFINITEPAY_HANDLE?.trim() || "lucas-soares-xwv",
        siteUrl:
          process.env.PUBLIC_SITE_URL?.trim() || "https://encontrocorosdiocesanosce.lovable.app",
      }),
      randomUUID: () => crypto.randomUUID(),
    });
  }
  return regentPaymentService;
}
