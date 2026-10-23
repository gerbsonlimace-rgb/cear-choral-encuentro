import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildBrazilWhatsAppUrl,
  calculateComplementState,
  type ComplementPaymentRow,
  type ComplementPaymentStatus,
  type PortalParticipant,
  type PortalSummary,
} from "./regent-payments.domain";
import { deriveRegistrationFinancialState } from "../registration/registration-financial-state.domain";
import { getAdminRafflePending, getAdminRegistrationPendingCents } from "../admin/admin-raffle.domain";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
const PHOTO_URL_EXPIRY_SECONDS = 300;
const INTERNAL_BATCH_SIZE = 1_000;
const registrationColumns =
  "id,name,cpf,phone,voice_part,photo_path,payment_status,payment_origin,is_free_registration,amount_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents" as const;
const summaryRegistrationColumns =
  "id,payment_status,payment_origin,is_free_registration,amount_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents" as const;
const paymentColumns =
  "id,registration_id,amount_cents,status,checkout_url,created_at,paid_at,initiated_by_name,initiated_as" as const;
const summaryPaymentColumns = "registration_id,amount_cents" as const;
const PRIVATE_PHOTO_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/participant\.(jpg|png|webp)$/;

export type PortalParticipantQuery = {
  search: string;
  page: number;
  pageSize: number;
};

export type PortalRegistrationRow = {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  photoPath: string | null;
  voicePart?: string | null;
  paymentStatus: "legacy" | "pending" | "paid";
  isExempt?: boolean;
  isFreeRegistration?: boolean;
  initialAmountCents: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  remainingPriceCents?: number | null;
};

export type PortalSummaryRegistrationRow = Pick<
  PortalRegistrationRow,
  | "id"
  | "paymentStatus"
  | "isExempt"
  | "isFreeRegistration"
  | "pricingType"
  | "standardPriceCents"
  | "registrationPriceCents"
  | "remainingPriceCents"
  | "initialAmountCents"
>;

export type PortalComplementLedgerRow = ComplementPaymentRow & { registrationId: string };

export type PortalPaidComplementPrincipal = {
  registrationId: string;
  amountCents: number;
};

export type PortalParticipantPage = {
  rows: PortalParticipant[];
  total: number;
  page: number;
  pageSize: number;
};

export type RegentPortalRepository = {
  listParticipants(
    authorizedChoirId: string,
    query: PortalParticipantQuery,
  ): Promise<{ rows: PortalRegistrationRow[]; total: number }>;
  listParticipantPayments(
    authorizedChoirId: string,
    registrationIds: string[],
  ): Promise<PortalComplementLedgerRow[]>;
  listSummaryRegistrations(authorizedChoirId: string): Promise<PortalSummaryRegistrationRow[]>;
  listSummaryPaidComplements(authorizedChoirId: string): Promise<PortalPaidComplementPrincipal[]>;
  signPhoto(registrationId: string, photoPath: string): Promise<string>;
};

type RegistrationDatabaseRow = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string;
  photo_path: string | null;
  voice_part?: string | null;
  payment_status: string;
  payment_origin?: string | null;
  is_free_registration?: boolean;
  amount_cents: number | null;
  pricing_type: string | null;
  standard_price_cents: number | null;
  registration_price_cents: number | null;
  remaining_price_cents?: number | null;
};

type PaymentDatabaseRow = {
  id: string;
  registration_id: string;
  amount_cents: number;
  status: string;
  checkout_url: string | null;
  created_at: string;
  paid_at: string | null;
  initiated_by_name: string;
  initiated_as: string;
};

function isPaymentStatus(value: string): value is PortalRegistrationRow["paymentStatus"] {
  return value === "legacy" || value === "pending" || value === "paid";
}
function isPricingType(value: string | null): value is PortalRegistrationRow["pricingType"] {
  return value === null || value === "standard" || value === "promotional";
}

function isNullableSafeInteger(value: number | null): boolean {
  return value === null || Number.isSafeInteger(value);
}

