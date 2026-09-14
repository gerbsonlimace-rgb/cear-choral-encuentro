import { getRequest } from "@tanstack/react-start/server";

import {
  buildParticipantRegistrationView,
  participantAccessStatusSchema,
  type ParticipantAccessStatus,
  type ParticipantRegistrationView,
} from "@/features/participant/participant.domain";
import { voicePartSchema } from "@/features/registration/registration.domain";
import { deriveRegistrationFinancialState } from "@/features/registration/registration-financial-state.domain";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const registrationPhotoBucket = "registration-photos";
const participantRegistrationColumns =
  "id,amount_cents,birth_date,choir_id,choir_name,city,cpf,diocese,email,installments,institution,name,order_nsu,paid_amount_cents,paid_at,payment_method,payment_status,phone,photo_path,pricing_type,receipt_url,registration_price_cents,role,standard_price_cents,voice_part" as const;

type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];
type ParticipantRegistrationSource = Pick<
  RegistrationRow,
  | "id"
  | "amount_cents"
  | "birth_date"
  | "choir_name"
  | "choir_id"
  | "city"
  | "cpf"
  | "diocese"
  | "email"
  | "installments"
  | "institution"
  | "name"
  | "order_nsu"
  | "paid_amount_cents"
  | "paid_at"
  | "payment_method"
  | "payment_status"
  | "phone"
  | "photo_path"
  | "pricing_type"
  | "receipt_url"
  | "registration_price_cents"
  | "role"
  | "standard_price_cents"
  | "voice_part"
>;

export type ParticipantAccess =
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "authorized"; accountId: string; registrationId: string; userId: string };

export type ParticipantAccessRecord = {
  accountId: string;
  registrationId: string;
  userId: string;
  accessStatus: ParticipantAccessStatus;
  paymentStatus: string;
};

export type ParticipantAccessRepository = {
  findAccessByUserId(userId: string): Promise<ParticipantAccessRecord | null>;
  loadPaidRegistration(registrationId: string): Promise<ParticipantRegistrationSource | null>;
  createPhotoUrl(photoPath: string): Promise<string | null>;
  loadActiveRegentNames(choirId: string | null): Promise<string[]>;
  loadConfirmedComplementCents(registrationId: string): Promise<number>;
};

type ParticipantAuthorizer = {
  findAccess(userId: string): Promise<ParticipantAccess>;
  requireActive(userId: string): Promise<Extract<ParticipantAccess, { status: "authorized" }>>;
};

export function createParticipantAuthorizer(repository: ParticipantAccessRepository) {
  async function findAccess(userId: string): Promise<ParticipantAccess> {
    const record = await repository.findAccessByUserId(userId);
    if (
      !record ||
      record.userId !== userId ||
      record.accessStatus !== "active" ||
      record.paymentStatus !== "paid"
    ) {
      return { status: "unavailable" };
    }

    return {
      status: "authorized",
      accountId: record.accountId,
      registrationId: record.registrationId,
      userId: record.userId,
    };
  }

  return {
    findAccess,
    async requireActive(userId: string) {
      const access = await findAccess(userId);
      if (access.status !== "authorized") throw new Error("Acesso não autorizado.");
      return access;
    },
  };
}

function requirePricingType(value: string): "standard" | "promotional" {
  if (value === "standard" || value === "promotional") return value;
  throw new Error("Invalid participant pricing type");
}

function requirePaymentMethod(value: string): "pix" | "credit_card" {
  if (value === "pix" || value === "credit_card") return value;
  throw new Error("Invalid participant payment method");
}

export function createParticipantRegistrationLoader(repository: ParticipantAccessRepository) {
  return {
    async load(
      access: Extract<ParticipantAccess, { status: "authorized" }>,
    ): Promise<ParticipantRegistrationView> {
      const row = await repository.loadPaidRegistration(access.registrationId);
      if (!row || row.id !== access.registrationId || row.payment_status !== "paid" || !row.cpf) {
        throw new Error("Não foi possível carregar os dados da inscrição.");
      }

      const [regentsResult, complementResult] = await Promise.allSettled([
        repository.loadActiveRegentNames(row.choir_id),
        repository.loadConfirmedComplementCents(row.id),
      ]);
      const regentNames = regentsResult.status === "fulfilled" ? regentsResult.value : [];
      const financialState =
        complementResult.status === "fulfilled"
          ? deriveRegistrationFinancialState({
              paymentStatus: "paid",
              initialAmountCents: row.amount_cents,
              pricingType:
                row.pricing_type === "standard" || row.pricing_type === "promotional"
                  ? row.pricing_type
                  : null,
              standardPriceCents: row.standard_price_cents,
              registrationPriceCents: row.registration_price_cents,
              confirmedComplementCents: complementResult.value,
            })
          : null;

      let photoUrl: string | null | undefined;
      if (row.photo_path) {
        try {
          photoUrl = await repository.createPhotoUrl(row.photo_path);
        } catch {
          photoUrl = null;
        }
      }

      try {
        return buildParticipantRegistrationView({
          identity: {
            name: row.name,
            cpf: row.cpf,
            birthDate: row.birth_date,
            ...(row.email === null ? {} : { email: row.email }),
            phone: row.phone,
            ...(photoUrl === undefined ? {} : { photoUrl }),
          },
          registration: {
            choirName: row.choir_name,
            regentNames,
            diocese: row.diocese,
            ...(row.city === null ? {} : { city: row.city }),
            ...(row.institution === null ? {} : { institution: row.institution }),
            ...(row.role === null ? {} : { role: row.role }),
            ...(row.voice_part === null
              ? {}
              : { voicePart: voicePartSchema.parse(row.voice_part) }),

            ...(row.pricing_type === null
              ? {}
              : { pricingType: requirePricingType(row.pricing_type) }),
            ...(row.standard_price_cents === null
              ? {}
              : { standardPriceCents: row.standard_price_cents }),
            ...(row.registration_price_cents === null
              ? {}
              : { registrationPriceCents: row.registration_price_cents }),
          },
          payment: {
            status: "paid",
            financialState,
            ...(row.amount_cents === null ? {} : { amountCents: row.amount_cents }),
            ...(row.paid_amount_cents === null ? {} : { paidAmountCents: row.paid_amount_cents }),
            ...(row.payment_method === null
              ? {}
              : { paymentMethod: requirePaymentMethod(row.payment_method) }),
            ...(row.installments === null ? {} : { installments: row.installments }),
            ...(row.paid_at === null ? {} : { paidAt: row.paid_at }),
            ...(row.order_nsu === null ? {} : { orderNsu: row.order_nsu }),
            ...(row.receipt_url === null ? {} : { receiptUrl: row.receipt_url }),
          },
        });
      } catch {
        throw new Error("Não foi possível carregar os dados da inscrição.");
      }
    },
  };
}

