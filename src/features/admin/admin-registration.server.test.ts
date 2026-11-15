import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationDatabaseRow } from "./admin.domain";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: (_table: string): unknown => {
      throw new Error("Unconfigured Supabase boundary");
    },
    storage: undefined as unknown,
    rpc: undefined as unknown,
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseAdminMock }));

import {
  createAdminRegistrationService,
  createSupabaseAdminRegistrationRepository,
  getAdminRegistrationService,
  parseAdminRegistrationSnapshot,
} from "./admin-registration.server";
import { PDFDocument } from "pdf-lib";

const expectedColumns =
  "id,created_at,name,badge_name,cpf,birth_date,diocese,choir_name,choir_id,other_choir_name,email,phone,city,institution,role,musical_profile,voice_part,observations,include_shirt,shirt_size,shirt_price_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents,amount_cents,paid_amount_cents,payment_status,payment_method,installments,paid_at,payment_origin,is_free_registration,manual_receipt_path,manual_receipt_file_name,manual_receipt_mime_type,manual_receipt_size_bytes,manual_fee_pending_cents,manual_discount_cents,photo_path,participant_accounts(access_status)";
const selectedRow = {
  id: "registration-1",
  created_at: "2026-09-07T12:00:00Z",
  name: "Maria",
  badge_name: "Maria",
  cpf: "52998224725",
  birth_date: "1990-01-02",
  diocese: "Diocese de Quixadá",
  choir_name: "Diocese de Quixadá",
  other_choir_name: null,
  email: "maria@example.com",
  phone: "85999999999",
  city: "Fortaleza",
  institution: null,
  role: "Corista",
  musical_profile: "coralista",
  voice_part: "soprano",
  observations: "Sem restrições.",
  include_shirt: false,
  shirt_size: null,
  shirt_price_cents: null,
  pricing_type: "standard",
  standard_price_cents: 3000,
  registration_price_cents: 3000,
  remaining_price_cents: null,
  amount_cents: 3000,
  paid_amount_cents: 3000,
  payment_status: "paid",
  payment_method: "pix",
  installments: 1,
  paid_at: "2026-09-07T13:00:00Z",
} satisfies Partial<RegistrationDatabaseRow>;

type ResultRow = typeof selectedRow & { photo_path?: string | null };
type DatabaseResult = {
  data: unknown;
  error: { message: string; details: string; hint: string; code: string } | null;
  count: number | null;
  status: number;
  statusText: string;
};
const success = (data: ResultRow[], count = data.length): DatabaseResult => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: "OK",
});
const singleSuccess = (data: unknown): DatabaseResult => ({
  data,
  error: null,
  count: 1,
  status: 200,
  statusText: "OK",
});

