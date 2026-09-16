import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getChoirPricingService,
  type ResolvedChoirSelection,
} from "@/features/choirs/choir-pricing.server";
import { applyRaffleChoice } from "@/features/choirs/choir-pricing.domain";
import type { DisplayedQuote } from "@/features/choirs/choir-pricing.domain";
import type { ParticipantAccessStatus } from "@/features/participant/participant.domain";
import type { ParticipantInitialCredentials } from "@/features/participant/participant-provisioning.server";
import {
  createInfinitePayClient,
  isSafeInfinitePayCheckoutUrl,
  sanitizeInfinitePayReceiptUrl,
  type InfinitePayClient,
} from "./infinitepay.server";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  dioceseSchema,
  MAX_REGISTRATION_PHOTO_BYTES,
  musicalProfileSchema,
  type PaymentLookup,
  type RegistrationInput,
  type RegistrationLookupResult,
  type RegistrationPhotoInput,
  type RegistrationResumeInput,
  voicePartSchema,
} from "./registration.domain";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
// Keep the invitation out of public client bundles and unverified status lookups.
const REGISTRATION_WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/DMasqDLthuP1HmhJzHxqxw";
const REGISTRATION_CPF_CONFLICT_MESSAGE = "Já existe uma inscrição para este CPF.";
const CHECKOUT_CLAIM_PREFIX = "https://pending.invalid/creating/";
const CHECKOUT_CLAIM_TTL_MS = 2 * 60 * 1000;

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
  participantEmail?: string | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  remainingPriceCents?: number | null;
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
      whatsappGroupUrl?: string;
      receiptUrl?: string;
      orderNsu?: string;
      amountCents?: number;
      paidAmountCents?: number;
      paidAt?: string;
      participantName?: string;
      participantEmail?: string;
      choirName?: string;
      pricingType: "standard" | "promotional";
      standardPriceCents: number;
      registrationPriceCents: number;
      remainingPriceCents?: number;
    };

export type RegistrationIdentityRecord = {
  id: string;
  paymentStatus: "pending" | "paid" | "legacy";
  birthDate: string;
  orderNsu: string | null;
  checkoutUrl: string | null;
};

export type RegistrationResumeRecord = {
  birthDate: string;
  paymentStatus: "pending" | "paid" | "legacy";
  checkoutUrl: string | null;
};

export type RegistrationResumeResult =
  | { status: "pending"; checkoutUrl: string }
  | { status: "paid" };

export type RegistrationCheckoutLinkRecord = {
  id: string;
  orderNsu: string;
  amountCents: number;
  paymentStatus: "pending" | "paid" | "legacy";
  checkoutUrl: string | null;
  name: string;
  email: string;
  phone: string;
};

