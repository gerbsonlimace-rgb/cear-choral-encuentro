import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildRegistrationsCsv,
  enrichAdminRegistrationRow,
  mapAdminRegistrationRow,
  summarizeAdminRegistrations,
  type AdminExportFile,
  type AdminRegistrationExportQuery,
  type AdminRegistrationCandidate,
  type AdminComplementPaymentRow,
  type AdminRegistrationPage,
  type AdminRegistrationQuery,
  type AdminRegistrationRow,
  type AdminRegistrationSummary,
  type RegistrationDatabaseRow,
} from "./admin.domain";

export const adminRegistrationColumns = [
  "id",
  "created_at",
  "name",
  "cpf",
  "choir_name",
  "choir_id",
  "email",
  "phone",
  "city",
  "institution",
  "role",
  "pricing_type",
  "standard_price_cents",
  "registration_price_cents",
  "amount_cents",
  "paid_amount_cents",
  "payment_status",
  "payment_method",
  "installments",
  "paid_at",
  "photo_path",
  "participant_accounts(access_status)",
].join(",");
const complementPaymentColumns =
  "id,registration_id,amount_cents,status,checkout_url,created_at,paid_at,initiated_by_name,initiated_as";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
const PHOTO_URL_EXPIRY_SECONDS = 3600;