function checkParticipantQuery(error: { message?: string } | null) {
  if (error) throw new Error("Não foi possível validar o acesso do participante.");
}

export function createSupabaseParticipantRepository(): ParticipantAccessRepository {
  return {
    async findAccessByUserId(userId) {
      const { data: account, error: accountError } = await supabaseAdmin
        .from("participant_accounts")
        .select("id,registration_id,user_id,access_status")
        .eq("user_id", userId)
        .eq("access_status", "active")
        .maybeSingle();
      checkParticipantQuery(accountError);
      if (!account?.user_id) return null;

      const { data: registration, error: registrationError } = await supabaseAdmin
        .from("registrations")
        .select("id,payment_status")
        .eq("id", account.registration_id)
        .eq("payment_status", "paid")
        .maybeSingle();
      checkParticipantQuery(registrationError);
      if (!registration) return null;

      return {
        accountId: account.id,
        registrationId: account.registration_id,
        userId: account.user_id,
        accessStatus: participantAccessStatusSchema.parse(account.access_status),
        paymentStatus: registration.payment_status,
      };
    },

    async loadPaidRegistration(registrationId) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .select(participantRegistrationColumns)
        .eq("id", registrationId)
        .eq("payment_status", "paid")
        .maybeSingle();
      checkParticipantQuery(error);
      return data;
    },

    async loadActiveRegentNames(choirId) {
      if (!choirId) return [];
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select("name")
        .eq("choir_id", choirId)
        .is("revoked_at", null)
        .order("name");
      checkParticipantQuery(error);
      return [...new Set((data ?? []).map((row) => row.name.trim()).filter(Boolean))];
    },

    async loadConfirmedComplementCents(registrationId) {
      let total = 0;
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabaseAdmin
          .from("registration_complement_payments")
          .select("amount_cents")
          .eq("registration_id", registrationId)
          .eq("status", "paid")
          .order("id")
          .range(offset, offset + pageSize - 1);
        checkParticipantQuery(error);
        for (const row of data ?? []) {
          if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents < 0) {
            throw new Error("Não foi possível consultar o saldo.");
          }
          total += row.amount_cents;
        }
        if ((data ?? []).length < pageSize) return total;
      }
    },

    async createPhotoUrl(photoPath) {
      const { data, error } = await supabaseAdmin.storage
        .from(registrationPhotoBucket)
        .createSignedUrl(photoPath, 60);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
  };
}

let participantRepository: ParticipantAccessRepository | undefined;
let participantAuthorizer: ReturnType<typeof createParticipantAuthorizer> | undefined;
let participantRegistrationLoader:
  | ReturnType<typeof createParticipantRegistrationLoader>
  | undefined;

function getParticipantRepository() {
  if (!participantRepository) participantRepository = createSupabaseParticipantRepository();
  return participantRepository;
}

export function getParticipantAuthorizer() {
  if (!participantAuthorizer) {
    participantAuthorizer = createParticipantAuthorizer(getParticipantRepository());
  }
  return participantAuthorizer;
}

export function getParticipantRegistrationLoader() {
  if (!participantRegistrationLoader) {
    participantRegistrationLoader = createParticipantRegistrationLoader(getParticipantRepository());
  }
  return participantRegistrationLoader;
}

export async function findParticipantAccessForAuthorization(
  authorization: string | null | undefined,
  authorizer: Pick<ParticipantAuthorizer, "findAccess"> = getParticipantAuthorizer(),
): Promise<ParticipantAccess> {
  const token = authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return { status: "unauthenticated" };

  let authResult: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
  try {
    authResult = await supabaseAdmin.auth.getUser(token);
  } catch {
    return { status: "unauthenticated" };
  }
  if (authResult.error || !authResult.data.user?.id) return { status: "unauthenticated" };

  try {
    return await authorizer.findAccess(authResult.data.user.id);
  } catch {
    return { status: "unavailable" };
  }
}

export function getParticipantRequestAccess(): Promise<ParticipantAccess> {
  return findParticipantAccessForAuthorization(getRequest().headers.get("authorization"));
}