function mapRegistrationRow(row: RegistrationDatabaseRow): PortalRegistrationRow {
  if (
    !isPaymentStatus(row.payment_status) ||
    !isPricingType(row.pricing_type) ||
    !isNullableSafeInteger(row.amount_cents) ||
    !isNullableSafeInteger(row.standard_price_cents) ||
    !isNullableSafeInteger(row.registration_price_cents) ||
    !isNullableSafeInteger(row.remaining_price_cents ?? null)
  ) {
    throw new Error("Não foi possível consultar os participantes.");
  }
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf ?? "",
    phone: row.phone,
    photoPath: row.photo_path,
    voicePart: row.voice_part ?? null,
    paymentStatus: row.payment_status,
    isExempt: row.payment_origin === "exemption",
    isFreeRegistration: row.is_free_registration === true,
    initialAmountCents: row.amount_cents,
    pricingType: row.pricing_type,
    standardPriceCents: row.standard_price_cents,
    registrationPriceCents: row.registration_price_cents,
    remainingPriceCents: row.remaining_price_cents ?? null,
  };
}

function isComplementStatus(value: string): value is ComplementPaymentStatus {
  return ["creating", "pending", "paid", "failed", "expired"].includes(value);
}

function mapPaymentRow(row: PaymentDatabaseRow): PortalComplementLedgerRow {
  if (
    !isComplementStatus(row.status) ||
    (row.initiated_as !== "regent" &&
      row.initiated_as !== "admin" &&
      row.initiated_as !== "participant") ||
    !Number.isSafeInteger(row.amount_cents) ||
    row.amount_cents <= 0
  ) {
    throw new Error("Não foi possível consultar o histórico financeiro.");
  }
  return {
    id: row.id,
    registrationId: row.registration_id,
    amountCents: row.amount_cents,
    status: row.status,
    checkoutUrl: row.checkout_url,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    initiatedByName: row.initiated_by_name,
    initiatedAs: row.initiated_as,
  };
}

function postgrestLikeValue(value: string): string {
  const sqlLikeEscaped = value.replace(/[\\%_]/g, "\\$&");
  const parserEscaped = `%${sqlLikeEscaped}%`.replace(/[\\"]/g, "\\$&");
  return `"${parserEscaped}"`;
}

function participantSearchFilter(search: string): string {
  const cpfSearch = search.replace(/\D/g, "");
  return [
    `name.ilike.${postgrestLikeValue(search)}`,
    `cpf.ilike.${postgrestLikeValue(cpfSearch || search)}`,
  ].join(",");
}

async function collectBatches<T>(
  loadBatch: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  errorMessage: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += INTERNAL_BATCH_SIZE) {
    const { data, error } = await loadBatch(start, start + INTERNAL_BATCH_SIZE - 1);
    if (error) throw new Error(errorMessage);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < INTERNAL_BATCH_SIZE) return rows;
  }
}