async function signRegistrationPhoto(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(REGISTRATION_PHOTO_BUCKET)
    .createSignedUrl(photoPath, PHOTO_URL_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function fetchActiveRegentNames(choirIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(choirIds.filter(Boolean))];
  if (uniqueIds.length === 0) return names;
  const { data, error } = await supabaseAdmin
    .from("choir_regents")
    .select("choir_id,name")
    .in("choir_id", uniqueIds)
    .is("revoked_at", null);
  if (error) return names;
  for (const regent of data ?? []) {
    if (regent.choir_id && !names.has(regent.choir_id)) names.set(regent.choir_id, regent.name);
  }
  return names;
}

function registrationSearchFilter(search: string): string {
  // SQL LIKE escaping must survive the PostgREST quoted-value parser.
  const cpfSearch = search.replace(/\D/g, "");
  return ["name", "cpf", "choir_name", "email", "phone", "city", "institution"]
    .map((column) => {
      const value = column === "cpf" && cpfSearch ? cpfSearch : search;
      const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
      const quoted = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
      return `${column}.ilike.${quoted}`;
    })
    .join(",");
}

export type AdminExportAuditEvent = {
  adminUserId: string;
  paymentStatusFilter: "pending" | "paid" | "legacy" | null;
  searchUsed: boolean;
  resultCount: number;
};

export type AdminRegistrationRepository = {
  listCandidates?(search: string): Promise<AdminRegistrationCandidate[]>;
  listComplementPayments?(registrationIds: string[]): Promise<AdminComplementPaymentRow[]>;
  signPhotos?(rows: AdminRegistrationRow[]): Promise<AdminRegistrationRow[]>;
  list(
    query: AdminRegistrationQuery,
    options?: { includePhotos?: boolean },
  ): Promise<AdminRegistrationPage>;
  listAll(query: AdminRegistrationExportQuery): Promise<AdminRegistrationRow[]>;
  recordExport(event: AdminExportAuditEvent): Promise<void>;
};

export function createSupabaseAdminRegistrationRepository(): AdminRegistrationRepository {
  const repository: AdminRegistrationRepository = {
    async listCandidates(search) {
      const candidates: AdminRegistrationCandidate[] = [];
      for (let start = 0; ; start += 1000) {
        let request = supabaseAdmin
          .from("registrations")
          .select(adminRegistrationColumns)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(start, start + 999);
        if (search) request = request.or(registrationSearchFilter(search));
        const { data, error } = await request;
        if (error) throw new Error("Não foi possível consultar as inscrições.");
        const records = (data ?? []) as unknown as Array<
          RegistrationDatabaseRow & {
            participant_accounts?: Array<{ access_status: "active" | "pending" | "conflict" }>;
          }
        >;
        const regentNames = await fetchActiveRegentNames(
          records.map((record) => record.choir_id ?? "").filter(Boolean),
        );
        candidates.push(
          ...records.map((record) => ({
            row: record,
            accountStatus: record.participant_accounts?.[0]?.access_status ?? null,
            regentName: (record.choir_id && regentNames.get(record.choir_id)) || null,
          })),
        );
        if (records.length < 1000) return candidates;
      }
    },
    async listComplementPayments(registrationIds) {
      if (registrationIds.length === 0) return [];
      const rows: AdminComplementPaymentRow[] = [];
      for (let offset = 0; offset < registrationIds.length; offset += 1000) {
        const ids = registrationIds.slice(offset, offset + 1000);
        const { data, error } = await supabaseAdmin
          .from("registration_complement_payments")
          .select(complementPaymentColumns)
          .in("registration_id", ids)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });
        if (error) throw new Error("Não foi possível consultar o histórico financeiro.");
        for (const value of (data ?? []) as Array<Record<string, unknown>>) {
          if (
            typeof value.id !== "string" ||
            typeof value.registration_id !== "string" ||
            !["creating", "pending", "paid", "failed", "expired"].includes(String(value.status)) ||
            !Number.isSafeInteger(value.amount_cents) ||
            Number(value.amount_cents) <= 0 ||
            (value.initiated_as !== "regent" && value.initiated_as !== "admin") ||
            typeof value.created_at !== "string" ||
            typeof value.initiated_by_name !== "string"
          ) {
            throw new Error("Não foi possível consultar o histórico financeiro.");
          }
          rows.push({
            id: value.id,
            registrationId: value.registration_id,
            amountCents: Number(value.amount_cents),
            status: value.status as AdminComplementPaymentRow["status"],
            checkoutUrl: typeof value.checkout_url === "string" ? value.checkout_url : null,
            createdAt: value.created_at,
            paidAt: typeof value.paid_at === "string" ? value.paid_at : null,
            initiatedByName: value.initiated_by_name,
            initiatedAs: value.initiated_as,
          });
        }
      }
      return rows;
    },
    async signPhotos(rows) {
      return Promise.all(
        rows.map(async (row) => {
          const photoPath = (row as AdminRegistrationRow & { _photoPath?: string | null })
            ._photoPath;
          return {
            ...row,
            photoUrl: await signRegistrationPhoto(photoPath ?? null),
          };
        }),
      );
    },
    async list(query: AdminRegistrationQuery, options = {}): Promise<AdminRegistrationPage> {
      let request = supabaseAdmin
        .from("registrations")
        .select(adminRegistrationColumns, { count: "exact" });
      if (query.paymentStatus !== "all")
        request = request.eq("payment_status", query.paymentStatus);
      if (query.search) request = request.or(registrationSearchFilter(query.search));
      const start = (query.page - 1) * query.pageSize;
      const { data, error, count } = await request
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + query.pageSize - 1);
      if (error) throw new Error("Não foi possível consultar as inscrições.");
      const includePhotos = options.includePhotos ?? true;
      const records = (data ?? []) as unknown as Array<
        RegistrationDatabaseRow & {
          participant_accounts?: Array<{ access_status: "active" | "pending" | "conflict" }>;
        }
      >;
      const regentNames = await fetchActiveRegentNames(
        records.map((record) => record.choir_id ?? "").filter(Boolean),
      );
      return {
        // The shared mapper reads only the selected administrative columns.
        rows: await Promise.all(
          records.map(async (record) => {
            const photoUrl = includePhotos ? await signRegistrationPhoto(record.photo_path) : null;
            return mapAdminRegistrationRow(
              record,
              record.participant_accounts?.[0]?.access_status ?? null,
              photoUrl,
              (record.choir_id && regentNames.get(record.choir_id)) || null,
            );
          }),
        ),
        total: count ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    async listAll(query) {
      const rows: AdminRegistrationRow[] = [];
      let page = 1;
      while (true) {
        const batch = await repository.list(
          { ...query, page, pageSize: 1000 },
          { includePhotos: false },
        );
        rows.push(...batch.rows);
        if (rows.length >= batch.total || batch.rows.length === 0) return rows;
        page += 1;
      }
    },
    async recordExport(event) {
      const { error } = await supabaseAdmin.from("admin_access_events").insert({
        admin_user_id: event.adminUserId,
        event_type: "registrations.export_csv",
        payment_status_filter: event.paymentStatusFilter,
        search_used: event.searchUsed,
        result_count: event.resultCount,
      });
      if (error) throw new Error("Não foi possível registrar a exportação.");
    },
  };
  return repository;
}