export type RegistrationRepository = {
  findByCpf?: (cpf: string) => Promise<RegistrationIdentityRecord | null>;
  findByEmail?: (email: string) => Promise<{ id: string } | null>;
  findRegistrationByIdentity?: (
    cpf: string,
    birthDate: string,
  ) => Promise<RegistrationLookupResult | null>;
  findForResume?: (cpf: string) => Promise<RegistrationResumeRecord | null>;
  findForCheckoutLink?: (registrationId: string) => Promise<RegistrationCheckoutLinkRecord | null>;
  createPending(
    input: Omit<RegistrationInput, "photo" | "raffleChoice" | "displayedQuote"> & {
      orderNsu: string;
      amountCents: number;
      choirName: string;
      photoPath: string;
      pricingType: "standard" | "promotional";
      standardPriceCents: number;
      registrationPriceCents: number;
      remainingPriceCents?: number;
      checkoutClaim?: string;
    },
  ): Promise<void>;
  saveCheckoutUrl(orderNsu: string, checkoutUrl: string, checkoutClaim?: string): Promise<boolean>;
  updatePending(
    input: Omit<RegistrationInput, "photo" | "raffleChoice" | "displayedQuote"> & {
      registrationId: string;
      orderNsu: string;
      amountCents: number;
      choirName: string;
      photoPath: string;
      pricingType: "standard" | "promotional";
      standardPriceCents: number;
      registrationPriceCents: number;
      remainingPriceCents?: number;
      expectedOrderNsu: string;
      checkoutClaim?: string;
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
  resolveStandardRegistrationQuote: () => Promise<DisplayedQuote>;
  provisionParticipant: (registrationId: string) => Promise<{ status: ParticipantAccessStatus }>;
  findAuthUserByEmail?: (email: string) => Promise<{ id: string } | null>;
  getParticipantPortalAccessLink?: (registrationId: string) => Promise<string | null>;
  getParticipantCredentials?: (
    registrationId: string,
  ) => Promise<ParticipantInitialCredentials | null>;
}) {
  const toPaidPublicStatus = async (
    registration: RegistrationPaymentRecord,
    includeCredentials = true,
  ): Promise<PublicPaymentStatus> => {
    let participantAccessStatus: ParticipantAccessStatus = "pending";
    let participantCredentials: ParticipantInitialCredentials | null = null;
    try {
      participantAccessStatus = (await deps.provisionParticipant(registration.id)).status;
      if (includeCredentials && participantAccessStatus === "active" && deps.getParticipantCredentials) {
        participantCredentials = await deps.getParticipantCredentials(registration.id);
      }
      } catch {
      // Payment truth is durable and must remain independent from delayed access preparation.
    }
    const payment = toPublicPaymentStatus(
      registration,
      participantAccessStatus,
      participantCredentials,
    );
    return payment.status === "paid"
      ? { ...payment, whatsappGroupUrl: REGISTRATION_WHATSAPP_GROUP_URL }
      : payment;
  };

  const reconcilePayment = async (lookup: PaymentLookup): Promise<PublicPaymentStatus> => {
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
  };

  return {
    lookupRegistration: async (input: {
      cpf: string;
      birthDate: string;
    }): Promise<RegistrationLookupResult> => {
      const result = await deps.repository.findRegistrationByIdentity?.(input.cpf, input.birthDate);
      return result ?? { status: "not_found" };
    },
    startCheckout: async (input: RegistrationInput) => {
      const existing = await deps.repository.findByCpf?.(input.cpf);
      const canResumeExisting =
        existing?.paymentStatus === "pending" && existing.birthDate === input.birthDate;
      if (
        existing &&
        (existing.paymentStatus !== "pending" || existing.birthDate !== input.birthDate)
      ) {
        throw new Error(REGISTRATION_CPF_CONFLICT_MESSAGE);
      }
      if (!canResumeExisting && deps.findAuthUserByEmail) {
        const authUser = await deps.findAuthUserByEmail(input.email.trim().toLowerCase());
        if (authUser) throw new Error("Já existe um acesso com este e-mail.");
      }
      if (existing?.paymentStatus === "pending" && existing.checkoutUrl && existing.orderNsu) {
        if (!isCheckoutClaim(existing.checkoutUrl)) {
          return { checkoutUrl: existing.checkoutUrl, orderNsu: existing.orderNsu };
        }
        if (!isCheckoutClaimStale(existing.checkoutUrl, deps.now())) {
          const ready = await waitForCheckoutUrl(deps.repository, input.cpf, deps.now);
          if (ready) return ready;
          throw new Error("O checkout já está sendo preparado. Tente novamente em instantes.");
        }
      }

      const selection = input.choirId ? await deps.resolveChoirSelection(input.choirId) : null;
      const trustedQuote = selection
        ? selection.quote
        : await deps.resolveStandardRegistrationQuote();
      const appliedQuote = applyRaffleChoice(trustedQuote, input.raffleChoice);
      const quoteChanged =
        input.displayedQuote.pricingType !== appliedQuote.pricingType ||
        input.displayedQuote.standardPriceCents !== appliedQuote.standardPriceCents ||
        input.displayedQuote.registrationPriceCents !== appliedQuote.registrationPriceCents ||
        (input.displayedQuote.remainingPriceCents ?? null) !==
          (trustedQuote.remainingPriceCents ?? null);
      if (quoteChanged) {
        throw new Error("A configuração de preços mudou. Confira o valor e tente novamente.");
      }

      const orderNsu = deps.randomUUID();
      const checkoutClaim = createCheckoutClaim(orderNsu, deps.now());
      const amountCents = calculateOrderAmountCents(input, appliedQuote);
      const photoPath = await deps.photoStorage.upload(orderNsu, input.photo);
      const {
        photo: _photo,
        raffleChoice: _raffleChoice,
        displayedQuote: _displayedQuote,
        ...registrationData
      } = input;

      const pendingInput = {
        ...registrationData,
        orderNsu,
        amountCents,
        choirName: selection?.choir.name ?? input.otherChoirName!,
        photoPath,
        pricingType: appliedQuote.pricingType,
        standardPriceCents: trustedQuote.standardPriceCents,
        registrationPriceCents: appliedQuote.registrationPriceCents,
        ...(trustedQuote.remainingPriceCents !== undefined
          ? { remainingPriceCents: trustedQuote.remainingPriceCents }
          : {}),
        checkoutClaim,
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
              if (isCheckoutClaim(latest.checkoutUrl)) {
                const ready = await waitForCheckoutUrl(deps.repository, input.cpf, deps.now);
                if (!ready) {
                  throw new Error(
                    "O checkout já está sendo preparado. Tente novamente em instantes.",
                  );
                }
                await deps.photoStorage.remove(photoPath).catch(() => undefined);
                return ready;
              }
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
          items: buildCheckoutItems(input, appliedQuote),
          customer: { name: input.name, email: input.email, phoneNumber: input.phone },
        });
        const saved = await deps.repository.saveCheckoutUrl(orderNsu, checkout.url, checkoutClaim);
        if (!saved) {
          throw new Error("A inscrição foi confirmada antes de salvar o checkout.");
        }
      } catch (caught) {
        await Promise.allSettled([
          deps.repository.clearPendingPhoto(orderNsu),
          deps.photoStorage.remove(photoPath),
        ]);
        throw caught;
      }

      return { checkoutUrl: checkout.url, orderNsu };
    },

    resumeCheckout: async (input: RegistrationResumeInput): Promise<RegistrationResumeResult> => {
      const registration = await deps.repository.findForResume?.(input.cpf);
      if (!registration || registration.birthDate !== input.birthDate) {
        throw new Error("Não foi possível localizar uma inscrição com os dados informados.");
      }

      if (registration.paymentStatus === "paid") return { status: "paid" };
      if (registration.paymentStatus === "pending" && registration.checkoutUrl) {
        return { status: "pending", checkoutUrl: registration.checkoutUrl };
      }

      throw new Error("Procure a organização para continuar o pagamento.");
    },

    createCheckoutLink: async (registrationId: string) => {
      const registration = await deps.repository.findForCheckoutLink?.(registrationId);
      if (!registration) throw new Error("Inscrição não encontrada.");
      if (registration.paymentStatus !== "pending") {
        throw new Error("A inscrição não está pendente.");
      }
      if (registration.checkoutUrl && isSafeInfinitePayCheckoutUrl(registration.checkoutUrl)) {
        return { checkoutUrl: registration.checkoutUrl, reused: true as const };
      }
      if (
        !registration.orderNsu ||
        !Number.isSafeInteger(registration.amountCents) ||
        registration.amountCents <= 0
      ) {
        throw new Error("Não foi possível preparar o pagamento desta inscrição.");
      }

      const checkout = await deps.infinitePay.createCheckout({
        orderNsu: registration.orderNsu,
        items: [
          {
            quantity: 1,
            price: registration.amountCents,
            description: "Inscrição — II Encontro de Coros",
          },
        ],
        customer: {
          name: registration.name,
          email: registration.email,
          phoneNumber: registration.phone,
        },
      });
      const saved = await deps.repository.saveCheckoutUrl(registration.orderNsu, checkout.url);
      if (saved) return { checkoutUrl: checkout.url, reused: false as const };

      // A manual confirmation may have won the race while InfinitePay was
      // creating the checkout. Never return a link unless it is still tied to
      // a pending registration.
      const current = await deps.repository.findForCheckoutLink?.(registrationId);
      if (current?.paymentStatus === "pending" && current.checkoutUrl) {
        if (isSafeInfinitePayCheckoutUrl(current.checkoutUrl)) {
          return { checkoutUrl: current.checkoutUrl, reused: true as const };
        }
      }
      throw new Error("A inscrição foi confirmada antes de salvar o checkout.");
    },

    reconcilePayment,

    createParticipantPortalAccessLink: async (lookup: PaymentLookup) => {
      const payment = await reconcilePayment(lookup);
      if (payment.status !== "paid") {
        return { ok: false as const, message: "O pagamento ainda está sendo confirmado." };
      }
      const registration = await deps.repository.findPayment(lookup.orderNsu);
      const actionLink = registration && deps.getParticipantPortalAccessLink
        ? await deps.getParticipantPortalAccessLink(registration.id)
        : null;
      return actionLink
        ? { ok: true as const, actionLink }
        : { ok: false as const, message: "Seu acesso ainda está sendo preparado. Tente novamente." };
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
  if (
    record.paymentStatus !== "paid" ||
    !record.paymentMethod ||
    !record.installments ||
    !record.pricingType ||
    typeof record.standardPriceCents !== "number" ||
    typeof record.registrationPriceCents !== "number" ||
    !Number.isSafeInteger(record.standardPriceCents) ||
    !Number.isSafeInteger(record.registrationPriceCents)
  ) {
    return { status: "pending" };
  }

  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    participantAccessStatus,
    pricingType: record.pricingType,
    standardPriceCents: record.standardPriceCents,
    registrationPriceCents: record.registrationPriceCents,
    ...(typeof record.remainingPriceCents === "number"
      ? { remainingPriceCents: record.remainingPriceCents }
      : {}),
    ...(participantCredentials
      ? {
          participantPortalUrl: participantCredentials.portalUrl,
          participantInitialPassword: participantCredentials.initialPassword,
        }
      : {}),
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
    ...(record.paidAmountCents ? { paidAmountCents: record.paidAmountCents } : {}),
    ...(record.paidAt ? { paidAt: record.paidAt } : {}),
    ...(record.participantName ? { participantName: record.participantName } : {}),
    ...(record.participantEmail ? { participantEmail: record.participantEmail } : {}),
    ...(record.choirName ? { choirName: record.choirName } : {}),
  };
}

