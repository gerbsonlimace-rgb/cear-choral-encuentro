import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildBrazilWhatsAppUrl,
  calculateComplementState,
  type ComplementPaymentRow,
  type ComplementPaymentStatus,
  type PortalParticipant,
  type PortalSummary,
} from "./regent-payments.domain";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
const PHOTO_URL_EXPIRY_SECONDS = 300;
const INTERNAL_BATCH_SIZE = 1_000;
const registrationColumns =
  "id,name,cpf,phone,photo_path,payment_status,pricing_type,standard_price_cents,registration_price_cents" as const;
const summaryRegistrationColumns =
  "id,payment_status,pricing_type,standard_price_cents,registration_price_cents" as const;
const paymentColumns =
  "id,registration_id,amount_cents,status,checkout_url,created_at,paid_at,initiated_by_name,initiated_as" as const;
const summaryPaymentColumns = "registration_id,amount_cents" as const;

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
  paymentStatus: "legacy" | "pending" | "paid";
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
};

export type PortalSummaryRegistrationRow = Pick<
  PortalRegistrationRow,
  "id" | "paymentStatus" | "pricingType" | "standardPriceCents" | "registrationPriceCents"
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
  signPhoto(photoPath: string): Promise<string>;
};

type RegistrationDatabaseRow = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string;
  photo_path: string | null;
  payment_status: string;
  pricing_type: string | null;
  standard_price_cents: number | null;
  registration_price_cents: number | null;
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
    !isNullableSafeInteger(row.standard_price_cents) ||
    !isNullableSafeInteger(row.registration_price_cents)
  ) {
    throw new Error("Não foi possível consultar os participantes.");
  }
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf ?? "",
    phone: row.phone,
    photoPath: row.photo_path,
    paymentStatus: row.payment_status,
    pricingType: row.pricing_type,
    standardPriceCents: row.standard_price_cents,
    registrationPriceCents: row.registration_price_cents,
  };
}

function isComplementStatus(value: string): value is ComplementPaymentStatus {
  return ["creating", "pending", "paid", "failed", "expired"].includes(value);
}

function mapPaymentRow(row: PaymentDatabaseRow): PortalComplementLedgerRow {
  if (
    !isComplementStatus(row.status) ||
    (row.initiated_as !== "regent" && row.initiated_as !== "admin") ||
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
          pricingType: mapped.pricingType,
          standardPriceCents: mapped.standardPriceCents,
          registrationPriceCents: mapped.registrationPriceCents,
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

    async signPhoto(photoPath) {
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
      const signPhoto = (photoPath: string) => {
        const existing = signedPhotos.get(photoPath);
        if (existing) return existing;
        const signing = repository.signPhoto(photoPath).catch(() => null);
        signedPhotos.set(photoPath, signing);
        return signing;
      };
      const rows = await Promise.all(
        page.rows.map(async (row): Promise<PortalParticipant> => {
          const participantPayments = paymentsByRegistration.get(row.id) ?? [];
          const openPayment =
            participantPayments.find(
              (payment) => payment.status === "creating" || payment.status === "pending",
            ) ?? null;
          const photoUrl = row.photoPath ? await signPhoto(row.photoPath) : null;
          return {
            id: row.id,
            name: row.name,
            cpf: row.cpf,
            phone: row.phone,
            whatsappUrl: buildBrazilWhatsAppUrl(row.phone),
            photoUrl,
            paymentStatus: row.paymentStatus,
            pricingType: row.pricingType,
            standardPriceCents: row.standardPriceCents,
            registrationPriceCents: row.registrationPriceCents,
            complement: calculateComplementState({
              paymentStatus: row.paymentStatus,
              pricingType: row.pricingType,
              standardPriceCents: row.standardPriceCents,
              registrationPriceCents: row.registrationPriceCents,
              confirmedComplementCents: confirmedPrincipal(participantPayments),
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
      let outstandingComplementCents = 0;
      for (const registration of registrations) {
        const eligibility = calculateComplementState({
          paymentStatus: registration.paymentStatus,
          pricingType: registration.pricingType,
          standardPriceCents: registration.standardPriceCents,
          registrationPriceCents: registration.registrationPriceCents,
          confirmedComplementCents: 0,
          openPayment: null,
        });
        if (!eligibility.eligible) continue;
        eligibleComplementCents += eligibility.totalCents;
        const confirmed = paidByRegistration.get(registration.id) ?? 0;
        const state = calculateComplementState({
          paymentStatus: registration.paymentStatus,
          pricingType: registration.pricingType,
          standardPriceCents: registration.standardPriceCents,
          registrationPriceCents: registration.registrationPriceCents,
          confirmedComplementCents: confirmed,
          openPayment: null,
        });
        if (state.eligible) outstandingComplementCents += state.balanceCents;
      }

      return {
        totalParticipants: registrations.length,
        eligibleComplementCents,
        confirmedComplementCents: paidComplements.reduce(
          (sum, payment) => sum + payment.amountCents,
          0,
        ),
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