export function createAdminRegistrationService(
  repository: AdminRegistrationRepository,
  now: () => Date,
) {
  async function listEnriched(query: AdminRegistrationQuery, includePhotos: boolean) {
    if (!repository.listCandidates || !repository.listComplementPayments) {
      return repository.list(query, { includePhotos });
    }
    const candidates = await repository.listCandidates(query.search);
    // Only paid promotional registrations can have a meaningful complement.
    // This also avoids unnecessary ledger reads for pending, standard, and legacy rows.
    const complementIds = candidates
      .filter(({ row }) => row.payment_status === "paid" && row.pricing_type === "promotional")
      .map(({ row }) => row.id);
    const payments = await repository.listComplementPayments(complementIds);
    const paymentsByRegistration = new Map<string, AdminComplementPaymentRow[]>();
    for (const payment of payments) {
      const current = paymentsByRegistration.get(payment.registrationId) ?? [];
      current.push(payment);
      paymentsByRegistration.set(payment.registrationId, current);
    }
    for (const payments of paymentsByRegistration.values()) {
      payments.sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      );
    }
    const enriched = candidates.map((candidate) => {
      const row = enrichAdminRegistrationRow(
        candidate,
        paymentsByRegistration.get(candidate.row.id) ?? [],
      );
      Object.defineProperty(row, "_photoPath", {
        value: candidate.row.photo_path,
        enumerable: false,
      });
      return row;
    });
    const filtered =
      query.paymentStatus === "all"
        ? enriched
        : enriched.filter((row) => row.financialState?.status === query.paymentStatus);
    const start = (query.page - 1) * query.pageSize;
    const pageRows = filtered.slice(start, start + query.pageSize);
    const signed =
      includePhotos && repository.signPhotos ? await repository.signPhotos(pageRows) : pageRows;
    return { rows: signed, total: filtered.length, page: query.page, pageSize: query.pageSize };
  }

  return {
    list: (query: AdminRegistrationQuery) => listEnriched(query, true),
    async summary(): Promise<AdminRegistrationSummary> {
      const completeRows =
        repository.listCandidates && repository.listComplementPayments
          ? await listAllEnriched()
          : await repository.listAll({ search: "", paymentStatus: "all" });
      return summarizeAdminRegistrations(completeRows);
    },
    async export(
      query: AdminRegistrationExportQuery,
      adminUserId: string,
    ): Promise<AdminExportFile> {
      const rows =
        repository.listCandidates && repository.listComplementPayments
          ? await listAllEnriched(query)
          : await repository.listAll(query);
      const file = buildRegistrationsCsv(rows, now());
      await repository.recordExport({
        adminUserId,
        // The audit table predates the derived partial state and only accepts raw
        // registration statuses. A partially paid registration is still raw `paid`.
        paymentStatusFilter:
          query.paymentStatus === "all"
            ? null
            : query.paymentStatus === "partially_paid"
              ? "paid"
              : query.paymentStatus,
        searchUsed: query.search.length > 0,
        resultCount: rows.length,
      });
      return file;
    },
  };

  async function listAllEnriched(
    query: AdminRegistrationExportQuery = { search: "", paymentStatus: "all" },
  ) {
    const candidates = await repository.listCandidates!(query.search);
    const complementIds = candidates
      .filter(({ row }) => row.payment_status === "paid" && row.pricing_type === "promotional")
      .map(({ row }) => row.id);
    const payments = await repository.listComplementPayments!(complementIds);
    const byRegistration = new Map<string, AdminComplementPaymentRow[]>();
    for (const payment of payments) {
      const list = byRegistration.get(payment.registrationId) ?? [];
      list.push(payment);
      byRegistration.set(payment.registrationId, list);
    }
    for (const payments of byRegistration.values()) {
      payments.sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      );
    }
    const rows = candidates.map((candidate) =>
      enrichAdminRegistrationRow(candidate, byRegistration.get(candidate.row.id) ?? []),
    );
    return query.paymentStatus === "all"
      ? rows
      : rows.filter((row) => row.financialState?.status === query.paymentStatus);
  }
}

let adminRegistrationService: ReturnType<typeof createAdminRegistrationService> | undefined;

export function getAdminRegistrationService() {
  if (!adminRegistrationService) {
    adminRegistrationService = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      () => new Date(),
    );
  }
  return adminRegistrationService;
}
