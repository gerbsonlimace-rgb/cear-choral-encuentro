import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getChoirPricingService,
  type ResolvedChoirSelection,
} from "@/features/choirs/choir-pricing.server";
import type { ParticipantAccessStatus } from "@/features/participant/participant.domain";
import {
  createInfinitePayClient,
  sanitizeInfinitePayReceiptUrl,
  type InfinitePayClient,
} from "./infinitepay.server";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  MAX_REGISTRATION_PHOTO_BYTES,
  type PaymentLookup,
  type RegistrationInput,
  type RegistrationPhotoInput,
} from "./registration.domain";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
const REGISTRATION_CPF_CONFLICT_MESSAGE =
  "Já existe uma inscrição para este CPF. Use Retomar pagamento.";

export type RegistrationPaymentRecord = {
  id: string;
  orderNsu: string;
  amountCents: number;
  paymentStatus: "pending" | "paid";
  transactionNsu: string | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  receiptUrl: string | null;
  participantName?: string | null;
  choirName?: string | null;
  paidAmountCents?: number | null;
  paidAt?: string | null;
  
};

export type PublicPaymentStatus =
  | { status: "pending" }
  | {
      status: "paid";
      paymentMethod: "pix" | "credit_card";
      installments: number;
      participantAccessStatus: ParticipantAccessStatus;
      receiptUrl?: string;
      orderNsu?: string;
      amountCents?: number;
      paidAmountCents?: number;
      paidAt?: string;
      participantName?: string;
      choirName?: string;
    };

export type RegistrationIdentityRecord = {
  id: string;
};

export type RegistrationResumeResult =
  { status: "pending"; checkoutUrl: string } | { status: "paid" };

export type RegistrationRepository = {
  findByCpf?: (cpf: string) => Promise<RegistrationIdentityRecord | null>;
  createPending(
    input: Omit<RegistrationInput, "photo"> & {
      orderNsu: string;
      amountCents: number;
      choirName: string;
      photoPath: string;
      pricingType: "standard" | "promotional";
      standardPriceCents: number;
      registrationPriceCents: number;
    },
  ): Promise<void>;
  saveCheckoutUrl(orderNsu: string, checkoutUrl: string): Promise<void>;
  clearPendingPhoto(orderNsu: string): Promise<void>;
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

export type RegistrationPhotoStorage = {
  upload(orderNsu: string, photo: RegistrationPhotoInput): Promise<string>;
  remove(photoPath: string): Promise<void>;
};

export function createRegistrationPaymentService(deps: {
  repository: RegistrationRepository;
  infinitePay: InfinitePayClient;
  photoStorage: RegistrationPhotoStorage;
  randomUUID: () => string;
  now: () => string;
  resolveChoirSelection: (choirId: string) => Promise<ResolvedChoirSelection>;
  provisionParticipant: (registrationId: string) => Promise<{ status: ParticipantAccessStatus }>;
}) {
  const toPaidPublicStatus = async (
    registration: RegistrationPaymentRecord,
  ): Promise<PublicPaymentStatus> => {
    let participantAccessStatus: ParticipantAccessStatus = "pending";
    try {
      participantAccessStatus = (await deps.provisionParticipant(registration.id)).status;
    } catch {
      // Payment truth is durable and must remain independent from delayed access preparation.
    }
    return toPublicPaymentStatus(registration, participantAccessStatus);
  };

  return {
    startCheckout: async (input: RegistrationInput) => {
      const existing = await deps.repository.findByCpf?.(input.cpf);
      if (existing) throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);

      const selection = await deps.resolveChoirSelection(input.choirId);
      const quoteChanged =
        input.displayedQuote.pricingType !== selection.quote.pricingType ||
        input.displayedQuote.standardPriceCents !== selection.quote.standardPriceCents ||
        input.displayedQuote.registrationPriceCents !== selection.quote.registrationPriceCents;
      if (quoteChanged) {
        throw new Error("A configuração de preços mudou. Confira o valor e tente novamente.");
      }

      const orderNsu = deps.randomUUID();
      const amountCents = calculateOrderAmountCents(input, selection.quote);
      const photoPath = await deps.photoStorage.upload(orderNsu, input.photo);
      const { photo: _photo, ...registrationData } = input;

      try {
        await deps.repository.createPending({
          ...registrationData,
          orderNsu,
          amountCents,
          choirName: selection.choir.name,
          photoPath,
          pricingType: selection.quote.pricingType,
          standardPriceCents: selection.quote.standardPriceCents,
          registrationPriceCents: selection.quote.registrationPriceCents,
        });
      } catch (caught) {
        await deps.photoStorage.remove(photoPath).catch(() => undefined);
        throw caught;
      }

      let checkout: { url: string };
      try {
        checkout = await deps.infinitePay.createCheckout({
          orderNsu,
          items: buildCheckoutItems(input, selection.quote),
          customer: { name: input.name, email: input.email, phoneNumber: input.phone },
        });
        await deps.repository.saveCheckoutUrl(orderNsu, checkout.url);
      } catch (caught) {
        await Promise.allSettled([
          deps.repository.clearPendingPhoto(orderNsu),
          deps.photoStorage.remove(photoPath),
        ]);
        throw caught;
      }

      return { checkoutUrl: checkout.url, orderNsu };
    },

    reconcilePayment: async (lookup: PaymentLookup): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(lookup.orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");

      if (registration.paymentStatus === "paid") {
        if (registration.transactionNsu !== lookup.transactionNsu) {
          throw new Error("Transação divergente para pedido já confirmado.");
        }
        return toPaidPublicStatus(registration);
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
      return toPaidPublicStatus(confirmed);
    },

    getPublicStatus: async (orderNsu: string): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");
      return toPublicPaymentStatus(registration);
    },
  };
}