export function createSupabaseRegentPortalRepository(): RegentPortalRepository {
  return {
    async listParticipants(authorizedChoirId, query) {
      let request = supabaseAdmin
        .from("registrations")
        .select(registrationColumns, { count: "exact" })
        .eq("choir_id", authorizedChoirId);
      if (query.search) request = request.or(participantSearchFilter(query.search));
      const start = (query.page - 1) * query.pageSize;
      const { data, error, count } = await request
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + query.pageSize - 1);
      if (error) throw new Error("Não foi possível consultar os participantes.");
      return {
        rows: (data ?? []).map((row) =>
          mapRegistrationRow(row as unknown as RegistrationDatabaseRow),
        ),
        total: count ?? 0,
      };
    },

    async listParticipantPayments(authorizedChoirId, registrationIds) {
      if (registrationIds.length === 0) return [];
      const rows = await collectBatches(async (from, to) => {
        const response = await supabaseAdmin
          .from("registration_complement_payments")
          .select(paymentColumns)
          .eq("choir_id", authorizedChoirId)
          .in("registration_id", registrationIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        return response as unknown as {
          data: PaymentDatabaseRow[] | null;
          error: unknown;
        };
      }, "Não foi possível consultar o histórico financeiro.");
      return rows.map(mapPaymentRow);
    },

    async listSummaryRegistrations(authorizedChoirId) {
      const rows = await collectBatches(async (from, to) => {
        const response = await supabaseAdmin
          .from("registrations")
          .select(summaryRegistrationColumns)
          .eq("choir_id", authorizedChoirId)
          .order("id", { ascending: true })
          .range(from, to);
        return response as unknown as {
          data: RegistrationDatabaseRow[] | null;
          error: unknown;
        };
      }, "Não foi possível consultar o resumo financeiro.");
      return rows.map((row) => {
        const mapped = mapRegistrationRow({
          ...row,
          name: "",
          cpf: null,
          phone: "",
          photo_path: null,
        });
        return {
          id: mapped.id,
          paymentStatus: mapped.paymentStatus,
          isExempt: mapped.isExempt,
          isFreeRegistration: mapped.isFreeRegistration,
          pricingType: mapped.pricingType,
          initialAmountCents: mapped.initialAmountCents,
          standardPriceCents: mapped.standardPriceCents,
          registrationPriceCents: mapped.registrationPriceCents,
          remainingPriceCents: mapped.remainingPriceCents,
        };
      });
    },

    async listSummaryPaidComplements(authorizedChoirId) {
      const rows = await collectBatches(async (from, to) => {
        const response = await supabaseAdmin
          .from("registration_complement_payments")
          .select(summaryPaymentColumns)
          .eq("choir_id", authorizedChoirId)
          .eq("status", "paid")
          .order("id", { ascending: true })
          .range(from, to);
        return response as unknown as {
          data: Array<{ registration_id: string; amount_cents: number }> | null;
          error: unknown;
        };
      }, "Não foi possível consultar o resumo financeiro.");
      return rows.map((row) => {
        if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) {
          throw new Error("Não foi possível consultar o resumo financeiro.");
        }
        return { registrationId: row.registration_id, amountCents: row.amount_cents };
      });
    },

    async signPhoto(registrationId, photoPath) {
      const match = PRIVATE_PHOTO_PATH_PATTERN.exec(photoPath);
      if (!match || match[1] !== registrationId) {
        throw new Error("Não foi possível carregar a foto.");
      }
      const { data, error } = await supabaseAdmin.storage
        .from(REGISTRATION_PHOTO_BUCKET)
        .createSignedUrl(photoPath, PHOTO_URL_EXPIRY_SECONDS);
      if (error || !data?.signedUrl) throw new Error("Não foi possível carregar a foto.");
      return data.signedUrl;
    },
  };
}

function groupPayments(rows: PortalComplementLedgerRow[]) {
  const grouped = new Map<string, PortalComplementLedgerRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.registrationId) ?? [];
    current.push(row);
    grouped.set(row.registrationId, current);
  }
  return grouped;
}

function confirmedPrincipal(rows: PortalComplementLedgerRow[]): number {
  return rows.reduce((sum, row) => sum + (row.status === "paid" ? row.amountCents : 0), 0);
}

function assignedComplementCents(row: Pick<PortalRegistrationRow, "pricingType" | "remainingPriceCents" | "standardPriceCents" | "registrationPriceCents">): number {
  if (row.pricingType !== "promotional") return 0;
  return Math.max(0, row.remainingPriceCents ??
    (row.standardPriceCents ?? 0) - (row.registrationPriceCents ?? 0));
}

function pendingAmounts(row: PortalSummaryRegistrationRow, confirmedCents: number) {
  const confirmed = Math.min(confirmedCents, assignedComplementCents(row));
  const financial = deriveRegistrationFinancialState({
    paymentStatus: row.paymentStatus,
    isExempt: row.isExempt,
    initialAmountCents: row.initialAmountCents,
    pricingType: row.pricingType,
    standardPriceCents: row.standardPriceCents,
    registrationPriceCents: row.registrationPriceCents,
    remainingPriceCents: row.remainingPriceCents,
    confirmedComplementCents: confirmed,
  });
  const raffleRow = {
    isFreeRegistration: row.isFreeRegistration === true,
    pricingType: row.pricingType,
    registrationPriceCents: row.registrationPriceCents,
    standardPriceCents: row.standardPriceCents,
    remainingPriceCents: row.remainingPriceCents,
    rafflePaidCents: row.isFreeRegistration ? confirmedCents : undefined,
  };
  return {
    financial,
    registrationPendingCents: getAdminRegistrationPendingCents(raffleRow, financial),
    rafflePendingCents: getAdminRafflePending(raffleRow, financial)?.cents ?? 0,
  };
}

