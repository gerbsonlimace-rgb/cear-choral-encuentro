import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createInfinitePayClient,
  sanitizeInfinitePayReceiptUrl,
  type InfinitePayClient,
} from "./infinitepay.server";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  type PaymentLookup,
  type RegistrationInput,
} from "./registration.domain";

export type RegistrationPaymentRecord = {
  id: string;
  orderNsu: string;
  amountCents: number;
  paymentStatus: "pending" | "paid";
  transactionNsu: string | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  receiptUrl: string | null;
};

export type PublicPaymentStatus =
  | { status: "pending" }
  | {
      status: "paid";
      paymentMethod: "pix" | "credit_card";
      installments: number;
      receiptUrl?: string;
    };

export type RegistrationRepository = {
  createPending(
    input: RegistrationInput & { orderNsu: string; amountCents: number },
  ): Promise<void>;
  saveCheckoutUrl(orderNsu: string, checkoutUrl: string): Promise<void>;
  findPayment(orderNsu: string): Promise<RegistrationPaymentRecord | null>;
  markPaid(
    orderNsu: string,
    confirmation: {
      transactionNsu: string;
      invoiceSlug: string;
      paymentMethod: "pix" | "credit_card";
      installments: number;
      paidAmountCents: number;
      receiptUrl?: string;
      paidAt: string;
    },
  ): Promise<RegistrationPaymentRecord>;
};

export function createRegistrationPaymentService(deps: {
  repository: RegistrationRepository;
  infinitePay: InfinitePayClient;
  randomUUID: () => string;
  now: () => string;
}) {
  return {
    startCheckout: async (input: RegistrationInput) => {
      const orderNsu = deps.randomUUID();
      const amountCents = calculateOrderAmountCents(input);

      await deps.repository.createPending({ ...input, orderNsu, amountCents });
      const checkout = await deps.infinitePay.createCheckout({
        orderNsu,
        items: buildCheckoutItems(input),
        customer: { name: input.name, email: input.email, phoneNumber: input.phone },
      });
      await deps.repository.saveCheckoutUrl(orderNsu, checkout.url);

      return { checkoutUrl: checkout.url, orderNsu };
    },

    reconcilePayment: async (lookup: PaymentLookup): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(lookup.orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");

      if (registration.paymentStatus === "paid") {
        if (registration.transactionNsu !== lookup.transactionNsu) {
          throw new Error("Transação divergente para pedido já confirmado.");
        }
        return toPublicPaymentStatus(registration);
      }

      const checked = await deps.infinitePay.checkPayment(lookup);
      if (!checked.paid) return { status: "pending" };
      if (checked.amountCents !== registration.amountCents) {
        throw new Error("Valor do pagamento divergente.");
      }
      if (checked.paidAmountCents < registration.amountCents) {
        throw new Error("Valor pago é inferior ao valor do pedido.");
      }

      const confirmed = await deps.repository.markPaid(lookup.orderNsu, {
        transactionNsu: lookup.transactionNsu,
        invoiceSlug: lookup.slug,
        paymentMethod: checked.paymentMethod,
        installments: checked.installments,
        paidAmountCents: checked.paidAmountCents,
        receiptUrl: sanitizeInfinitePayReceiptUrl(lookup.receiptUrl),
        paidAt: deps.now(),
      });
      return toPublicPaymentStatus(confirmed);
    },

    getPublicStatus: async (orderNsu: string): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");
      return toPublicPaymentStatus(registration);
    },
  };
}

function toPublicPaymentStatus(record: RegistrationPaymentRecord): PublicPaymentStatus {
  if (record.paymentStatus !== "paid" || !record.paymentMethod || !record.installments) {
    return { status: "pending" };
  }

  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
  };
}

const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url" as const;

function mapPaymentRow(row: {
  id: string;
  order_nsu: string | null;
  amount_cents: number | null;
  payment_status: string;
  infinitepay_transaction_nsu: string | null;
  payment_method: string | null;
  installments: number | null;
  receipt_url: string | null;
}): RegistrationPaymentRecord {
  if (!row.order_nsu || !row.amount_cents || !["pending", "paid"].includes(row.payment_status)) {
    throw new Error("Registro de pagamento inválido.");
  }

  return {
    id: row.id,
    orderNsu: row.order_nsu,
    amountCents: row.amount_cents,
    paymentStatus: row.payment_status as "pending" | "paid",
    transactionNsu: row.infinitepay_transaction_nsu,
    paymentMethod: row.payment_method as "pix" | "credit_card" | null,
    installments: row.installments,
    receiptUrl: row.receipt_url,
  };
}

function createSupabaseRegistrationRepository(): RegistrationRepository {
  const findPayment = async (orderNsu: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(paymentColumns)
      .eq("order_nsu", orderNsu)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar a inscrição.");
    return data ? mapPaymentRow(data) : null;
  };

  return {
    createPending: async (input) => {
      const { error } = await supabaseAdmin.from("registrations").insert({
        name: input.name,
        email: input.email,
        phone: input.phone,
        city: input.city,
        institution: input.institution || null,
        role: input.role,
        observations: input.observations || null,
        include_shirt: input.includeShirt,
        shirt_size: input.includeShirt ? input.shirtSize : null,
        amount_cents: input.amountCents,
        payment_status: "pending",
        order_nsu: input.orderNsu,
      });

      if (error) throw new Error("Não foi possível salvar a inscrição.");
    },

    saveCheckoutUrl: async (orderNsu, checkoutUrl) => {
      const { error } = await supabaseAdmin
        .from("registrations")
        .update({ checkout_url: checkoutUrl })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending");

      if (error) throw new Error("Não foi possível salvar o checkout.");
    },

    findPayment,

    markPaid: async (orderNsu, confirmation) => {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          payment_status: "paid",
          infinitepay_invoice_slug: confirmation.invoiceSlug,
          infinitepay_transaction_nsu: confirmation.transactionNsu,
          payment_method: confirmation.paymentMethod,
          installments: confirmation.installments,
          paid_amount_cents: confirmation.paidAmountCents,
          receipt_url: confirmation.receiptUrl ?? null,
          paid_at: confirmation.paidAt,
        })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending")
        .select(paymentColumns)
        .maybeSingle();

      if (error) throw new Error("Não foi possível confirmar a inscrição.");
      if (data) return mapPaymentRow(data);

      const existing = await findPayment(orderNsu);
      if (
        existing?.paymentStatus === "paid" &&
        existing.transactionNsu === confirmation.transactionNsu
      ) {
        return existing;
      }
      throw new Error("Transação divergente ou pedido indisponível.");
    },
  };
}

let paymentService: ReturnType<typeof createRegistrationPaymentService> | undefined;

export function getRegistrationPaymentService() {
  if (!paymentService) {
    paymentService = createRegistrationPaymentService({
      repository: createSupabaseRegistrationRepository(),
      infinitePay: createInfinitePayClient(fetch, {
        handle: process.env.INFINITEPAY_HANDLE?.trim() || "antonio-gerbson",
        siteUrl: process.env.PUBLIC_SITE_URL?.trim() || "https://encontrocorosce.lovable.app",
      }),
      randomUUID: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }

  return paymentService;
}