export type RegistrationPaymentService = ReturnType<typeof createRegistrationPaymentService>;

function toPublicPaymentStatus(
  record: RegistrationPaymentRecord,
  participantAccessStatus: ParticipantAccessStatus = "pending",
): PublicPaymentStatus {
  if (record.paymentStatus !== "paid" || !record.paymentMethod || !record.installments) {
    return { status: "pending" };
  }

  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    participantAccessStatus,
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
    ...(record.paidAmountCents ? { paidAmountCents: record.paidAmountCents } : {}),
    ...(record.paidAt ? { paidAt: record.paidAt } : {}),
    ...(record.participantName ? { participantName: record.participantName } : {}),
    ...(record.choirName ? { choirName: record.choirName } : {}),
  };
}

const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url,name,choir_name,paid_amount_cents,paid_at" as const;
const identityColumns = "id" as const;

function mapPaymentRow(row: {
  id: string;
  order_nsu: string | null;
  amount_cents: number | null;
  payment_status: string;
  infinitepay_transaction_nsu: string | null;
  payment_method: string | null;
  installments: number | null;
  receipt_url: string | null;
  name?: string | null;
  choir_name?: string | null;
  paid_amount_cents?: number | null;
  paid_at?: string | null;
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
    participantName: row.name ?? null,
    choirName: row.choir_name ?? null,
    paidAmountCents: row.paid_amount_cents ?? null,
    paidAt: row.paid_at ?? null,
  };
}

export type SupabaseRegistrationRepository = RegistrationRepository & {
  findByCpf: (cpf: string) => Promise<RegistrationIdentityRecord | null>;
};

export function createSupabaseRegistrationRepository(): SupabaseRegistrationRepository {
  const findByCpf = async (cpf: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(identityColumns)
      .eq("cpf", cpf)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar a inscrição.");
    if (!data) return null;
    if (typeof data.id !== "string") throw new Error("Registro de inscrição inválido.");
    return { id: data.id };
  };

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
    findByCpf,
    createPending: async (input) => {
      const { error } = await supabaseAdmin.from("registrations").insert({
        name: input.name,
        cpf: input.cpf,
        photo_path: input.photoPath,
        voice_part: input.voicePart,
        phone: input.phone,
        birth_date: input.birthDate,
        choir_id: input.choirId,
        choir_name: input.choirName,
        diocese: input.choirName,
        email: input.email,
        city: null,
        institution: null,
        role: null,
        observations: null,
        include_shirt: false,
        shirt_size: null,
        pricing_type: input.pricingType,
        standard_price_cents: input.standardPriceCents,
        registration_price_cents: input.registrationPriceCents,
        shirt_price_cents: null,
        amount_cents: input.amountCents,
        payment_status: "pending",
        order_nsu: input.orderNsu,
      });

      if (error?.code === "23505" && error.message.includes("registrations_cpf_uidx")) {
        throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);
      }
      if (error) {
        console.error("[Registration] insert failed", {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        throw new Error("Não foi possível salvar a inscrição.");
      }
    },

    saveCheckoutUrl: async (orderNsu, checkoutUrl) => {
      const { error } = await supabaseAdmin
        .from("registrations")
        .update({ checkout_url: checkoutUrl })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending");

      if (error) throw new Error("Não foi possível salvar o checkout.");
    },

    clearPendingPhoto: async (orderNsu) => {
      const { error } = await supabaseAdmin
        .from("registrations")
        .update({ photo_path: null })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending");

      if (error) throw new Error("Não foi possível limpar a foto da inscrição.");
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

const photoExtensions: Record<RegistrationPhotoInput["contentType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function createSupabaseRegistrationPhotoStorage(): RegistrationPhotoStorage {
  return {
    upload: async (orderNsu, photo) => {
      const photoPath = `${orderNsu}/participant.${photoExtensions[photo.contentType]}`;
      const bytes = Buffer.from(photo.dataBase64, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_REGISTRATION_PHOTO_BYTES) {
        throw new Error("A foto deve ter até 5 MB.");
      }
      const { data, error } = await supabaseAdmin.storage
        .from(REGISTRATION_PHOTO_BUCKET)
        .upload(photoPath, bytes, {
          contentType: photo.contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw new Error("Não foi possível salvar a foto do participante.");
      return data.path;
    },

    remove: async (photoPath) => {
      const { error } = await supabaseAdmin.storage
        .from(REGISTRATION_PHOTO_BUCKET)
        .remove([photoPath]);
      if (error) throw new Error("Não foi possível remover a foto do participante.");
    },
  };
}

let paymentService: ReturnType<typeof createRegistrationPaymentService> | undefined;

export const DEFAULT_INFINITEPAY_HANDLE = "lucas-soares-xwv";
export const DEFAULT_INFINITEPAY_SITE_URL = "https://encontrocorosce.lovable.app";

export function getRegistrationPaymentService() {
  if (!paymentService) {
    paymentService = createRegistrationPaymentService({
      repository: createSupabaseRegistrationRepository(),
      infinitePay: createInfinitePayClient(fetch, {
        handle: process.env.INFINITEPAY_HANDLE?.trim() || DEFAULT_INFINITEPAY_HANDLE,
        siteUrl: process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_INFINITEPAY_SITE_URL,
      }),
      photoStorage: createSupabaseRegistrationPhotoStorage(),
      randomUUID: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
      resolveChoirSelection: (choirId) => getChoirPricingService().resolveActiveChoir(choirId),
      provisionParticipant: async (registrationId) => {
        const { getParticipantProvisioningService } =
          await import("@/features/participant/participant-provisioning.server");
        return getParticipantProvisioningService().provision(registrationId);
      },
    });
  }

  return paymentService;
}