export function createRegentPortalService(repository: RegentPortalRepository) {
  return {
    async list(
      authorizedChoirId: string,
      query: PortalParticipantQuery,
    ): Promise<PortalParticipantPage> {
      const page = await repository.listParticipants(authorizedChoirId, query);
      const payments = await repository.listParticipantPayments(
        authorizedChoirId,
        page.rows.map((row) => row.id),
      );
      const paymentsByRegistration = groupPayments(payments);
      const signedPhotos = new Map<string, Promise<string | null>>();
      const signPhoto = (registrationId: string, photoPath: string) => {
        const existing = signedPhotos.get(`${registrationId}:${photoPath}`);
        if (existing) return existing;
        const signing = repository.signPhoto(registrationId, photoPath).catch(() => null);
        signedPhotos.set(`${registrationId}:${photoPath}`, signing);
        return signing;
      };
      const rows = await Promise.all(
        page.rows.map(async (row): Promise<PortalParticipant> => {
          const participantPayments = paymentsByRegistration.get(row.id) ?? [];
          const openPayment =
            participantPayments.find(
              (payment) => payment.status === "creating" || payment.status === "pending",
            ) ?? null;
          const photoUrl =
            row.photoPath && PRIVATE_PHOTO_PATH_PATTERN.exec(row.photoPath)?.[1] === row.id
              ? await signPhoto(row.id, row.photoPath)
              : null;
          const amounts = pendingAmounts(row, confirmedPrincipal(participantPayments));
          return {
            id: row.id,
            name: row.name,
            ...(row.voicePart ? { voicePart: row.voicePart } : {}),
            cpf: row.cpf,
            phone: row.phone,
            whatsappUrl: buildBrazilWhatsAppUrl(row.phone),
            photoUrl,
            paymentStatus: row.paymentStatus,
            initialAmountCents: row.initialAmountCents,
            pricingType: row.pricingType,
            standardPriceCents: row.standardPriceCents,
            registrationPriceCents: row.registrationPriceCents,
            financialState: amounts.financial,
            registrationPendingCents: amounts.registrationPendingCents,
            rafflePendingCents: amounts.rafflePendingCents,
            complement: calculateComplementState({
              paymentStatus: row.paymentStatus,
              pricingType: row.pricingType,
              standardPriceCents: row.standardPriceCents,
              registrationPriceCents: row.registrationPriceCents,
              remainingPriceCents: row.remainingPriceCents,
              confirmedComplementCents: Math.min(confirmedPrincipal(participantPayments), assignedComplementCents(row)),
              openPayment,
            }),
            payments: participantPayments,
          };
        }),
      );
      return { rows, total: page.total, page: query.page, pageSize: query.pageSize };
    },

    async summary(authorizedChoirId: string): Promise<PortalSummary> {
      const [registrations, paidComplements] = await Promise.all([
        repository.listSummaryRegistrations(authorizedChoirId),
        repository.listSummaryPaidComplements(authorizedChoirId),
      ]);
      const paidByRegistration = new Map<string, number>();
      for (const payment of paidComplements) {
        paidByRegistration.set(
          payment.registrationId,
          (paidByRegistration.get(payment.registrationId) ?? 0) + payment.amountCents,
        );
      }

      let eligibleComplementCents = 0;
      let confirmedComplementCents = 0;
      let outstandingComplementCents = 0;
      let registrationPendingCents = 0;
      let rafflePendingCents = 0;
      for (const registration of registrations) {
        const confirmed = paidByRegistration.get(registration.id) ?? 0;
        const assigned = assignedComplementCents(registration);
        const confirmedPrincipalCents = Math.min(confirmed, assigned);
        const amounts = pendingAmounts(registration, confirmed);
        const financialState = amounts.financial;
        registrationPendingCents += amounts.registrationPendingCents ?? 0;
        rafflePendingCents += amounts.rafflePendingCents;
        if (
          financialState.status === "legacy" ||
          financialState.status === "pending" ||
          registration.pricingType !== "promotional" ||
          registration.standardPriceCents === null ||
          registration.registrationPriceCents === null
        ) {
          continue;
        }
        eligibleComplementCents += assigned;
        confirmedComplementCents += confirmedPrincipalCents;
        outstandingComplementCents += financialState.pendingCents;
      }

      return {
        totalParticipants: registrations.length,
        registrationPendingCents,
        rafflePendingCents,
        eligibleComplementCents,
        confirmedComplementCents,
        outstandingComplementCents,
      };
    },
  };
}

export type RegentPortalService = ReturnType<typeof createRegentPortalService>;

let regentPortalService: RegentPortalService | undefined;

export function getRegentPortalService(): RegentPortalService {
  if (!regentPortalService) {
    regentPortalService = createRegentPortalService(createSupabaseRegentPortalRepository());
  }
  return regentPortalService;
}
