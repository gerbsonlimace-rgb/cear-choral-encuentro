import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildRegistrationsCsv,
  mapAdminRegistrationRow,
  summarizeAdminRegistrations,
  type AdminExportFile,
  type AdminRegistrationExportQuery,
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
  "participant_accounts(access_status)",
].join(",");

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
  list(query: AdminRegistrationQuery): Promise<AdminRegistrationPage>;
  listAll(query: AdminRegistrationExportQuery): Promise<AdminRegistrationRow[]>;
  recordExport(event: AdminExportAuditEvent): Promise<void>;
};

export function createSupabaseAdminRegistrationRepository(): AdminRegistrationRepository {
  const repository: AdminRegistrationRepository = {
    async list(query: AdminRegistrationQuery): Promise<AdminRegistrationPage> {
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
      return {
        // The shared mapper reads only the selected administrative columns.
        rows: (data ?? []).map((row) => {
          const record = row as unknown as RegistrationDatabaseRow & {
            participant_accounts?: Array<{ access_status: "active" | "pending" | "conflict" }>;
          };
          return mapAdminRegistrationRow(
            record,
            record.participant_accounts?.[0]?.access_status ?? null,
          );
        }),
        total: count ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    async listAll(query) {
      const rows: AdminRegistrationRow[] = [];
      let page = 1;
      while (true) {
        const batch = await repository.list({ ...query, page, pageSize: 1000 });
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
  return {
    list: (query: AdminRegistrationQuery) => repository.list(query),
    async summary(): Promise<AdminRegistrationSummary> {
      const rows = await repository.listAll({ search: "", paymentStatus: "all" });
      return summarizeAdminRegistrations(rows);
    },
    async export(
      query: AdminRegistrationExportQuery,
      adminUserId: string,
    ): Promise<AdminExportFile> {
      const rows = await repository.listAll(query);
      const file = buildRegistrationsCsv(rows, now());
      await repository.recordExport({
        adminUserId,
        paymentStatusFilter: query.paymentStatus === "all" ? null : query.paymentStatus,
        searchUsed: query.search.length > 0,
        resultCount: rows.length,
      });
      return file;
    },
  };
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
