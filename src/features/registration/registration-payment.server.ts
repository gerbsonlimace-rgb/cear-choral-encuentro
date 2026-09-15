import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getChoirPricingService,
  type ResolvedChoirSelection,
} from "@/features/choirs/choir-pricing.server";
import type { ParticipantAccessStatus } from "@/features/participant/participant.domain";
import type { ParticipantInitialCredentials } from "@/features/participant/participant-provisioning.server";
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
const REGISTRATION_CPF_CONFLICT_MESSAGE = "Já existe uma inscrição para este CPF.";

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
      participantPortalUrl?: string;
      participantInitialPassword?: string;
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
  paymentStatus: "pending" | "paid" | "legacy";
  birthDate: string;
  orderNsu: string | null;
  checkoutUrl: string | null;
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
  updatePending(
    input: Omit<RegistrationInput, "photo" | "displayedQuote"> & {
      registrationId: string;
      orderNsu: string;
      amountCents: number;
      choirName: string;
      photoPath: string;
      pricingType: "standard" | "promotional";
      standardPriceCents: number;
      registrationPriceCents: number;
      expectedOrderNsu: string;
    },
  ): Promise<void>;
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
  getParticipantCredentials?: (
    registrationId: string,
  ) => Promise<ParticipantInitialCredentials | null>;
}) {
  const toPaidPublicStatus = async (
    registration: RegistrationPaymentRecord,
  ): Promise<PublicPaymentStatus> => {
    let participantAccessStatus: ParticipantAccessStatus = "pending";
    let participantCredentials: ParticipantInitialCredentials | null = null;
    try {
      participantAccessStatus = (await deps.provisionParticipant(registration.id)).status;
      if (participantAccessStatus === "active" && deps.getParticipantCredentials) {
        participantCredentials = await deps.getParticipantCredentials(registration.id);
      }
    } catch {
      // Payment truth is durable and must remain independent from delayed access preparation.
    }
    return toPublicPaymentStatus(registration, participantAccessStatus, participantCredentials);
  };

  return {
    startCheckout: async (input: RegistrationInput) => {
      const existing = await deps.repository.findByCpf?.(input.cpf);
      if (
        existing &&
        (existing.paymentStatus !== "pending" || existing.birthDate !== input.birthDate)
      ) {
        throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);
      }
      if (existing?.paymentStatus === "pending" && existing.checkoutUrl && existing.orderNsu) {
        return { checkoutUrl: existing.checkoutUrl, orderNsu: existing.orderNsu };
      }

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

      const pendingInput = {
        ...registrationData,
        orderNsu,
        amountCents,
        choirName: selection.choir.name,
        photoPath,
        pricingType: selection.quote.pricingType,
        standardPriceCents: selection.quote.standardPriceCents,
        registrationPriceCents: selection.quote.registrationPriceCents,
      };

      try {
        if (existing?.paymentStatus === "pending") {
          if (!existing.orderNsu) throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);
          try {
            await deps.repository.updatePending({
              registrationId: existing.id,
              expectedOrderNsu: existing.orderNsu,
              ...pendingInput,
            });
          } catch (caught) {
            const latest = await deps.repository.findByCpf?.(input.cpf);
            if (
              latest?.paymentStatus === "pending" &&
              latest.birthDate === input.birthDate &&
              latest.checkoutUrl &&
              latest.orderNsu
            ) {
              await deps.photoStorage.remove(photoPath).catch(() => undefined);
              return { checkoutUrl: latest.checkoutUrl, orderNsu: latest.orderNsu };
            }
            throw caught;
          }
        } else {
          await deps.repository.createPending(pendingInput);
        }
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
  participantCredentials: ParticipantInitialCredentials | null = null,
): PublicPaymentStatus {
  if (record.paymentStatus !== "paid" || !record.paymentMethod || !record.installments) {
    return { status: "pending" };
  }

  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    participantAccessStatus,
    ...(participantAccessStatus === "active" && participantCredentials
      ? {
          participantPortalUrl: participantCredentials.portalUrl,
          participantInitialPassword: participantCredentials.initialPassword,
        }
      : {}),
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
    ...(record.paidAmountCents ? { paidAmountCents: record.paidAmountCents } : {}),
    ...(record.paidAt ? { paidAt: record.paidAt } : {}),
    ...(record.participantName ? { participantName: record.participantName } : {}),
    ...(record.choirName ? { choirName: record.choirName } : {}),
  };
}

const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url,name,choir_name,paid_amount_cents,paid_at" as const;
const identityColumns = "id,payment_status,birth_date,order_nsu,checkout_url" as const;

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
    if (
      typeof data.id !== "string" ||
      (data.payment_status !== "legacy" &&
        data.payment_status !== "pending" &&
        data.payment_status !== "paid") ||
      typeof data.birth_date !== "string"
    ) {
      throw new Error("Registro de inscrição inválido.");
    }
    const paymentStatus: RegistrationIdentityRecord["paymentStatus"] = data.payment_status;
    return {
      id: data.id,
      paymentStatus,
      birthDate: data.birth_date,
      orderNsu: typeof data.order_nsu === "string" ? data.order_nsu : null,
      checkoutUrl: typeof data.checkout_url === "string" ? data.checkout_url : null,
    };
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

    updatePending: async (input) => {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
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
          pricing_type: input.pricingType,
          standard_price_cents: input.standardPriceCents,
          registration_price_cents: input.registrationPriceCents,
          amount_cents: input.amountCents,
          payment_status: "pending",
          order_nsu: input.orderNsu,
          checkout_url: null,
        })
        .eq("id", input.registrationId)
        .eq("payment_status", "pending")
        .eq("order_nsu", input.expectedOrderNsu)
        .select("id")
        .maybeSingle();

      if (error) throw new Error("Não foi possível atualizar a inscrição.");
      if (!data) throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);
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
      getParticipantCredentials: async (registrationId) => {
        const { getParticipantProvisioningService } =
          await import("@/features/participant/participant-provisioning.server");
        return getParticipantProvisioningService().getInitialCredentials(registrationId);
      },
    });
  }

  return paymentService;
}
