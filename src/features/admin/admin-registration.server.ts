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
  type AdminRegistrationPdfExportQuery,
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
import { planManualPayment, type ManualPaymentRemainder } from "./admin-manual-payment.domain";

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
  "gender",
  "voice_part",
  "observations",
  "dietary_restriction",
  "dietary_restriction_types",
  "dietary_restriction_other",
  "uses_event_van",
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
  "manual_fee_pending_cents",
  "manual_discount_cents",
  "admin_registration_original_price_cents",
  "admin_payment_reason",
  "cancelled_at",
  "cancelled_by",
  "refund_cents",
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

const ID_CHUNK_SIZE = 200;

function parseComplementPayment(value: Record<string, unknown>): AdminComplementPaymentRow {
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
  return ({
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

function addSupersededReview(
  reviews: Map<string, AdminSupersededCheckoutReview>,
  value: Record<string, unknown>,
): void {
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

function matchesAdminRegistrationFilters(
  row: Pick<AdminRegistrationRow, "choirId" | "musicalProfile">,
  query: Pick<AdminRegistrationQuery, "choirId" | "musicalProfile">,
): boolean {
  if (query.choirId === "other") {
    if (row.choirId !== null) return false;
  } else if (query.choirId !== "all" && row.choirId !== query.choirId) {
    return false;
  }
  if (
    query.musicalProfile !== "all" &&
    (row.musicalProfile ?? null) !== query.musicalProfile
  ) {
    return false;
  }
  return true;
}

function registrationSearchFilter(search: string): string {
  // SQL LIKE escaping must survive the PostgREST quoted-value parser.
  const cpfSearch = search.replace(/\D/g, "");
  return ["name", "badge_name", "cpf", "choir_name", "email", "phone", "city", "institution"]
    .map((column) => {
      const value = column === "cpf" && cpfSearch ? cpfSearch : search;
      const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
      const quoted = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
      return `${column}.ilike.${quoted}`;
    })
    .join(",");
}

export type AdminExportAuditEvent = {
  format?: "csv" | "pdf";
  adminUserId: string;
  paymentStatusFilter: "pending" | "paid" | "legacy" | null;
  searchUsed: boolean;
  resultCount: number;
};

export type AdminManualPaymentOptions = {
  amountCents?: number;
  remainder?: ManualPaymentRemainder;
  originalRegistrationPriceCents?: number;
  rafflePaidCents?: number;
  reason?: string;
};

export type AdminManualPaymentResult = {
  status: "paid";
  registrationId: string;
  receivedCents?: number;
  pendingCents?: number;
  discountCents?: number;
};

export type AdminRegistrationSnapshot = {
  candidates: AdminRegistrationCandidate[];
  payments: AdminComplementPaymentRow[];
  reviews: Map<string, AdminSupersededCheckoutReview>;
  loggedInIds: Set<string>;
};

export type AdminRegistrationRepository = {
  listSnapshot?(search: string): Promise<AdminRegistrationSnapshot>;
  listLoggedInRegistrationIds?(): Promise<Set<string>>;
  listCandidates?(search: string): Promise<AdminRegistrationCandidate[]>;
  listComplementPayments?(registrationIds: string[]): Promise<AdminComplementPaymentRow[]>;
  listSupersededCheckoutReviews?(
    registrationIds: string[],
  ): Promise<Map<string, AdminSupersededCheckoutReview>>;
  signPhotos?(rows: AdminRegistrationRow[]): Promise<AdminRegistrationRow[]>;
  signPhotosForIds?(registrationIds: string[]): Promise<Record<string, string>>;
  list(
    query: AdminRegistrationQuery,
    options?: { includePhotos?: boolean },
  ): Promise<AdminRegistrationPage>;
  listAll(query: AdminRegistrationExportQuery): Promise<AdminRegistrationRow[]>;
  recordExport(event: AdminExportAuditEvent): Promise<void>;
  markPaid?: (
    registrationId: string,
    adminUserId: string,
    receipt: ManualPaymentReceipt | undefined,
    payment?: AdminManualPaymentOptions,
  ) => Promise<AdminManualPaymentResult>;
  markExempt?: (
    registrationId: string,
    adminUserId: string,
  ) => Promise<{ status: "exempt"; registrationId: string }>;
  cancel?: (
    registrationId: string,
    adminUserId: string,
    refundCents: number,
  ) => Promise<{ status: "cancelled"; registrationId: string; refundCents: number }>;
  getReceiptUrl?(registrationId: string): Promise<{ signedUrl: string; expiresIn: number }>;
  updateRegistration?(
    input: AdminUpdateRegistrationInput,
  ): Promise<{ status: "updated"; registrationId: string }>;
};

export function parseAdminRegistrationSnapshot(value: unknown): AdminRegistrationSnapshot {
  const data = (value ?? {}) as {
    registrations?: Array<
      RegistrationDatabaseRow & {
        participant_accounts?: Array<{ access_status: "active" | "pending" | "conflict" }>;
        regent_name?: string | null;
        has_logged_in?: boolean;
      }
    >;
    complements?: Array<Record<string, unknown>>;
    reviews?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(data.registrations)) throw new Error("Não foi possível consultar as inscrições.");
  const loggedInIds = new Set<string>();
  const candidates = data.registrations.map((record) => {
    if (record.has_logged_in === true) loggedInIds.add(record.id);
    const { participant_accounts, regent_name, has_logged_in: _login, ...row } = record;
    return {
      row: row as RegistrationDatabaseRow,
      accountStatus: participant_accounts?.[0]?.access_status ?? null,
      regentName: regent_name || null,
    };
  });
  const reviews = new Map<string, AdminSupersededCheckoutReview>();
  for (const review of data.reviews ?? []) addSupersededReview(reviews, review);
  return {
    candidates,
    payments: (data.complements ?? []).map(parseComplementPayment),
    reviews,
    loggedInIds,
  };
}

export function createSupabaseAdminRegistrationRepository(
  options: { snapshot?: boolean } = {},
): AdminRegistrationRepository {
  const repository: AdminRegistrationRepository = {
    ...(options.snapshot
      ? {
          async listSnapshot(search: string) {
            const { data, error } = await supabaseAdmin.rpc("admin_registration_snapshot", {
              p_search: search,
            });
            if (error) throw new Error("Não foi possível consultar as inscrições.");
            return parseAdminRegistrationSnapshot(data);
          },
        }
      : {}),
    async listLoggedInRegistrationIds() {
      const loggedInUsers = new Set<string>();
      for (let page = 1; ; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data) throw new Error("Não foi possível consultar os acessos ao app. Tente novamente.");
        for (const user of data.users) {
          if (user.last_sign_in_at) loggedInUsers.add(user.id);
        }
        if (data.users.length === 0) break;
      }
      const loggedInRegistrations = new Set<string>();
      for (let start = 0; ; start += 1000) {
        const { data, error } = await supabaseAdmin
          .from("participant_accounts")
          .select("id,registration_id,user_id")
          .order("id", { ascending: true })
          .range(start, start + 999);
        if (error || !data) throw new Error("Não foi possível consultar os acessos ao app. Tente novamente.");
        for (const account of data) {
          if (account.user_id && loggedInUsers.has(account.user_id)) {
            loggedInRegistrations.add(account.registration_id);
          }
        }
        if (data.length < 1000) return loggedInRegistrations;
      }
    },
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
        candidates.push(
          ...records.map((record) => ({
            row: record,
            accountStatus: record.participant_accounts?.[0]?.access_status ?? null,
            regentName: null as string | null,
          })),
        );
        if (records.length < 1000) {
          const regentNames = await fetchActiveRegentNames(
            candidates.map(({ row }) => row.choir_id ?? "").filter(Boolean),
          );
          for (const candidate of candidates) {
            candidate.regentName =
              (candidate.row.choir_id && regentNames.get(candidate.row.choir_id)) || null;
          }
          return candidates;
        }
      }
    },
    async listComplementPayments(registrationIds) {
      if (registrationIds.length === 0) return [];
      const rows: AdminComplementPaymentRow[] = [];
      const chunks: string[][] = [];
      for (let offset = 0; offset < registrationIds.length; offset += ID_CHUNK_SIZE) {
        chunks.push(registrationIds.slice(offset, offset + ID_CHUNK_SIZE));
      }
      const responses = await Promise.all(
        chunks.map((ids) =>
          supabaseAdmin
            .from("registration_complement_payments")
            .select(complementPaymentColumns)
            .in("registration_id", ids)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false }),
        ),
      );
      for (const { data, error } of responses) {
        if (error) throw new Error("Não foi possível consultar o histórico financeiro.");
        for (const value of (data ?? []) as Array<Record<string, unknown>>) {
          rows.push(parseComplementPayment(value));
        }
      }
      return rows;
    },
    async listSupersededCheckoutReviews(registrationIds) {
      const reviews = new Map<string, AdminSupersededCheckoutReview>();
      const chunks: string[][] = [];
      for (let offset = 0; offset < registrationIds.length; offset += ID_CHUNK_SIZE) {
        chunks.push(registrationIds.slice(offset, offset + ID_CHUNK_SIZE));
      }
      const responses = await Promise.all(
        chunks.map((ids) =>
          supabaseAdmin
            .from("registration_superseded_checkouts")
            .select(supersededCheckoutReviewColumns)
            .in("registration_id", ids)
            .eq("status", "paid_requires_review")
            .order("paid_at", { ascending: false })
            .order("id", { ascending: false }),
        ),
      );
      for (const { data, error } of responses) {
        if (error) {
          throw new Error("Não foi possível consultar pagamentos de checkouts substituídos.");
        }
        for (const value of (data ?? []) as Array<Record<string, unknown>>) {
          addSupersededReview(reviews, value);
        }
      }
      return reviews;
    },
    async signPhotosForIds(registrationIds) {
      const urls: Record<string, string> = {};
      if (registrationIds.length === 0) return urls;
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .select("id,photo_path")
        .in("id", registrationIds);
      if (error) throw new Error("Não foi possível carregar as fotos.");
      const byPath = new Map<string, string[]>();
      for (const row of data ?? []) {
        if (!row.photo_path) continue;
        byPath.set(row.photo_path, [...(byPath.get(row.photo_path) ?? []), row.id]);
      }
      if (byPath.size === 0) return urls;
      const { data: signed } = await supabaseAdmin.storage
        .from(REGISTRATION_PHOTO_BUCKET)
        .createSignedUrls([...byPath.keys()], PHOTO_URL_EXPIRY_SECONDS);
      for (const item of signed ?? []) {
        if (!item.path || !item.signedUrl || item.error) continue;
        for (const id of byPath.get(item.path) ?? []) urls[id] = item.signedUrl;
      }
      return urls;
    },
    async signPhotos(rows) {
      const paths = rows.map(
        (row) => (row as AdminRegistrationRow & { _photoPath?: string | null })._photoPath ?? null,
      );
      const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
      const urls = new Map<string, string>();
      if (unique.length > 0) {
        const { data } = await supabaseAdmin.storage
          .from(REGISTRATION_PHOTO_BUCKET)
          .createSignedUrls(unique, PHOTO_URL_EXPIRY_SECONDS);
        for (const item of data ?? []) {
          if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
        }
      }
      return rows.map((row, index) => ({
        ...row,
        photoUrl: (paths[index] && urls.get(paths[index])) || null,
      }));
    },
    async list(query: AdminRegistrationQuery, options = {}): Promise<AdminRegistrationPage> {
      if (query.loginStatus && query.loginStatus !== "all") {
        return createAdminRegistrationService(repository, () => new Date()).list(query, options.includePhotos ?? true);
      }
      let request = supabaseAdmin
        .from("registrations")
        .select(adminRegistrationColumns, { count: "exact" });
      if (query.paymentStatus === "cancelled") {
        request = request.not("cancelled_at", "is", null);
      } else if (query.paymentStatus !== "all") {
        request = request
          .eq("payment_status", query.paymentStatus)
          .is("cancelled_at", null);
      }
      if (query.choirId === "other") {
        request = request.is("choir_id", null);
      } else if (query.choirId !== "all") {
        request = request.eq("choir_id", query.choirId);
      }
      if (query.musicalProfile !== "all")
        request = request.eq("musical_profile", query.musicalProfile);
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
        event_type: event.format === "pdf" ? "registrations.export_pdf" : "registrations.export_csv",
        payment_status_filter: event.paymentStatusFilter,
        search_used: event.searchUsed,
        result_count: event.resultCount,
      });
      if (error) throw new Error("Não foi possível registrar a exportação.");
    },
    async markPaid(registrationId, adminUserId, receipt, payment = {}) {
      const { data: current, error: readError } = await supabaseAdmin
        .from("registrations")
        .select(
          "id,amount_cents,paid_amount_cents,payment_status,payment_origin,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents,include_shirt,shirt_price_cents,manual_fee_pending_cents,manual_discount_cents,admin_registration_original_price_cents,admin_raffle_paid_cents,admin_payment_reason,is_free_registration,manual_receipt_path,order_nsu,paid_at",
        )
        .eq("id", registrationId)
        .maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a inscrição.");
      if (!current) throw new Error("Inscrição não encontrada.");
      const originalRegistrationPriceCents =
        payment.originalRegistrationPriceCents ?? current.admin_registration_original_price_cents;
      const isRestoringExemption = current.payment_origin === "exemption";
      const registrationPriceCents = isRestoringExemption
        ? originalRegistrationPriceCents ?? current.registration_price_cents
        : current.registration_price_cents;
      const standardPriceCents = isRestoringExemption
        ? (originalRegistrationPriceCents ?? current.registration_price_cents ?? 0) +
          (current.remaining_price_cents ?? 0)
        : current.standard_price_cents;
      const plan = planManualPayment(
        {
          paymentStatus: current.payment_status,
          paymentOrigin: current.payment_origin,
          amountCents: current.amount_cents,
          paidAmountCents: current.paid_amount_cents,
          pricingType: current.pricing_type,
          standardPriceCents,
          registrationPriceCents,
          feePendingCents: current.manual_fee_pending_cents,
          discountCents: current.manual_discount_cents,
          originalRegistrationPriceCents,
        },
        payment.amountCents,
        payment.remainder,
      );

      const parsedReceipt = receipt ? parseManualReceipt(receipt) : null;
      const receiptPath = parsedReceipt
        ? `${registrationId}/${crypto.randomUUID()}.${receiptExtension(parsedReceipt.parsed.mimeType)}`
        : null;
      const storage = supabaseAdmin.storage.from(MANUAL_PAYMENT_RECEIPT_BUCKET);
      if (parsedReceipt && receiptPath) {
        const { error: uploadError } = await storage.upload(receiptPath, parsedReceipt.bytes, {
          cacheControl: "31536000",
          contentType: parsedReceipt.parsed.mimeType,
          upsert: false,
        });
        if (uploadError) throw new Error("Não foi possível enviar o comprovante.");
      }

      const paidAt = new Date().toISOString();
      try {
        const totalExemption = plan.update.paid_amount_cents === 0 && plan.pendingCents === 0;
        const oldReceiptPath = current.manual_receipt_path;
        const receiptFields = {
          manual_paid_by: totalExemption ? null : adminUserId,
          ...(parsedReceipt && receiptPath ? {
            manual_receipt_path: receiptPath,
            manual_receipt_file_name: parsedReceipt.parsed.fileName,
            manual_receipt_mime_type: parsedReceipt.parsed.mimeType,
            manual_receipt_size_bytes: parsedReceipt.bytes.byteLength,
          } : {}),
        };
        const originalPrice =
          originalRegistrationPriceCents ??
          current.admin_registration_original_price_cents ??
          (current.registration_price_cents ?? 0) +
            (current.manual_fee_pending_cents ?? 0) +
            (current.manual_discount_cents ?? 0);
        const sharedChanges = {
          ...plan.update,
          ...receiptFields,
          admin_registration_original_price_cents: originalPrice,
          admin_raffle_paid_cents:
            payment.rafflePaidCents !== undefined ? payment.rafflePaidCents : current.admin_raffle_paid_cents,
          admin_payment_reason: payment.reason?.trim() || null,
          payment_status: "paid",
          is_free_registration: current.is_free_registration && (originalPrice === 0),
          ...(!current.include_shirt ? { shirt_price_cents: null } : {}),
          checkout_url: null,
          infinitepay_invoice_slug: null,
          infinitepay_transaction_nsu: null,
          payment_method: null,
          installments: null,
          receipt_url: null,
        };
        const changes = totalExemption
          ? {
              ...sharedChanges,
              payment_origin: "exemption",
              exempted_by: adminUserId,
              exempted_at: paidAt,
              amount_cents: 0,
              paid_amount_cents: 0,
              standard_price_cents: current.remaining_price_cents ?? 0,
              registration_price_cents: 0,
              shirt_price_cents: current.include_shirt ? 0 : null,
              order_nsu: null,
              paid_at: null,
            }
          : {
              ...sharedChanges,
              payment_origin: "manual",
              exempted_by: null,
              exempted_at: null,
              order_nsu: current.order_nsu ?? crypto.randomUUID(),
              paid_at: paidAt,
            };
        let request = supabaseAdmin
          .from("registrations")
          .update(changes)
          .eq("id", registrationId)
          .eq("payment_status", current.payment_status);
        request =
          current.amount_cents === null
            ? request.is("amount_cents", null)
            : request.eq("amount_cents", current.amount_cents);
        const { data, error } = await request.select("id").maybeSingle();
        if (error || !data) {
          throw new Error("Não foi possível marcar a inscrição como paga.");
        }
        if (receiptPath && oldReceiptPath && oldReceiptPath !== receiptPath) {
          await storage.remove([oldReceiptPath]).catch(() => undefined);
        }
        return {
          status: "paid",
          registrationId: data.id,
          receivedCents: plan.receivedCents,
          pendingCents: plan.pendingCents,
          discountCents: plan.discountCents,
        };
      } catch (error) {
        if (receiptPath) await storage.remove([receiptPath]).catch(() => undefined);
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
    async cancel(registrationId, adminUserId, refundCents) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_by: adminUserId,
          refund_cents: refundCents,
        })
        .eq("id", registrationId)
        .is("cancelled_at", null)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error(
          error?.message.includes("cancelled_at")
            ? "Inscrição já cancelada."
            : "Não foi possível cancelar a inscrição.",
        );
      }
      return { status: "cancelled", registrationId: data.id, refundCents };
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
      if (!choirName) throw new Error("Selecione um coro ou informe outro coro.");

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
          gender: input.gender,
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
  async function loadLoginFilter(query: AdminRegistrationExportQuery) {
    if (!query.loginStatus || query.loginStatus === "all") return null;
    if (!repository.listLoggedInRegistrationIds) {
      throw new Error("Não foi possível consultar os acessos ao app. Tente novamente.");
    }
    return repository.listLoggedInRegistrationIds();
  }

  function matchesLoginFilter(row: AdminRegistrationRow, query: AdminRegistrationExportQuery, ids: Set<string> | null) {
    return ids === null || ids.has(row.id) === (query.loginStatus === "has");
  }

  /**
   * Loads every input the derived listing needs. With a snapshot-capable
   * repository this is a single database round trip (registrations, accounts,
   * regents, logins, complements and superseded reviews).
   */
  async function loadDataset(query: AdminRegistrationExportQuery) {
    const wantsLogin = Boolean(query.loginStatus && query.loginStatus !== "all");
    if (repository.listSnapshot) {
      const snapshot = await repository.listSnapshot(query.search);
      return { ...snapshot, loggedInIds: wantsLogin ? snapshot.loggedInIds : null };
    }
    if (!repository.listCandidates || !repository.listComplementPayments) {
      throw new Error("Não foi possível consultar as inscrições.");
    }
    const [candidates, loggedInIds] = await Promise.all([
      repository.listCandidates(query.search),
      loadLoginFilter(query),
    ]);
    // Only paid promotional registrations can have a meaningful complement.
    const complementIds = candidates
      .filter(({ row }) => row.payment_status === "paid" && row.pricing_type === "promotional")
      .map(({ row }) => row.id);
    const [payments, reviews] = await Promise.all([
      repository.listComplementPayments(complementIds),
      repository.listSupersededCheckoutReviews?.(candidates.map(({ row }) => row.id)) ??
        Promise.resolve(new Map<string, AdminSupersededCheckoutReview>()),
    ]);
    return { candidates, loggedInIds, payments, reviews };
  }

  async function listEnriched(query: AdminRegistrationQuery, includePhotos: boolean) {
    if (!repository.listSnapshot && (!repository.listCandidates || !repository.listComplementPayments)) {
      return repository.list(query, { includePhotos });
    }
    const { candidates, loggedInIds, payments, reviews } = await loadDataset(query);
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
    const filtered = enriched.filter(
      (row) =>
        matchesAdminRegistrationFilters(row, query) &&
        matchesLoginFilter(row, query, loggedInIds) &&
        (query.paymentStatus === "all" ||
          (query.paymentStatus === "cancelled"
            ? Boolean(row.cancelledAt)
            : !row.cancelledAt && row.financialState?.status === query.paymentStatus)),
    );
    const start = (query.page - 1) * query.pageSize;
    const pageRows = filtered.slice(start, start + query.pageSize);
    const signed =
      includePhotos && repository.signPhotos ? await repository.signPhotos(pageRows) : pageRows;
    return { rows: signed, total: filtered.length, page: query.page, pageSize: query.pageSize };
  }

  return {
    list: (query: AdminRegistrationQuery, includePhotos = true) => listEnriched(query, includePhotos),
    /** Photos load after the list so signing never delays the table. */
    async photoUrls(registrationIds: string[]) {
      if (!repository.signPhotosForIds) return {};
      return repository.signPhotosForIds(registrationIds);
    },
    async summary(): Promise<AdminRegistrationSummary> {
      const completeRows =
        repository.listCandidates && repository.listComplementPayments
          ? await listAllEnriched()
          : await repository.listAll({
              search: "",
              paymentStatus: "all",
              choirId: "all",
              musicalProfile: "all",
            });
      return summarizeAdminRegistrations(completeRows);
    },
    async lodgingRows(): Promise<AdminRegistrationRow[]> {
      const query = {
        search: "",
        paymentStatus: "all",
        choirId: "all",
        musicalProfile: "all",
      } as const;
      return repository.listCandidates && repository.listComplementPayments
        ? listAllEnriched(query)
        : repository.listAll(query);
    },
    async financeRows(): Promise<AdminRegistrationRow[]> {
      return repository.listCandidates && repository.listComplementPayments
        ? listAllEnriched()
        : repository.listAll({ search: "", paymentStatus: "all", choirId: "all", musicalProfile: "all" });
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
          query.paymentStatus === "all" || query.paymentStatus === "cancelled"
            ? null
            : query.paymentStatus === "partially_paid" || query.paymentStatus === "exempt"
              ? "paid"
              : query.paymentStatus,
        searchUsed: query.search.length > 0,
        resultCount: rows.length,
      });
      return file;
    },
    async exportPdf(query: AdminRegistrationPdfExportQuery, adminUserId: string) {
      const matchingRows = repository.listCandidates && repository.listComplementPayments
        ? await listAllEnriched(query) : await repository.listAll(query);
      const rows = query.choirName === undefined ? matchingRows
        : matchingRows.filter((row) => row.choirName === query.choirName);
      const { buildRegistrationsPdf } = await import("./admin-registration-pdf");
      const file = await buildRegistrationsPdf(rows, query, now());
      await repository.recordExport({
        format: "pdf", adminUserId,
        paymentStatusFilter: query.paymentStatus === "all" || query.paymentStatus === "cancelled" ? null
          : query.paymentStatus === "partially_paid" || query.paymentStatus === "exempt" ? "paid" : query.paymentStatus,
        searchUsed: query.search.length > 0, resultCount: rows.length,
      });
      return file;
    },
    async markPaid(
      registrationId: string,
      adminUserId: string,
      receipt: ManualPaymentReceipt | undefined,
      payment: AdminManualPaymentOptions = {},
    ) {
      if (!repository.markPaid) throw new Error("Ação administrativa indisponível.");
      const result = await repository.markPaid(registrationId, adminUserId, receipt, payment);
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
    async cancel(registrationId: string, adminUserId: string, refundCents: number) {
      if (!repository.cancel) throw new Error("Ação administrativa indisponível.");
      return repository.cancel(registrationId, adminUserId, refundCents);
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
    query: AdminRegistrationExportQuery = {
      search: "",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
    },
  ) {
    const { candidates, loggedInIds, payments, reviews } = await loadDataset(query);
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
    return rows.filter(
      (row) =>
        matchesAdminRegistrationFilters(row, query) &&
        matchesLoginFilter(row, query, loggedInIds) &&
        (query.paymentStatus === "all" ||
          (query.paymentStatus === "cancelled"
            ? Boolean(row.cancelledAt)
            : !row.cancelledAt && row.financialState?.status === query.paymentStatus)),
    );
  }
}

let adminRegistrationService: ReturnType<typeof createAdminRegistrationService> | undefined;

export function getAdminRegistrationService() {
  if (!adminRegistrationService) {
    adminRegistrationService = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository({ snapshot: true }),
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