function createCheckoutClaim(orderNsu: string, now: string) {
  return `${CHECKOUT_CLAIM_PREFIX}${orderNsu}/${Date.parse(now) || Date.now()}`;
}

function isCheckoutClaim(value: string) {
  return value.startsWith(CHECKOUT_CLAIM_PREFIX);
}

function isCheckoutClaimStale(value: string, now: string) {
  const timestamp = Number(value.slice(CHECKOUT_CLAIM_PREFIX.length).split("/").at(-1));
  return !Number.isFinite(timestamp) || Date.parse(now) - timestamp > CHECKOUT_CLAIM_TTL_MS;
}

async function waitForCheckoutUrl(
  repository: RegistrationRepository,
  cpf: string,
  now: () => string,
): Promise<{ checkoutUrl: string; orderNsu: string } | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const latest = await repository.findByCpf?.(cpf);
    if (
      latest?.paymentStatus === "pending" &&
      latest.orderNsu &&
      latest.checkoutUrl &&
      !isCheckoutClaim(latest.checkoutUrl)
    ) {
      return { checkoutUrl: latest.checkoutUrl, orderNsu: latest.orderNsu };
    }
    if (latest?.checkoutUrl && isCheckoutClaimStale(latest.checkoutUrl, now())) return null;
  }
  return null;
}