describe("registration export", () => {
  const now = () => new Date("2026-09-08T01:00:00Z");
  const auditSuccess: DatabaseResult = {
    data: null,
    error: null,
    count: null,
    status: 201,
    statusText: "Created",
  };

  it("reads 1,005 registrations in ordered batches of 1,000 before appending one audit event and returning real CSV", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => ({
      ...selectedRow,
      id: `row-${index}`,
      name: `Maria ${index}`,
      badge_name: `Maria ${index}`,
    }));
    const last = Array.from({ length: 5 }, (_, index) => ({
      ...selectedRow,
      id: `row-${1000 + index}`,
      name: `Maria ${1000 + index}`,
      badge_name: `Maria ${1000 + index}`,
    }));
    const { trace } = databaseHarness([
      success(first, 1005),
      success(last, 1005),
      ...Array.from({ length: 6 }, () => success([])),
      auditSuccess,
    ]);
    const service = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      now,
    );
    const file = await service.export(
      { search: "Maria", paymentStatus: "paid", choirId: "all", musicalProfile: "all" },
      "user-1",
    );
    expect(trace.filter(([method]) => method === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
    expect(trace.filter(([method]) => method === "order")).toEqual([
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      // Superseded checkout reviews are read in parallel batches of 200 IDs.
      ...Array.from({ length: 6 }, () => [
        ["order", "paid_at", { ascending: false }],
        ["order", "id", { ascending: false }],
      ]).flat(),
    ]);
    // Payment filters are derived after candidate retrieval; no raw
    // payment_status predicate may hide partially-paid registrations.
    expect(
      trace.filter(([method, column]) => method === "eq" && column === "payment_status"),
    ).toEqual([]);
    expect(trace.filter(([method]) => method === "or")).toHaveLength(2);
    expect(trace.slice(-4)).toEqual([
      ["response", 200],
      ["from", "admin_access_events"],
      [
        "insert",
        {
          admin_user_id: "user-1",
          event_type: "registrations.export_csv",
          payment_status_filter: "paid",
          search_used: true,
          result_count: 1005,
        },
      ],
      ["response", 201],
    ]);
    expect(file.fileName).toBe("inscricoes-2026-09-07.csv");
    const lines = file.content.split("\r\n");
    expect(lines).toHaveLength(1006);
    expect(lines[0]).toBe(
      "\uFEFFData;Nome para o crachá;Nome completo;CPF;Coro/Diocese;E-mail;Telefone;Cidade;Instituição;Função;Situação;Tipo do valor;Valor normal;Valor da inscrição;Valor esperado;Valor pago;Forma de pagamento;Parcelas;Pago em",
    );
    expect(lines[1]).toBe(
      "07/09/2026;Maria 0;Maria 0;529.982.247-25;Diocese de Quixadá;maria@example.com;85999999999;Fortaleza;Não informado;Corista;Pago;Normal;R$ 30,00;R$ 30,00;R$ 30,00;R$ 30,00;Pix;1;07/09/2026",
    );
    expect(lines[1000]).toContain(";Maria 999;");
    expect(lines[1001]).toContain(";Maria 1000;");
    expect(lines[1005]).toContain(";Maria 1004;");
  });

  it("exports and audits an empty result with no search and all statuses", async () => {
    const { trace } = databaseHarness([success([]), auditSuccess]);
    const file = await createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      now,
    ).export(
      { search: "", paymentStatus: "all", choirId: "all", musicalProfile: "all" },
      "user-1",
    );
    expect(file.content.split("\r\n")).toHaveLength(1);
    expect(trace).toContainEqual([
      "insert",
      {
        admin_user_id: "user-1",
        event_type: "registrations.export_csv",
        payment_status_filter: null,
        search_used: false,
        result_count: 0,
      },
    ]);
    expect(trace.filter(([method]) => method === "range")).toEqual([["range", 0, 999]]);
  });

  it.each(["first", "later"])(
    "does not audit or return a partial CSV when the %s batch fails",
    async (batch) => {
      const results =
        batch === "first"
          ? [failure]
          : [
              success(
                Array.from({ length: 1000 }, () => selectedRow),
                1005,
              ),
              failure,
            ];
      const { trace } = databaseHarness(results);
      await expect(
        createAdminRegistrationService(createSupabaseAdminRegistrationRepository(), now).export(
          { search: "Maria", paymentStatus: "paid", choirId: "all", musicalProfile: "all" },
          "user-1",
        ),
      ).rejects.toThrow("Não foi possível consultar as inscrições.");
      expect(trace.some(([method]) => method === "insert")).toBe(false);
      expect(trace).not.toContainEqual(["from", "admin_access_events"]);
    },
  );

  it("rejects with a generic error instead of returning CSV when audit insertion fails", async () => {
    const { trace } = databaseHarness([success([selectedRow]), success([]), failure]);
    await expect(
      createAdminRegistrationService(createSupabaseAdminRegistrationRepository(), now).export(
        { search: "", paymentStatus: "paid", choirId: "all", musicalProfile: "all" },
        "user-1",
      ),
    ).rejects.toThrow("Não foi possível registrar a exportação.");
    expect(trace).toContainEqual(["from", "admin_access_events"]);
  });

  it("lazily exposes the production service and loads the listing in one database call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { registrations: [], complements: [], reviews: [] },
      error: null,
    });
    supabaseAdminMock.rpc = rpc;
    const { trace } = databaseHarness([]);
    const service = getAdminRegistrationService();
    expect(rpc).not.toHaveBeenCalled();
    await expect(
      service.list({
        search: "Maria",
        paymentStatus: "pending",
        choirId: "all",
        musicalProfile: "all",
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toEqual({ rows: [], total: 0, page: 1, pageSize: 10 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_registration_snapshot", { p_search: "Maria" });
    expect(trace).toEqual([]);
  });

  it("maps the snapshot into candidates, login evidence, complements and reviews", () => {
    const snapshot = parseAdminRegistrationSnapshot({
      registrations: [
        { ...selectedRow, id: "a", participant_accounts: [{ access_status: "active" }], regent_name: "Ana", has_logged_in: true },
        { ...selectedRow, id: "b", participant_accounts: [], regent_name: null, has_logged_in: false },
      ],
      complements: [
        {
          id: "c1", registration_id: "a", amount_cents: 5000, status: "paid", checkout_url: null,
          created_at: "2026-11-01T00:00:00Z", paid_at: null, initiated_by_name: "Ana", initiated_as: "regent",
        },
      ],
      reviews: [],
    });
    expect(snapshot.candidates.map((c) => [c.row.id, c.accountStatus, c.regentName])).toEqual([
      ["a", "active", "Ana"],
      ["b", null, null],
    ]);
    expect([...snapshot.loggedInIds]).toEqual(["a"]);
    expect(snapshot.payments).toHaveLength(1);
    expect(snapshot.candidates[0]?.row).not.toHaveProperty("has_logged_in");
  });
});

describe("manual payment confirmation", () => {
  const receipt = {
    base64: "JVBERi0xLjQK",
    mimeType: "application/pdf" as const,
    fileName: "comprovante.pdf",
  };

  it("uploads the receipt before marking a pending registration as paid", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    supabaseAdminMock.storage = {
      from: vi.fn().mockReturnValue({ upload, remove }),
    };
    const pendingRow = {
      ...selectedRow,
      payment_status: "pending",
      amount_cents: 10000,
      paid_amount_cents: null,
      payment_method: null,
      installments: null,
      paid_at: null,
      checkout_url: null,
    };
    const { trace } = databaseHarness([
      singleSuccess(pendingRow),
      singleSuccess({ id: pendingRow.id }),
    ]);

    await expect(
      createAdminRegistrationService(
        createSupabaseAdminRegistrationRepository(),
        () => new Date("2026-09-15T01:00:00Z"),
      ).markPaid("registration-1", "admin-1", receipt),
    ).resolves.toEqual({ status: "paid", registrationId: "registration-1", receivedCents: 10000, pendingCents: 0, discountCents: 0 });

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^registration-1\/.+\.pdf$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(trace).toContainEqual([
      "update",
      expect.objectContaining({
        payment_origin: "manual",
        manual_paid_by: "admin-1",
        manual_receipt_file_name: "comprovante.pdf",
        manual_receipt_mime_type: "application/pdf",
        manual_receipt_size_bytes: 9,
      }),
    ]);
  });

  it("marks a pending registration as paid with an auditable admin marker", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    supabaseAdminMock.storage = {
      from: vi.fn().mockReturnValue({ upload, remove }),
    };
    const pendingRow = {
      ...selectedRow,
      payment_status: "pending",
      amount_cents: 10000,
      paid_amount_cents: null,
      payment_method: null,
      installments: null,
      paid_at: null,
    };
    const { trace } = databaseHarness([
      singleSuccess(pendingRow),
      singleSuccess({ id: pendingRow.id }),
    ]);
    const service = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      () => new Date("2026-09-15T01:00:00Z"),
    );

    await expect(service.markPaid("registration-1", "admin-1", receipt)).resolves.toEqual({
      status: "paid",
      registrationId: "registration-1",
      receivedCents: 10000,
      pendingCents: 0,
      discountCents: 0,
    });
    expect(trace).toContainEqual([
      "update",
      expect.objectContaining({
        payment_status: "paid",
        payment_origin: "manual",
        manual_paid_by: "admin-1",
        infinitepay_invoice_slug: null,
        infinitepay_transaction_nsu: null,
        payment_method: null,
        installments: null,
        paid_amount_cents: 10000,
        receipt_url: null,
        manual_receipt_file_name: "comprovante.pdf",
        manual_receipt_mime_type: "application/pdf",
        manual_receipt_size_bytes: 9,
        paid_at: expect.any(String),
        manual_receipt_path: expect.stringMatching(/^registration-1\/.+\.pdf$/),
      }),
    ]);
    expect(trace).toContainEqual(["eq", "payment_status", "pending"]);
  });

  it("manually confirms a pending registration with an active checkout", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    supabaseAdminMock.storage = {
      from: vi.fn().mockReturnValue({ upload, remove }),
    };
    const pendingRow = {
      ...selectedRow,
      payment_status: "pending",
      amount_cents: 10000,
      checkout_url: "https://checkout.infinitepay.com.br/active",
    };
    const { trace } = databaseHarness([
      singleSuccess(pendingRow),
      singleSuccess({ id: pendingRow.id }),
    ]);
    await expect(
      createAdminRegistrationService(
        createSupabaseAdminRegistrationRepository(),
        () => new Date(),
      ).markPaid("registration-1", "admin-1", receipt),
    ).resolves.toEqual({ status: "paid", registrationId: "registration-1", receivedCents: 10000, pendingCents: 0, discountCents: 0 });
    expect(trace).toContainEqual([
      "update",
      expect.objectContaining({
        payment_status: "paid",
        payment_origin: "manual",
        manual_paid_by: "admin-1",
        checkout_url: null,
      }),
    ]);
  });

  it("keeps the unpaid fee open after a partial manual payment", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    supabaseAdminMock.storage = {
      from: vi.fn().mockReturnValue({ upload, remove }),
    };
    const pendingRow = {
      ...selectedRow,
      payment_status: "pending",
      payment_origin: "infinitepay",
      pricing_type: "standard",
      standard_price_cents: 10000,
      registration_price_cents: 10000,
      amount_cents: 10000,
      paid_amount_cents: null,
      manual_fee_pending_cents: null,
      manual_discount_cents: null,
    };
    const { trace } = databaseHarness([
      singleSuccess(pendingRow),
      singleSuccess({ id: pendingRow.id }),
    ]);
    await expect(
      createAdminRegistrationService(
        createSupabaseAdminRegistrationRepository(),
        () => new Date(),
      ).markPaid("registration-1", "admin-1", receipt, { amountCents: 7000, remainder: "pending" }),
    ).resolves.toMatchObject({ status: "paid", receivedCents: 7000, pendingCents: 3000 });
    expect(trace).toContainEqual([
      "update",
      expect.objectContaining({
        payment_status: "paid",
        amount_cents: 7000,
        paid_amount_cents: 7000,
        registration_price_cents: 7000,
        standard_price_cents: 7000,
        manual_fee_pending_cents: 3000,
        manual_discount_cents: null,
      }),
    ]);
  });

  it("retries participant provisioning after a durable manual confirmation", async () => {
    const repository = {
      list: vi.fn(),
      listAll: vi.fn(),
      recordExport: vi.fn(),
      markPaid: vi.fn(async () => ({ status: "paid" as const, registrationId: "registration-1" })),
    };
    const provisionParticipant = vi.fn(async () => ({ status: "active" as const }));
    await expect(
      createAdminRegistrationService(repository, () => new Date(), provisionParticipant).markPaid(
        "registration-1",
        "admin-1",
        receipt,
      ),
    ).resolves.toEqual({ status: "paid", registrationId: "registration-1" });
    expect(provisionParticipant).toHaveBeenCalledWith("registration-1");
  });
});

