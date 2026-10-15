import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildRegistrationsCsv,
  enrichAdminRegistrationRow,
  manualPaymentReceiptSchema,
  MAX_MANUAL_PAYMENT_RECEIPT_BYTES,
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
  type AdminSupersededCheckoutReview,
  type AdminUpdateRegistrationInput,
  type ManualPaymentReceipt,
  type RegistrationDatabaseRow,
} from "./admin.domain";

export const adminRegistrationColumns = [
  "id",
  "created_at",
  "name",
  "badge_name",
  "cpf",
  "birth_date",
  "diocese",
  "choir_name",
  "choir_id",
  "other_choir_name",
  "email",
  "phone",
  "city",
  "institution",
  "role",
  "musical_profile",
  "voice_part",
  "observations",
  "include_shirt",
  "shirt_size",
  "shirt_price_cents",
  "pricing_type",
  "standard_price_cents",
  "registration_price_cents",
  "remaining_price_cents",
  "amount_cents",
  "paid_amount_cents",
  "payment_status",
  "payment_method",
  "installments",
  "paid_at",
  "payment_origin",
  "is_free_registration",
  "manual_receipt_path",
  "manual_receipt_file_name",
  "manual_receipt_mime_type",
  "manual_receipt_size_bytes",
  "photo_path",
  "participant_accounts(access_status)",
].join(",");
const complementPaymentColumns =
  "id,registration_id,amount_cents,status,checkout_url,created_at,paid_at,initiated_by_name,initiated_as";
const supersededCheckoutReviewColumns =
  "id,registration_id,order_nsu,amount_cents,paid_amount_cents,payment_method,installments,paid_at,infinitepay_transaction_nsu,receipt_url";

const REGISTRATION_PHOTO_BUCKET = "registration-photos";
const PHOTO_URL_EXPIRY_SECONDS = 3600;
const MANUAL_PAYMENT_RECEIPT_BUCKET = "registration-payment-receipts";
const RECEIPT_URL_EXPIRY_SECONDS = 3600;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function receiptExtension(mimeType: ManualPaymentReceipt["mimeType"]): string {
  if (mimeType === "application/pdf") return "pdf";
  return mimeType === "image/jpeg" ? "jpg" : "png";
}

