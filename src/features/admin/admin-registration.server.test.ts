import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationDatabaseRow } from "./admin.domain";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: (_table: string): unknown => {
      throw new Error("Unconfigured Supabase boundary");
    },
    storage: undefined as unknown,
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseAdminMock }));

import {
  createAdminRegistrationService,
  createSupabaseAdminRegistrationRepository,
  getAdminRegistrationService,
} from "./admin-registration.server";

const expectedColumns =
  "id,created_at,name,badge_name,cpf,birth_date,diocese,choir_name,choir_id,other_choir_name,email,phone,city,institution,role,musical_profile,voice_part,observations,include_shirt,shirt_size,shirt_price_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents,amount_cents,paid_amount_cents,payment_status,payment_method,installments,paid_at,payment_origin,manual_receipt_path,manual_receipt_file_name,manual_receipt_mime_type,manual_receipt_size_bytes,photo_path,participant_accounts(access_status)";
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
    }));
    const last = Array.from({ length: 5 }, (_, index) => ({
      ...selectedRow,
      id: `row-${1000 + index}`,
      name: `Maria ${1000 + index}`,
    }));
    const { trace } = databaseHarness([success(first, 1005), success(last, 1005), auditSuccess]);
    const service = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      now,
    );
    const file = await service.export({ search: "Maria", paymentStatus: "paid" }, "user-1");
    expect(trace.filter(([method]) => method === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
    expect(trace.filter(([method]) => method === "order")).toEqual([
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ]);
    // Payment filters are derived after candidate retrieval; no raw
    // payment_status predicate may hide partially-paid registrations.
    expect(trace.filter(([method]) => method === "eq")).toEqual([]);
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
      "\uFEFFData;Nome;CPF;Coro/Diocese;E-mail;Telefone;Cidade;Instituição;Função;Situação;Tipo do valor;Valor normal;Valor da inscrição;Valor esperado;Valor pago;Forma de pagamento;Parcelas;Pago em",
    );
    expect(lines[1]).toBe(
      "07/09/2026;Maria 0;529.982.247-25;Diocese de Quixadá;maria@example.com;85999999999;Fortaleza;Não informado;Corista;Pago;Normal;R$ 30,00;R$ 30,00;R$ 30,00;R$ 30,00;Pix;1;07/09/2026",
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
    ).export({ search: "", paymentStatus: "all" }, "user-1");
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
          { search: "Maria", paymentStatus: "paid" },
          "user-1",
        ),
      ).rejects.toThrow("Não foi possível consultar as inscrições.");
      expect(trace.some(([method]) => method === "insert")).toBe(false);
      expect(trace).not.toContainEqual(["from", "admin_access_events"]);
    },
  );

  it("rejects with a generic error instead of returning CSV when audit insertion fails", async () => {
    const { trace } = databaseHarness([success([selectedRow]), failure]);
    await expect(
      createAdminRegistrationService(createSupabaseAdminRegistrationRepository(), now).export(
        { search: "", paymentStatus: "paid" },
        "user-1",
      ),
    ).rejects.toThrow("Não foi possível registrar a exportação.");
    expect(trace).toContainEqual(["from", "admin_access_events"]);
  });

  it("lazily exposes the production service with the same repository mapping", async () => {
    const { trace } = databaseHarness([success([])]);
    const service = getAdminRegistrationService();
    expect(trace).toEqual([]);
    await expect(
      service.list({ search: "", paymentStatus: "pending", page: 1, pageSize: 10 }),
    ).resolves.toEqual({ rows: [], total: 0, page: 1, pageSize: 10 });
    expect(trace.filter(([method]) => method === "eq")).toEqual([]);
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
    ).resolves.toEqual({ status: "paid", registrationId: "registration-1" });

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
    ).resolves.toEqual({ status: "paid", registrationId: "registration-1" });
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

describe("registration summary", () => {
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
        { search: "", paymentStatus: "partially_paid" },
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
      page: 1,
      pageSize: 100,
    });
    expect(page.rows.map((row) => row.id)).toEqual(expected);
    expect(page.total).toBe(expected.length);
  });

  it("bounds complement ID batches at 1,000", async () => {
    const { trace } = databaseHarness([success([]), success([])]);
    await createSupabaseAdminRegistrationRepository().listComplementPayments!(
      Array.from({ length: 1001 }, (_, index) => `registration-${index}`),
    );
    const inCalls = trace.filter(([method]) => method === "in");
    expect(inCalls).toHaveLength(2);
    expect((inCalls[0]?.[2] as string[]).length).toBe(1000);
    expect((inCalls[1]?.[2] as string[]).length).toBe(1);
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
      page: 2,
      pageSize: 25,
    });
    expect(trace).toEqual([
      ["from", "registrations"],
      ["select", expectedColumns, { count: "exact" }],
      ["eq", "payment_status", "paid"],
      [
        "or",
        'name.ilike."%Maria%",cpf.ilike."%Maria%",choir_name.ilike."%Maria%",email.ilike."%Maria%",phone.ilike."%Maria%",city.ilike."%Maria%",institution.ilike."%Maria%"',
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

  it("keeps hostile syntax and SQL wildcards inside seven fixed quoted values", async () => {
    const { trace } = databaseHarness([success([])]);
    await createSupabaseAdminRegistrationRepository().list({
      search: String.raw`"),payment_status.eq.paid\%_`,
      paymentStatus: "all",
      page: 1,
      pageSize: 25,
    });
    expect(trace.find(([method]) => method === "or")).toEqual([
      "or",
      String.raw`name.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",cpf.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",choir_name.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",email.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",phone.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",city.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%",institution.ilike."%\"),payment\\_status.eq.paid\\\\\\%\\_%"`,
    ]);
    expect(trace.some(([method]) => method === "eq")).toBe(false);
  });

  it("omits optional filters and returns an empty first page", async () => {
    const { trace } = databaseHarness([success([])]);
    await expect(
      createSupabaseAdminRegistrationRepository().list({
        search: "",
        paymentStatus: "all",
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

    const page = await repository.list({ search: "", paymentStatus: "all", page: 1, pageSize: 25 });
    expect(page.rows[0].photoUrl).toBe("https://storage.example/signed/foto.jpg");
    expect(createSignedUrl).toHaveBeenCalledWith("a/foto.jpg", 3600);

    await repository.listAll({ search: "", paymentStatus: "all" });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(trace.filter(([method]) => method === "from")).toHaveLength(2);
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
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toThrow("Não foi possível consultar as inscrições.");
  });
});