describe("registration exemption", () => {
  it("zeros a pending registration, records the administrator and provisions access", async () => {
    const { trace } = databaseHarness([singleSuccess({ id: "registration-1" })]);
    const provisionParticipant = vi.fn(async () => ({ status: "active" as const }));
    const service = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      () => new Date(),
      provisionParticipant,
    );

    await expect(service.markExempt("registration-1", "admin-1")).resolves.toEqual({
      status: "exempt",
      registrationId: "registration-1",
    });
    expect(trace).toContainEqual([
      "update",
      expect.objectContaining({
        payment_status: "paid",
        payment_origin: "exemption",
        exempted_by: "admin-1",
        amount_cents: 0,
        paid_amount_cents: 0,
        standard_price_cents: 0,
        registration_price_cents: 0,
        remaining_price_cents: 0,
        shirt_price_cents: 0,
        checkout_url: null,
      }),
    ]);
    expect(trace).toContainEqual(["eq", "payment_status", "pending"]);
    expect(provisionParticipant).toHaveBeenCalledWith("registration-1");
  });
});

describe("registration summary", () => {
  it("counts 4 registrations but only 1 unpaid initial fee, excluding partial and exempt raffle obligations", async () => {
    const { mapAdminRegistrationRow } = await import("./admin.domain");
    const states = [
      { status: "pending", pendingCents: 20000, confirmedPrincipalCents: 0 },
      { status: "paid", pendingCents: 0, confirmedPrincipalCents: 20000 },
      { status: "partially_paid", pendingCents: 20000, confirmedPrincipalCents: 10000 },
      { status: "exempt", pendingCents: 0, confirmedPrincipalCents: 0 },
    ] as const;
    const rows = states.map((financialState, i) => ({
      ...mapAdminRegistrationRow({ ...selectedRow, id: `count-${i}` } as RegistrationDatabaseRow),
      financialState,
    }));
    const service = createAdminRegistrationService({ list: vi.fn(), listAll: vi.fn().mockResolvedValue(rows), recordExport: vi.fn() }, () => new Date());
    expect(await service.summary()).toMatchObject({ total: 4, pending: 1, paid: 1, partiallyPaid: 1, exempt: 1 });
  });
  // Detects a production mutation that applies the table's active filters to the top-level totals.
  it("summarizes the complete unfiltered registration collection", async () => {
    const repository = {
      async list() {
        throw new Error("Unexpected paginated list");
      },
      async listAll(query: { search: string; paymentStatus: string }) {
        if (query.search || query.paymentStatus !== "all") {
          throw new Error("Summary received table filters");
        }
        return [
          {
            ...selectedRow,
            createdAt: selectedRow.created_at,
            badgeName: selectedRow.badge_name,
            birthDate: selectedRow.birth_date,
            otherChoirName: selectedRow.other_choir_name,
            voicePart: selectedRow.voice_part,
            includeShirt: selectedRow.include_shirt,
            shirtSize: selectedRow.shirt_size,
            shirtPriceCents: selectedRow.shirt_price_cents,
            email: selectedRow.email,
            city: selectedRow.city,
            paymentStatus: "paid" as const,
            amountCents: selectedRow.amount_cents,
            paidAmountCents: selectedRow.paid_amount_cents,
            paymentMethod: "pix" as const,
            installments: selectedRow.installments,
            paidAt: selectedRow.paid_at,
            choirName: "Diocese de Quixadá",
            pricingType: "standard" as const,
            standardPriceCents: 3000,
            registrationPriceCents: 3000,
            photoUrl: null,
            regentName: null,
          },
        ];
      },
      async recordExport() {
        throw new Error("Unexpected export audit");
      },
    };

    await expect(
      createAdminRegistrationService(repository, () => new Date()).summary(),
    ).resolves.toMatchObject({
      total: 1,
      paid: 1,
      pending: 0,
      legacy: 0,
      byChoir: [{ choirName: "Diocese de Quixadá", total: 1 }],
    });
  });
});