function parseManualReceipt(receipt: ManualPaymentReceipt) {
  const parsed = manualPaymentReceiptSchema.parse(receipt);
  const bytes = decodeBase64(parsed.base64);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MANUAL_PAYMENT_RECEIPT_BYTES) {
    throw new Error("O comprovante deve ter até 10 MB.");
  }
  return { parsed, bytes };
}

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
  listSupersededCheckoutReviews?(
    registrationIds: string[],
  ): Promise<Map<string, AdminSupersededCheckoutReview>>;
  signPhotos?(rows: AdminRegistrationRow[]): Promise<AdminRegistrationRow[]>;
  list(
    query: AdminRegistrationQuery,
    options?: { includePhotos?: boolean },
  ): Promise<AdminRegistrationPage>;
  listAll(query: AdminRegistrationExportQuery): Promise<AdminRegistrationRow[]>;
  recordExport(event: AdminExportAuditEvent): Promise<void>;
  markPaid?: (
    registrationId: string,
    adminUserId: string,
    receipt: ManualPaymentReceipt,
  ) => Promise<{ status: "paid"; registrationId: string }>;
  markExempt?: (
    registrationId: string,
    adminUserId: string,
  ) => Promise<{ status: "exempt"; registrationId: string }>;
  getReceiptUrl?(registrationId: string): Promise<{ signedUrl: string; expiresIn: number }>;
  updateRegistration?(
    input: AdminUpdateRegistrationInput,
  ): Promise<{ status: "updated"; registrationId: string }>;
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
            (value.initiated_as !== "regent" &&
              value.initiated_as !== "admin" &&
              value.initiated_as !== "participant") ||
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
    async listSupersededCheckoutReviews(registrationIds) {
      const reviews = new Map<string, AdminSupersededCheckoutReview>();
      for (let offset = 0; offset < registrationIds.length; offset += 1000) {
        const ids = registrationIds.slice(offset, offset + 1000);
        if (ids.length === 0) continue;
        const { data, error } = await supabaseAdmin
          .from("registration_superseded_checkouts")
          .select(supersededCheckoutReviewColumns)
          .in("registration_id", ids)
          .eq("status", "paid_requires_review")
          .order("paid_at", { ascending: false })
          .order("id", { ascending: false });
        if (error) {
          throw new Error("Não foi possível consultar pagamentos de checkouts substituídos.");
        }
        for (const value of (data ?? []) as Array<Record<string, unknown>>) {
          const validDate =
            typeof value.paid_at === "string" && Number.isFinite(Date.parse(value.paid_at));
          if (
            typeof value.id !== "string" ||
            typeof value.registration_id !== "string" ||
            typeof value.order_nsu !== "string" ||
            value.order_nsu.trim().length === 0 ||
            !Number.isSafeInteger(value.amount_cents) ||
            Number(value.amount_cents) <= 0 ||
            !Number.isSafeInteger(value.paid_amount_cents) ||
            Number(value.paid_amount_cents) < Number(value.amount_cents) ||
            (value.payment_method !== "pix" && value.payment_method !== "credit_card") ||
            !Number.isSafeInteger(value.installments) ||
            Number(value.installments) <= 0 ||
            !validDate ||
            typeof value.infinitepay_transaction_nsu !== "string" ||
            value.infinitepay_transaction_nsu.trim().length === 0 ||
            (value.receipt_url !== null && typeof value.receipt_url !== "string")
          ) {
            throw new Error("Não foi possível consultar pagamentos de checkouts substituídos.");
          }
          if (!reviews.has(value.registration_id)) {
            reviews.set(value.registration_id, {
              orderNsu: value.order_nsu,
              amountCents: Number(value.amount_cents),
              paidAmountCents: Number(value.paid_amount_cents),
              paymentMethod: value.payment_method,
              installments: Number(value.installments),
              paidAt: value.paid_at as string,
              transactionNsu: value.infinitepay_transaction_nsu,
              receiptUrl: value.receipt_url as string | null,
            });
          }
        }
      }
      return reviews;
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
    async markPaid(registrationId, adminUserId, receipt) {
      const { data: current, error: readError } = await supabaseAdmin
        .from("registrations")
        .select("id,amount_cents,payment_status,checkout_url")
        .eq("id", registrationId)
        .maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a inscrição.");
      if (!current) throw new Error("Inscrição não encontrada.");
      if (current.payment_status !== "pending") {
        throw new Error("A inscrição não está pendente.");
      }
      const amountCents = current.amount_cents;
      if (
        typeof amountCents !== "number" ||
        !Number.isSafeInteger(amountCents) ||
        amountCents <= 0
      ) {
        throw new Error("Não foi possível confirmar o valor da inscrição.");
      }

      const { parsed, bytes } = parseManualReceipt(receipt);
      const receiptPath = `${registrationId}/${crypto.randomUUID()}.${receiptExtension(parsed.mimeType)}`;
      const storage = supabaseAdmin.storage.from(MANUAL_PAYMENT_RECEIPT_BUCKET);
      const { error: uploadError } = await storage.upload(receiptPath, bytes, {
        cacheControl: "31536000",
        contentType: parsed.mimeType,
        upsert: false,
      });
      if (uploadError) throw new Error("Não foi possível enviar o comprovante.");

      const paidAt = new Date().toISOString();
      try {
        const { data, error } = await supabaseAdmin
          .from("registrations")
          .update({
            payment_status: "paid",
            payment_origin: "manual",
            manual_paid_by: adminUserId,
            manual_receipt_path: receiptPath,
            manual_receipt_file_name: parsed.fileName,
            manual_receipt_mime_type: parsed.mimeType,
            manual_receipt_size_bytes: bytes.byteLength,
            checkout_url: null,
            infinitepay_invoice_slug: null,
            infinitepay_transaction_nsu: null,
            payment_method: null,
            installments: null,
            paid_amount_cents: amountCents,
            receipt_url: null,
            paid_at: paidAt,
          })
          .eq("id", registrationId)
          .eq("payment_status", "pending")
          .select("id")
          .maybeSingle();
        if (error || !data) {
          throw new Error("Não foi possível marcar a inscrição como paga.");
        }
        return { status: "paid", registrationId: data.id };
      } catch (error) {
        await storage.remove([receiptPath]).catch(() => undefined);
        throw error;
      }
    },
    async markExempt(registrationId, adminUserId) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          payment_status: "paid",
          payment_origin: "exemption",
          exempted_by: adminUserId,
          exempted_at: new Date().toISOString(),
          amount_cents: 0,
          paid_amount_cents: 0,
          standard_price_cents: 0,
          registration_price_cents: 0,
          remaining_price_cents: 0,
          shirt_price_cents: 0,
          order_nsu: null,
          checkout_url: null,
          infinitepay_invoice_slug: null,
          infinitepay_transaction_nsu: null,
          payment_method: null,
          installments: null,
          receipt_url: null,
          paid_at: null,
          manual_paid_by: null,
          manual_receipt_path: null,
          manual_receipt_file_name: null,
          manual_receipt_mime_type: null,
          manual_receipt_size_bytes: null,
        })
        .eq("id", registrationId)
        .eq("payment_status", "pending")
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error("Não foi possível marcar a inscrição como isenta.");
      }
      return { status: "exempt", registrationId: data.id };
    },
    async getReceiptUrl(registrationId) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .select("manual_receipt_path")
        .eq("id", registrationId)
        .maybeSingle();
      if (error) throw new Error("Não foi possível consultar o comprovante.");
      const path = data?.manual_receipt_path;
      if (typeof path !== "string" || !path) throw new Error("Comprovante não encontrado.");
      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from(MANUAL_PAYMENT_RECEIPT_BUCKET)
        .createSignedUrl(path, RECEIPT_URL_EXPIRY_SECONDS);
      if (signedError || !signed?.signedUrl) {
        throw new Error("Não foi possível abrir o comprovante.");
      }
      return { signedUrl: signed.signedUrl, expiresIn: RECEIPT_URL_EXPIRY_SECONDS };
    },
    async updateRegistration(input) {
      const { data: current, error: readError } = await supabaseAdmin
        .from("registrations")
        .select("id,email")
        .eq("id", input.registrationId)
        .maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a inscrição.");
      if (!current) throw new Error("Inscrição não encontrada.");

      const nextEmail = input.email.trim().toLowerCase();
      const currentEmail = current.email?.trim().toLowerCase() ?? null;
      if (nextEmail !== currentEmail) {
        const { data: account } = await supabaseAdmin
          .from("participant_accounts")
          .select("user_id")
          .eq("registration_id", input.registrationId)
          .maybeSingle();
        if (account?.user_id) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            account.user_id,
            { email: nextEmail },
          );
          if (authError) {
            throw new Error(
              /already|duplicate|exists/i.test(authError.message)
                ? "Já existe uma conta com esse e-mail."
                : "Não foi possível atualizar o e-mail de acesso do participante.",
            );
          }
        }
      }

      let choirName = input.otherChoirName;
      if (input.choirId) {
        const { data: choir, error: choirError } = await supabaseAdmin
          .from("choirs")
          .select("name")
          .eq("id", input.choirId)
          .maybeSingle();
        if (choirError || !choir) throw new Error("Selecione um coro válido.");
        choirName = choir.name;
      }

      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          name: input.name,
          badge_name: input.badgeName,
          cpf: input.cpf,
          email: nextEmail,
          phone: input.phone,
          birth_date: input.birthDate,
          diocese: input.diocese,
          choir_id: input.choirId,
          choir_name: choirName,
          other_choir_name: input.choirId ? null : input.otherChoirName,
          city: input.city,
          institution: input.institution,
          role: input.role,
          musical_profile: input.musicalProfile,
          voice_part: input.voicePart,
          observations: input.observations,
        })
        .eq("id", input.registrationId)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Não foi possível salvar os dados da inscrição.");
      return { status: "updated", registrationId: data.id };
    },
  };
  return repository;
}

