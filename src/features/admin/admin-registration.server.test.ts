import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrationDatabaseRow } from "./admin.domain";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: (_table: string): unknown => {
      throw new Error("Unconfigured Supabase boundary");
    },
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseAdminMock }));

import {
  createAdminRegistrationService,
  createSupabaseAdminRegistrationRepository,
  getAdminRegistrationService,
} from "./admin-registration.server";

const expectedColumns =
  "id,created_at,name,choir_name,email,phone,city,institution,role,pricing_type,standard_price_cents,registration_price_cents,amount_cents,paid_amount_cents,payment_status,payment_method,installments,paid_at,participant_accounts(access_status)";
const selectedRow = {
  id: "registration-1",
  created_at: "2026-09-07T12:00:00Z",
  name: "Maria",
  cpf: "52998224725",
  choir_name: "Diocese de Quixadá",
  email: "maria@example.com",
  phone: "85999999999",
  city: "Fortaleza",
  institution: null,
  role: "Corista",
  pricing_type: "standard",
  standard_price_cents: 3000,
  registration_price_cents: 3000,
  amount_cents: 3000,
  paid_amount_cents: 3000,
  payment_status: "paid",
  payment_method: "pix",
  installments: 1,
  paid_at: "2026-09-07T13:00:00Z",
} satisfies Partial<RegistrationDatabaseRow>;

type DatabaseResult = {
  data: (typeof selectedRow)[] | null;
  error: { message: string; details: string; hint: string; code: string } | null;
  count: number | null;
  status: number;
  statusText: string;
};
const success = (data: (typeof selectedRow)[], count = data.length): DatabaseResult => ({
  data,
  error: null,
  count,
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
    expect(trace.filter(([method]) => method === "eq")).toEqual([
      ["eq", "payment_status", "paid"],
      ["eq", "payment_status", "paid"],
    ]);
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
      "07/09/2026;Maria 0;529.982.247-25;Diocese de Quixadá;maria@example.com;85999999999;Fortaleza;Não informado;Corista;Pago;Normal;R$ 30,00;R$ 30,00;Não informado;R$ 30,00;R$ 30,00;Pix;1;07/09/2026",
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
    expect(trace).toContainEqual(["eq", "payment_status", "pending"]);
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
  for (const method of ["select", "eq", "or", "order", "range", "insert"]) {
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
          cpf: "529.982.247-25",
          choirName: "Diocese de Quixadá",
          email: "maria@example.com",
          phone: "85999999999",
          city: "Fortaleza",
          institution: null,
          role: "Corista",
          paymentStatus: "paid",
          amountCents: 3000,
          paidAmountCents: 3000,
          paymentMethod: "pix",
          installments: 1,
          paidAt: "2026-09-07T13:00:00Z",
          participantAccess: {
            label: "Aguardando criação",
            canReprocess: true,
            canReset: false,
          },
          pricingType: "standard",
          standardPriceCents: 3000,
          registrationPriceCents: 3000,
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