describe("derived registration listing", () => {
  it("exports all 35 members of the exact summary group across IDs and payment states, excluding similarly named choirs", async () => {
    const states = ["paid", "pending", "legacy", "partial", "exempt"];
    const candidates = Array.from({ length: 35 }, (_, i) => {
      const state = states[i % states.length];
      return { row: { ...selectedRow, id: `group-${i}`, choir_name: "Coro de Quixadá", choir_id: i % 2 ? null : "11111111-1111-4111-8111-111111111111", payment_status: state === "pending" || state === "legacy" ? state : "paid", payment_origin: state === "exempt" ? "exemption" : "infinitepay", pricing_type: state === "partial" ? "promotional" : "standard", amount_cents: 10000, registration_price_cents: 10000, standard_price_cents: state === "partial" ? 30000 : 10000 } as RegistrationDatabaseRow, accountStatus: null, regentName: null };
    });
    candidates.push({ row: { ...candidates[0]?.row, id: "excluded", choir_name: "Coro de Quixadá Jovem" } as RegistrationDatabaseRow, accountStatus: null, regentName: null });
    const repository = { listCandidates: vi.fn().mockResolvedValue(candidates), listComplementPayments: vi.fn().mockResolvedValue([]), list: vi.fn(), listAll: vi.fn(), recordExport: vi.fn() };
    const service = createAdminRegistrationService(repository, () => new Date("2026-10-19T22:00:00Z"));
    const file = await service.exportPdf({ search: "", choirId: "all", musicalProfile: "all", paymentStatus: "all", choirName: "Coro de Quixadá" }, "admin-1");
    expect(repository.recordExport).toHaveBeenCalledWith({ format: "pdf", adminUserId: "admin-1", paymentStatusFilter: null, searchUsed: false, resultCount: 35 });
    expect(file.fileName).toBe("inscricoes-coro-de-quixada-2026-10-19.pdf");
    expect((await PDFDocument.load(file.base64)).getPageCount()).toBeGreaterThan(1);
  });

  it("exports 30 matching PDF registrations with all active filters and audits the PDF format", async () => {
    const choirId = "11111111-1111-4111-8111-111111111111";
    const candidates = Array.from({ length: 30 }, (_, i) => ({
      row: { ...selectedRow, id: `pdf-${i}`, choir_id: choirId }, accountStatus: null, regentName: null,
    }));
    candidates.push({ row: { ...selectedRow, id: "wrong-choir", choir_id: "other" }, accountStatus: null, regentName: null });
    const repository = {
      listCandidates: vi.fn().mockResolvedValue(candidates),
      listComplementPayments: vi.fn().mockResolvedValue([]),
      listLoggedInRegistrationIds: vi.fn().mockResolvedValue(new Set(["wrong-choir"])),
      list: vi.fn(), listAll: vi.fn(), recordExport: vi.fn(),
    };
    const query = { search: "Maria", choirId, musicalProfile: "coralista", paymentStatus: "paid", loginStatus: "never" } as const;
    const file = await createAdminRegistrationService(repository, () => new Date("2026-10-19T22:00:00Z")).exportPdf(query, "admin-1");
    expect(repository.listCandidates).toHaveBeenCalledWith("Maria");
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.recordExport).toHaveBeenCalledWith({ format: "pdf", adminUserId: "admin-1", paymentStatusFilter: "paid", searchUsed: true, resultCount: 30 });
    expect((await PDFDocument.load(file.base64)).getPageCount()).toBeGreaterThan(1);
  });

  it("does not return a PDF when retrieval or auditing fails", async () => {
    const repository = { list: vi.fn(), listAll: vi.fn().mockRejectedValue(new Error("read failed")), recordExport: vi.fn() };
    const query = { search: "", choirId: "all", musicalProfile: "all", paymentStatus: "all" } as const;
    const service = createAdminRegistrationService(repository, () => new Date());
    await expect(service.exportPdf(query, "admin-1")).rejects.toThrow("read failed");
    expect(repository.recordExport).not.toHaveBeenCalled();
    repository.listAll.mockResolvedValue([]);
    repository.recordExport.mockRejectedValue(new Error("audit failed"));
    await expect(service.exportPdf(query, "admin-1")).rejects.toThrow("audit failed");
  });
  it("exports partial registrations while recording a database-compatible audit filter", async () => {
    const base = {
      ...selectedRow,
      amount_cents: 10000,
      paid_amount_cents: 10000,
      pricing_type: "promotional",
      standard_price_cents: 30000,
      registration_price_cents: 10000,
    } satisfies Partial<RegistrationDatabaseRow>;
    const recordExport = vi.fn(async (event: { paymentStatusFilter: string | null }) => {
      if (event.paymentStatusFilter !== "paid") {
        throw new Error("incompatible audit filter");
      }
    });
    const repository = {
      listCandidates: vi
        .fn()
        .mockResolvedValue([
          { row: { ...base, id: "partial-export" }, accountStatus: null, regentName: null },
        ]),
      listComplementPayments: vi.fn().mockResolvedValue([
        {
          id: "partial-export-complement",
          registrationId: "partial-export",
          amountCents: 8000,
          status: "paid" as const,
          checkoutUrl: null,
          createdAt: "2026-09-08T00:00:00Z",
          paidAt: "2026-09-08T01:00:00Z",
          initiatedByName: "Admin",
          initiatedAs: "admin" as const,
        },
      ]),
      recordExport,
      list: vi.fn(),
      listAll: vi.fn(),
    };

    await expect(
      createAdminRegistrationService(repository, () => new Date()).export(
        {
          search: "",
          paymentStatus: "partially_paid",
          choirId: "all",
          musicalProfile: "all",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ fileName: expect.stringContaining("inscricoes-") });
    expect(recordExport).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatusFilter: "paid", resultCount: 1 }),
    );
  });

  it("filters derived states before pagination and signs only the final page", async () => {
    const base = {
      ...selectedRow,
      amount_cents: 10000,
      paid_amount_cents: 10000,
      pricing_type: "promotional",
      standard_price_cents: 30000,
      registration_price_cents: 10000,
    } satisfies Partial<RegistrationDatabaseRow>;
    const candidates = [
      {
        row: { ...base, id: "partial" } as RegistrationDatabaseRow,
        accountStatus: null,
        regentName: null,
      },
      {
        row: {
          ...base,
          id: "paid",
          pricing_type: "standard",
          standard_price_cents: 10000,
          registration_price_cents: 10000,
          amount_cents: 10000,
        } as RegistrationDatabaseRow,
        accountStatus: null,
        regentName: null,
      },
    ];
    const repository = {
      listCandidates: vi.fn().mockResolvedValue(candidates),
      listComplementPayments: vi.fn().mockResolvedValue([
        {
          id: "complement",
          registrationId: "partial",
          amountCents: 8000,
          status: "paid" as const,
          checkoutUrl: null,
          createdAt: "2026-09-08T00:00:00Z",
          paidAt: "2026-09-08T01:00:00Z",
          initiatedByName: "Admin",
          initiatedAs: "admin" as const,
        },
      ]),
      signPhotos: vi.fn(async (rows) => rows),
      list: vi.fn(),
      listAll: vi.fn(),
      recordExport: vi.fn(),
    };
    const service = createAdminRegistrationService(repository, () => new Date());

    const page = await service.list({
      search: "Maria",
      paymentStatus: "partially_paid",
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 1,
    });
    expect(page.total).toBe(1);
    expect(page.rows[0].id).toBe("partial");
    expect(page.rows[0].financialState?.pendingCents).toBe(12000);
    expect(repository.listCandidates).toHaveBeenCalledWith("Maria");
    expect(repository.listComplementPayments).toHaveBeenCalledWith(["partial"]);
    expect(repository.signPhotos).toHaveBeenCalledWith([
      expect.objectContaining({ id: "partial" }),
    ]);
    expect(repository.signPhotos).toHaveBeenCalledOnce();
  });

  it.each([
    ["all", ["legacy", "pending", "partial", "paid", "standard"]],
    ["pending", ["pending"]],
    ["partially_paid", ["partial"]],
    ["paid", ["paid", "standard"]],
    ["legacy", ["legacy"]],
  ] as const)("applies the %s filter to derived state before paging", async (filter, expected) => {
    const make = (id: string, overrides: Partial<RegistrationDatabaseRow>) => ({
      row: { ...selectedRow, id, ...overrides } as RegistrationDatabaseRow,
      accountStatus: null,
      regentName: null,
    });
    const candidates = [
      make("legacy", {
        payment_status: "legacy",
        amount_cents: null,
        pricing_type: null,
        standard_price_cents: null,
        registration_price_cents: null,
      }),
      make("pending", {
        payment_status: "pending",
        amount_cents: 10000,
        pricing_type: "promotional",
        standard_price_cents: 30000,
        registration_price_cents: 10000,
      }),
      make("partial", {
        payment_status: "paid",
        amount_cents: 10000,
        pricing_type: "promotional",
        standard_price_cents: 30000,
        registration_price_cents: 10000,
      }),
      make("paid", {
        payment_status: "paid",
        amount_cents: 10000,
        pricing_type: "promotional",
        standard_price_cents: 30000,
        registration_price_cents: 10000,
      }),
      make("standard", {
        payment_status: "paid",
        amount_cents: 30000,
        pricing_type: "standard",
        standard_price_cents: 30000,
        registration_price_cents: 30000,
      }),
    ];
    const repository = {
      listCandidates: vi.fn().mockResolvedValue(candidates),
      listComplementPayments: vi.fn().mockResolvedValue([
        {
          id: "partial-c",
          registrationId: "partial",
          amountCents: 8000,
          status: "paid" as const,
          checkoutUrl: null,
          createdAt: "2026-09-01",
          paidAt: "2026-09-01",
          initiatedByName: "A",
          initiatedAs: "admin" as const,
        },
        {
          id: "paid-c",
          registrationId: "paid",
          amountCents: 20000,
          status: "paid" as const,
          checkoutUrl: null,
          createdAt: "2026-09-01",
          paidAt: "2026-09-01",
          initiatedByName: "A",
          initiatedAs: "admin" as const,
        },
      ]),
      signPhotos: vi.fn(async (rows) => rows),
      list: vi.fn(),
      listAll: vi.fn(),
      recordExport: vi.fn(),
    };
    const page = await createAdminRegistrationService(repository, () => new Date()).list({
      search: "",
      paymentStatus: filter,
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 100,
    });
    expect(page.rows.map((row) => row.id)).toEqual(expected);
    expect(page.total).toBe(expected.length);
  });

  it.each([
    ["all", ["choir-a", "other-b", "coral-c"]],
    ["other", ["other-b"]],
    ["98458155-7dc0-4ff5-8635-d1d4d908db94", ["choir-a"]],
  ] as const)("applies the choir filter %s before paging", async (filter, expected) => {
    const make = (id: string, choir_id: string | null, musical_profile: string | null) => ({
      row: { ...selectedRow, id, choir_id, musical_profile } as RegistrationDatabaseRow,
      accountStatus: null,
      regentName: null,
    });
    const candidates = [
      make("choir-a", "98458155-7dc0-4ff5-8635-d1d4d908db94", "regente"),
      make("other-b", null, "coralista"),
      make("coral-c", "4f6a4bd8-4db4-4a3d-97ad-5a2d8b06b741", "coralista"),
    ];
    const repository = {
      listCandidates: vi.fn().mockResolvedValue(candidates),
      listComplementPayments: vi.fn().mockResolvedValue([]),
      signPhotos: vi.fn(async (rows) => rows),
      list: vi.fn(),
      listAll: vi.fn(),
      recordExport: vi.fn(),
    };
    const page = await createAdminRegistrationService(repository, () => new Date()).list({
      search: "",
      paymentStatus: "all",
      choirId: filter,
      musicalProfile: "all",
      page: 1,
      pageSize: 100,
    });
    expect(page.rows.map((row) => row.id)).toEqual(expected);
    expect(page.total).toBe(expected.length);
  });

  it("applies the musical profile filter before paging", async () => {
    const make = (id: string, musical_profile: string | null) => ({
      row: { ...selectedRow, id, musical_profile } as RegistrationDatabaseRow,
      accountStatus: null,
      regentName: null,
    });
    const candidates = [make("regent", "regente"), make("singer", "coralista")];
    const repository = {
      listCandidates: vi.fn().mockResolvedValue(candidates),
      listComplementPayments: vi.fn().mockResolvedValue([]),
      signPhotos: vi.fn(async (rows) => rows),
      list: vi.fn(),
      listAll: vi.fn(),
      recordExport: vi.fn(),
    };
    const page = await createAdminRegistrationService(repository, () => new Date()).list({
      search: "",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "coralista",
      page: 1,
      pageSize: 100,
    });
    expect(page.rows.map((row) => row.id)).toEqual(["singer"]);
  });

  it("bounds complement ID batches at 200", async () => {
    const { trace } = databaseHarness(Array.from({ length: 6 }, () => success([])));
    await createSupabaseAdminRegistrationRepository().listComplementPayments!(
      Array.from({ length: 1001 }, (_, index) => `registration-${index}`),
    );
    const inCalls = trace.filter(([method]) => method === "in");
    expect(inCalls).toHaveLength(6);
    expect((inCalls[0]?.[2] as string[]).length).toBe(200);
    expect((inCalls[5]?.[2] as string[]).length).toBe(1);
  });

  it("includes participant-initiated payments in administrative accounting", async () => {
    const row = {
      id: "payment",
      registration_id: "registration",
      amount_cents: 8000,
      status: "paid",
      checkout_url: null,
      created_at: "2026-09-14T00:00:00Z",
      paid_at: "2026-09-14T00:01:00Z",
      initiated_by_name: "Maria",
      initiated_as: "participant",
    };
    databaseHarness([success([row as unknown as ResultRow])]);
    await expect(
      createSupabaseAdminRegistrationRepository().listComplementPayments!(["registration"]),
    ).resolves.toMatchObject([{ initiatedAs: "participant", amountCents: 8000 }]);
  });

  it("returns only the newest validated superseded checkout review per registration", async () => {
    const older = {
      id: "review-old",
      registration_id: "registration",
      order_nsu: "old-order",
      amount_cents: 10000,
      paid_amount_cents: 10000,
      payment_method: "pix",
      installments: 1,
      paid_at: "2026-09-18T10:00:00Z",
      infinitepay_transaction_nsu: "transaction-old",
      receipt_url: null,
    };
    const newest = {
      ...older,
      id: "review-new",
      order_nsu: "new-order",
      paid_at: "2026-09-19T10:00:00Z",
      infinitepay_transaction_nsu: "transaction-new",
      receipt_url: "https://receipt.infinitepay.io/late",
    };
    const { trace } = databaseHarness([success([newest, older] as unknown as ResultRow[])]);

    const reviews = await createSupabaseAdminRegistrationRepository()
      .listSupersededCheckoutReviews!(["registration"]);

    expect(reviews.get("registration")).toEqual({
      orderNsu: "new-order",
      amountCents: 10000,
      paidAmountCents: 10000,
      paymentMethod: "pix",
      installments: 1,
      paidAt: "2026-09-19T10:00:00Z",
      transactionNsu: "transaction-new",
      receiptUrl: "https://receipt.infinitepay.io/late",
    });
    expect(trace).toContainEqual(["from", "registration_superseded_checkouts"]);
    expect(trace).toContainEqual(["eq", "status", "paid_requires_review"]);
    expect(trace).toContainEqual(["order", "paid_at", { ascending: false }]);
  });

  it("rejects malformed superseded checkout review rows", async () => {
    databaseHarness([
      success([
        {
          registration_id: "registration",
          order_nsu: "order",
          amount_cents: 10000,
          paid_amount_cents: 10000,
          payment_method: "pix",
          installments: 0,
          paid_at: "2026-09-19T10:00:00Z",
          infinitepay_transaction_nsu: "transaction",
          receipt_url: null,
        } as unknown as ResultRow,
      ]),
    ]);

    await expect(
      createSupabaseAdminRegistrationRepository().listSupersededCheckoutReviews!([
        "registration",
      ]),
    ).rejects.toThrow("Não foi possível consultar pagamentos de checkouts substituídos.");
  });
});
const failure: DatabaseResult = {
  data: null,
  error: {
    message: "private database detail",
    details: "sensitive",
    hint: "internal",
    code: "XX000",
  },
  count: null,
  status: 500,
  statusText: "Internal Server Error",
};