export function createAdminRegistrationService(
  repository: AdminRegistrationRepository,
  now: () => Date,
  provisionParticipant?: (
    registrationId: string,
  ) => Promise<{ status: "active" | "pending" | "conflict" }>,
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
    const [payments, reviews] = await Promise.all([
      repository.listComplementPayments(complementIds),
      repository.listSupersededCheckoutReviews?.(candidates.map(({ row }) => row.id)) ??
        Promise.resolve(new Map<string, AdminSupersededCheckoutReview>()),
    ]);
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
        null,
        reviews.get(candidate.row.id) ?? null,
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
            : query.paymentStatus === "partially_paid" || query.paymentStatus === "exempt"
              ? "paid"
              : query.paymentStatus,
        searchUsed: query.search.length > 0,
        resultCount: rows.length,
      });
      return file;
    },
    async markPaid(registrationId: string, adminUserId: string, receipt: ManualPaymentReceipt) {
      if (!repository.markPaid) throw new Error("Ação administrativa indisponível.");
      const result = await repository.markPaid(registrationId, adminUserId, receipt);
      // Payment truth is durable even if access provisioning is temporarily
      // unavailable; the admin can retry from the existing recovery action.
      await provisionParticipant?.(registrationId).catch(() => undefined);
      return result;
    },
    async markExempt(registrationId: string, adminUserId: string) {
      if (!repository.markExempt) throw new Error("Ação administrativa indisponível.");
      const result = await repository.markExempt(registrationId, adminUserId);
      await provisionParticipant?.(registrationId).catch(() => undefined);
      return result;
    },
    async getReceiptUrl(registrationId: string) {
      if (!repository.getReceiptUrl) throw new Error("Ação administrativa indisponível.");
      return repository.getReceiptUrl(registrationId);
    },
    async update(input: AdminUpdateRegistrationInput) {
      if (!repository.updateRegistration) throw new Error("Ação administrativa indisponível.");
      return repository.updateRegistration(input);
    },
  };

  async function listAllEnriched(
    query: AdminRegistrationExportQuery = { search: "", paymentStatus: "all" },
  ) {
    const candidates = await repository.listCandidates!(query.search);
    const complementIds = candidates
      .filter(({ row }) => row.payment_status === "paid" && row.pricing_type === "promotional")
      .map(({ row }) => row.id);
    const [payments, reviews] = await Promise.all([
      repository.listComplementPayments!(complementIds),
      repository.listSupersededCheckoutReviews?.(candidates.map(({ row }) => row.id)) ??
        Promise.resolve(new Map<string, AdminSupersededCheckoutReview>()),
    ]);
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
      enrichAdminRegistrationRow(
        candidate,
        byRegistration.get(candidate.row.id) ?? [],
        null,
        reviews.get(candidate.row.id) ?? null,
      ),
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
      async (registrationId) => {
        const { getParticipantProvisioningService } =
          await import("@/features/participant/participant-provisioning.server");
        return getParticipantProvisioningService().provision(registrationId);
      },
    );
  }
  return adminRegistrationService;
}