const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url,name,email,choir_name,paid_amount_cents,paid_at,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents" as const;
const identityColumns = "id,payment_status,birth_date,order_nsu,checkout_url" as const;
const resumeIdentityColumns = "birth_date,payment_status,checkout_url" as const;
const checkoutLinkColumns =
  "id,order_nsu,amount_cents,payment_status,checkout_url,name,email,phone" as const;

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
  email?: string | null;
  choir_name?: string | null;
  paid_amount_cents?: number | null;
  paid_at?: string | null;
  pricing_type?: string | null;
  standard_price_cents?: number | null;
  registration_price_cents?: number | null;
  remaining_price_cents?: number | null;
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
    participantEmail: row.email ?? null,
    choirName: row.choir_name ?? null,
    paidAmountCents: row.paid_amount_cents ?? null,
    paidAt: row.paid_at ?? null,
    pricingType:
      row.pricing_type === "standard" || row.pricing_type === "promotional"
        ? row.pricing_type
        : null,
    standardPriceCents: row.standard_price_cents ?? null,
    registrationPriceCents: row.registration_price_cents ?? null,
    ...(typeof row.remaining_price_cents === "number"
      ? { remainingPriceCents: row.remaining_price_cents }
      : {}),
  };
}

export type SupabaseRegistrationRepository = RegistrationRepository & {
  findByCpf: (cpf: string) => Promise<RegistrationIdentityRecord | null>;
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  findForResume: (cpf: string) => Promise<RegistrationResumeRecord | null>;
  findForCheckoutLink: (registrationId: string) => Promise<RegistrationCheckoutLinkRecord | null>;
  findRegistrationByIdentity: (
    cpf: string,
    birthDate: string,
  ) => Promise<RegistrationLookupResult | null>;
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

  const findByEmail = async (email: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(identityColumns)
      .ilike("email", email)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar a inscrição.");
    if (!data) return null;
    if (typeof data.id !== "string") throw new Error("Registro de inscrição inválido.");
    return { id: data.id };
  };

  const findForResume = async (cpf: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(resumeIdentityColumns)
      .eq("cpf", cpf)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar a inscrição.");
    if (!data) return null;
    if (
      typeof data.birth_date !== "string" ||
      !["pending", "paid", "legacy"].includes(data.payment_status)
    ) {
      throw new Error("Registro de inscrição inválido.");
    }

    return {
      birthDate: data.birth_date,
      paymentStatus: data.payment_status as RegistrationResumeRecord["paymentStatus"],
      checkoutUrl: data.checkout_url,
    };
  };

  const findForCheckoutLink = async (registrationId: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(checkoutLinkColumns)
      .eq("id", registrationId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar a inscrição.");
    if (!data) return null;
    const amountCents = data.amount_cents;
    if (
      typeof data.id !== "string" ||
      typeof data.order_nsu !== "string" ||
      typeof amountCents !== "number" ||
      !Number.isSafeInteger(amountCents) ||
      !["pending", "paid", "legacy"].includes(data.payment_status) ||
      (data.checkout_url !== null && typeof data.checkout_url !== "string") ||
      typeof data.name !== "string" ||
      typeof data.email !== "string" ||
      typeof data.phone !== "string"
    ) {
      throw new Error("Registro de inscrição inválido.");
    }
    return {
      id: data.id,
      orderNsu: data.order_nsu,
      amountCents,
      paymentStatus: data.payment_status as RegistrationCheckoutLinkRecord["paymentStatus"],
      checkoutUrl: data.checkout_url,
      name: data.name,
      email: data.email,
      phone: data.phone,
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

  const findRegistrationByIdentity = async (cpf: string, birthDate: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(
        "name,badge_name,email,phone,birth_date,diocese,choir_id,other_choir_name,musical_profile,voice_part,photo_path,payment_status",
      )
      .eq("cpf", cpf)
      .eq("birth_date", birthDate)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar os dados salvos.");
    if (!data) return null;
    if (
      typeof data.name !== "string" ||
      typeof data.email !== "string" ||
      typeof data.phone !== "string" ||
      typeof data.birth_date !== "string" ||
      !["legacy", "pending", "paid"].includes(data.payment_status)
    ) {
      throw new Error("Registro de inscrição inválido.");
    }
    return {
      status: "found" as const,
      name: data.name,
      badgeName: typeof data.badge_name === "string" ? data.badge_name : null,
      email: data.email,
      phone: data.phone,
      ...(dioceseSchema.safeParse(data.diocese).success
        ? { diocese: dioceseSchema.parse(data.diocese) }
        : {}),
      choirId: typeof data.choir_id === "string" ? data.choir_id : null,
      otherChoirName:
        typeof data.other_choir_name === "string" ? data.other_choir_name : null,
      musicalProfile: musicalProfileSchema.safeParse(data.musical_profile).success
        ? musicalProfileSchema.parse(data.musical_profile)
        : null,
      voicePart: voicePartSchema.safeParse(data.voice_part).success
        ? voicePartSchema.parse(data.voice_part)
        : null,
      hasPhoto: typeof data.photo_path === "string" && data.photo_path.length > 0,
      paymentStatus: data.payment_status as "legacy" | "pending" | "paid",
    };
  };

  return {
    findByCpf,
    findByEmail,
    findForCheckoutLink,
    findForResume,
    findRegistrationByIdentity,
    createPending: async (input) => {
      const { error } = await supabaseAdmin.from("registrations").insert({
        name: input.name,
        badge_name: input.badgeName,
        cpf: input.cpf,
        photo_path: input.photoPath,
        musical_profile: input.musicalProfile,
        voice_part: input.voicePart,
        phone: input.phone,
        birth_date: input.birthDate,
        choir_id: input.choirId,
        choir_name: input.choirName,
        other_choir_name: input.otherChoirName,
        diocese: input.diocese,
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
        ...(input.remainingPriceCents !== undefined
          ? { remaining_price_cents: input.remainingPriceCents }
          : {}),
        shirt_price_cents: null,
        amount_cents: input.amountCents,
        payment_status: "pending",
        order_nsu: input.orderNsu,
        ...(input.checkoutClaim ? { checkout_url: input.checkoutClaim } : {}),
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

    saveCheckoutUrl: async (orderNsu, checkoutUrl, checkoutClaim) => {
      let query = supabaseAdmin
        .from("registrations")
        .update({ checkout_url: checkoutUrl })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending");
      if (checkoutClaim) query = query.eq("checkout_url", checkoutClaim);
      if (!checkoutClaim) query = query.is("checkout_url", null);
      const { data, error } = await query.select("id").maybeSingle();

      if (error) throw new Error("Não foi possível salvar o checkout.");
      return data !== null;
    },

    updatePending: async (input) => {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          name: input.name,
          badge_name: input.badgeName,
          cpf: input.cpf,
          photo_path: input.photoPath,
          musical_profile: input.musicalProfile,
          voice_part: input.voicePart,
          phone: input.phone,
          birth_date: input.birthDate,
          choir_id: input.choirId,
          choir_name: input.choirName,
          other_choir_name: input.otherChoirName,
          diocese: input.diocese,
          email: input.email,
          pricing_type: input.pricingType,
          standard_price_cents: input.standardPriceCents,
          registration_price_cents: input.registrationPriceCents,
          ...(input.remainingPriceCents !== undefined
            ? { remaining_price_cents: input.remainingPriceCents }
            : {}),
          amount_cents: input.amountCents,
          payment_status: "pending",
          order_nsu: input.orderNsu,
          checkout_url: input.checkoutClaim ?? null,
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
      resolveStandardRegistrationQuote: () =>
        getChoirPricingService().resolveStandardRegistrationQuote(),
      findAuthUserByEmail: async (email) => {
        const { createSupabaseParticipantAuthAdmin } =
          await import("@/features/participant/participant-provisioning.server");
        return createSupabaseParticipantAuthAdmin().findUserByEmail(email);
      },
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
      getParticipantPortalAccessLink: async (registrationId) => {
        const { getParticipantProvisioningService } =
          await import("@/features/participant/participant-provisioning.server");
        return getParticipantProvisioningService().getPortalAccessLink(registrationId);
      },
    });
  }

  return paymentService;
}