function databaseHarness(results: DatabaseResult[]) {
  const trace: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "or",
    "in",
    "order",
    "range",
    "insert",
    "update",
    "maybeSingle",
    "is",
  ]) {
    builder[method] = (...args: unknown[]) => {
      trace.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: DatabaseResult) => void) => {
    const result = results.shift();
    if (!result) throw new Error("Unexpected database request");
    trace.push(["response", result.status]);
    return Promise.resolve(result).then(resolve);
  };
  supabaseAdminMock.from = (table: string) => {
    trace.push(["from", table]);
    return builder;
  };
  return { trace };
}

beforeEach(() => {
  supabaseAdminMock.from = () => {
    throw new Error("Unconfigured Supabase boundary");
  };
  supabaseAdminMock.storage = undefined;
});

describe("registration repository list", () => {
  it("normalizes a masked CPF only for the CPF search predicate", async () => {
    const { trace } = databaseHarness([success([])]);
    await createSupabaseAdminRegistrationRepository().list({
      search: "529.982.247-25",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 25,
    });

    const filter = trace.find(([method]) => method === "or")?.[1];
    expect(filter).toContain('name.ilike."%529.982.247-25%"');
    expect(filter).toContain('cpf.ilike."%52998224725%"');
  });

  it("selects only administrative columns and returns the deterministic inclusive page", async () => {
    const { trace } = databaseHarness([success([selectedRow], 51)]);
    const page = await createSupabaseAdminRegistrationRepository().list({
      search: "Maria",
      paymentStatus: "paid",
      choirId: "all",
      musicalProfile: "all",
      page: 2,
      pageSize: 25,
    });
    expect(trace).toEqual([
      ["from", "registrations"],
      ["select", expectedColumns, { count: "exact" }],
      ["eq", "payment_status", "paid"],
      [
        "or",
        'name.ilike."%Maria%",badge_name.ilike."%Maria%",cpf.ilike."%Maria%",choir_name.ilike."%Maria%",email.ilike."%Maria%",phone.ilike."%Maria%",city.ilike."%Maria%",institution.ilike."%Maria%"',
      ],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["range", 25, 49],
      ["response", 200],
    ]);
    expect(page).toEqual({
      rows: [
        {
          id: "registration-1",
          createdAt: "2026-09-07T12:00:00Z",
          name: "Maria",
          badgeName: "Maria",
          cpf: "529.982.247-25",
          birthDate: "1990-01-02",
          diocese: "Diocese de Quixadá",
          choirName: "Diocese de Quixadá",
          otherChoirName: null,
          email: "maria@example.com",
          phone: "85999999999",
          city: "Fortaleza",
          institution: null,
          role: "Corista",
          musicalProfile: "coralista",
          voicePart: "soprano",
          observations: "Sem restrições.",
          includeShirt: false,
          manualFeePendingCents: null,
          manualDiscountCents: null,
          shirtSize: null,
          shirtPriceCents: null,
          paymentStatus: "paid",
          amountCents: 3000,
          paidAmountCents: 3000,
          paymentMethod: "pix",
          installments: 1,
          paidAt: "2026-09-07T13:00:00Z",
          paymentOrigin: null,
          hasManualReceipt: false,
          participantAccess: {
            label: "Aguardando criação",
            canReprocess: true,
            canReset: false,
          },
          pricingType: "standard",
          standardPriceCents: 3000,
          registrationPriceCents: 3000,
          remainingPriceCents: null,
          photoUrl: null,
          regentName: null,
        },
      ],
      total: 51,
      page: 2,
      pageSize: 25,
    });
  });

  it("keeps hostile syntax and SQL wildcards inside eight fixed quoted values", async () => {
    const { trace } = databaseHarness([success([])]);
    await createSupabaseAdminRegistrationRepository().list({
      search: String.raw`"),payment_status.eq.paid\%_`,
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 25,
    });
    expect(trace.find(([method]) => method === "or")).toEqual([
      "or",
      String.raw`name.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",badge_name.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",cpf.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",choir_name.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",email.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",phone.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",city.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",institution.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%"`,
    ]);
    expect(trace.some(([method]) => method === "eq")).toBe(false);
  });

  it("omits optional filters and returns an empty first page", async () => {
    const { trace } = databaseHarness([success([])]);
    await expect(
      createSupabaseAdminRegistrationRepository().list({
        search: "",
        paymentStatus: "all",
        choirId: "all",
        musicalProfile: "all",
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toEqual({ rows: [], total: 0, page: 1, pageSize: 25 });
    expect(trace).toContainEqual(["range", 0, 24]);
    expect(trace.some(([method]) => method === "or" || method === "eq")).toBe(false);
  });

  it("signs the participant photo for listed rows and skips signing in bulk reads", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed/foto.jpg" },
      error: null,
    });
    supabaseAdminMock.storage = {
      from: (bucket: string) => (bucket === "registration-photos" ? { createSignedUrl } : null),
    };
    const { trace } = databaseHarness([
      success([{ ...selectedRow, photo_path: "a/foto.jpg" }]),
      success([{ ...selectedRow, photo_path: "a/foto.jpg" }]),
    ]);
    const repository = createSupabaseAdminRegistrationRepository();

    const page = await repository.list({
      search: "",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
      page: 1,
      pageSize: 25,
    });
    expect(page.rows[0].photoUrl).toBe("https://storage.example/signed/foto.jpg");
    expect(createSignedUrl).toHaveBeenCalledWith("a/foto.jpg", 3600);

    await repository.listAll({
      search: "",
      paymentStatus: "all",
      choirId: "all",
      musicalProfile: "all",
    });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(trace.filter(([method]) => method === "from")).toHaveLength(2);
  });

  it("applies choir and musical profile filters to the registration query", async () => {
    const choirId = "98458155-7dc0-4ff5-8635-d1d4d908db94";
    const { trace } = databaseHarness([success([]), success([])]);
    const repository = createSupabaseAdminRegistrationRepository();
    await repository.list({
      search: "",
      paymentStatus: "all",
      choirId,
      musicalProfile: "coralista",
      page: 1,
      pageSize: 25,
    });
    expect(trace).toContainEqual(["eq", "choir_id", choirId]);
    expect(trace).toContainEqual(["eq", "musical_profile", "coralista"]);
    await repository.list({
      search: "",
      paymentStatus: "all",
      choirId: "other",
      musicalProfile: "all",
      page: 1,
      pageSize: 25,
    });
    expect(trace).toContainEqual(["is", "choir_id", null]);
  });

  it("creates a short-lived signed URL for an administrator receipt", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed/receipt.pdf" },
      error: null,
    });
    supabaseAdminMock.storage = {
      from: vi.fn().mockReturnValue({ createSignedUrl }),
    };
    const { trace } = databaseHarness([
      singleSuccess({ manual_receipt_path: "registration-1/receipt.pdf" }),
    ]);

    await expect(
      createSupabaseAdminRegistrationRepository().getReceiptUrl!("registration-1"),
    ).resolves.toEqual({
      signedUrl: "https://storage.example/signed/receipt.pdf",
      expiresIn: 3600,
    });
    expect(trace).toContainEqual(["select", "manual_receipt_path"]);
    expect(createSignedUrl).toHaveBeenCalledWith("registration-1/receipt.pdf", 3600);
  });

  it("replaces database details with a generic query error", async () => {
    databaseHarness([failure]);
    await expect(
      createSupabaseAdminRegistrationRepository().list({
        search: "",
        paymentStatus: "all",
        choirId: "all",
        musicalProfile: "all",
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toThrow("Não foi possível consultar as inscrições.");
  });
});

describe("registration update", () => {
  it("delegates cadastral updates to the repository", async () => {
    const updateRegistration = vi
      .fn()
      .mockResolvedValue({ status: "updated", registrationId: "registration-1" });
    const service = createAdminRegistrationService(
      { updateRegistration } as never,
      () => new Date("2026-09-08T01:00:00Z"),
    );
    const input = {
      registrationId: "4ea5e017-366b-4bba-a1d6-8cf7fec7e93e",
      name: "Maria Corrigida",
      badgeName: "Maria",
      cpf: "52998224725",
      email: "maria@example.com",
      phone: "85999999999",
      birthDate: "1990-01-02",
      diocese: "Diocese de Quixadá",
      choirId: null,
      otherChoirName: "Coro Livre",
      city: null,
      institution: null,
      role: null,
      musicalProfile: "coralista",
      voicePart: "soprano",
      observations: null,
    } as const;
    await expect(service.update(input as never)).resolves.toEqual({
      status: "updated",
      registrationId: "registration-1",
    });
    expect(updateRegistration).toHaveBeenCalledWith(input);
  });

  it("fails when the repository does not support updates", async () => {
    const service = createAdminRegistrationService({} as never, () => new Date());
    await expect(service.update({} as never)).rejects.toThrow(
      "Ação administrativa indisponível.",
    );
  });
});
