import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRegentPortalService,
  createSupabaseRegentPortalRepository,
  type PortalComplementLedgerRow,
  type PortalRegistrationRow,
  type RegentPortalRepository,
} from "./regent-portal.server";

const { from, storageFrom, createSignedUrl, responses, traces } = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
  responses: [] as Array<{ data: unknown[] | null; error: unknown; count?: number | null }>,
  traces: [] as Array<Array<unknown>>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, storage: { from: storageFrom } },
}));

function queueQueryResponse(
  data: unknown[],
  options: { count?: number | null; error?: unknown } = {},
) {
  responses.push({ data, error: options.error ?? null, count: options.count });
}

function createQueryTrace(table: string) {
  const trace: Array<unknown> = [["from", table]];
  traces.push(trace);
  const query = {
    select(columns: string, options?: unknown) {
      trace.push(["select", columns, options]);
      return query;
    },
    eq(column: string, value: unknown) {
      trace.push(["eq", column, value]);
      return query;
    },
    or(filter: string) {
      trace.push(["or", filter]);
      return query;
    },
    in(column: string, values: unknown[]) {
      trace.push(["in", column, values]);
      return query;
    },
    order(column: string, options?: unknown) {
      trace.push(["order", column, options]);
      return query;
    },
    range(fromIndex: number, toIndex: number) {
      trace.push(["range", fromIndex, toIndex]);
      const response = responses.shift();
      if (!response) throw new Error(`Missing response for ${table}`);
      return Promise.resolve(response);
    },
  };
  return query;
}

const authorizedChoirId = "11111111-1111-4111-8111-111111111111";
const otherChoirId = "22222222-2222-4222-8222-222222222222";
const registrationId = "33333333-3333-4333-8333-333333333333";

const registration: PortalRegistrationRow = {
  id: registrationId,
  name: "Ana Silva",
  cpf: "12345678901",
  phone: "(88) 99999-1234",
  photoPath: `${registrationId}/participant.webp`,
  paymentStatus: "paid",
  initialAmountCents: 10_000,
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
};

const paidInstallment = (id: string, amountCents: number): PortalComplementLedgerRow => ({
  id,
  registrationId,
  amountCents,
  status: "paid",
  checkoutUrl: null,
  createdAt: "2026-09-11T10:00:00.000Z",
  paidAt: "2026-09-11T10:05:00.000Z",
  initiatedByName: "Regente Ana",
  initiatedAs: "regent",
});
const pendingInstallment: PortalComplementLedgerRow = {
  id: "66666666-6666-4666-8666-666666666666",
  registrationId,
  amountCents: 7_000,
  status: "pending",
  checkoutUrl: "https://checkout.infinitepay.com.br/pending",
  createdAt: "2026-09-11T11:00:00.000Z",
  paidAt: null,
  initiatedByName: "Administrador",
  initiatedAs: "admin",
};

function setupRepository(overrides: Partial<RegentPortalRepository> = {}) {
  const repository: RegentPortalRepository = {
    listParticipants: vi.fn().mockResolvedValue({ rows: [registration], total: 1 }),
    listParticipantPayments: vi
      .fn()
      .mockResolvedValue([
        paidInstallment("44444444-4444-4444-8444-444444444444", 5_000),
        paidInstallment("55555555-5555-4555-8555-555555555555", 3_000),
        pendingInstallment,
      ]),
    listSummaryRegistrations: vi.fn().mockResolvedValue([registration]),
    listSummaryPaidComplements: vi.fn().mockResolvedValue([
      { registrationId, amountCents: 5_000 },
      { registrationId, amountCents: 3_000 },
    ]),
    signPhoto: vi.fn().mockResolvedValue("https://storage.example.test/signed-photo"),
    ...overrides,
  };
  return repository;
}

beforeEach(() => {
  responses.length = 0;
  traces.length = 0;
  vi.clearAllMocks();
  from.mockImplementation((table: string) => createQueryTrace(table));
  storageFrom.mockReturnValue({ createSignedUrl });
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.example.test/signed-photo" },
    error: null,
  });
});

describe("Supabase regent portal repository", () => {
  it("scopes the participant query before escaped search and pagination and selects only portal fields", async () => {
    queueQueryResponse([], { count: 0 });

    await createSupabaseRegentPortalRepository().listParticipants(authorizedChoirId, {
      search: String.raw`Ana 100%_\"`,
      page: 2,
      pageSize: 20,
    });

    expect(traces).toHaveLength(1);
    expect(traces[0]).toEqual([
      ["from", "registrations"],
      [
        "select",
        "id,name,cpf,phone,photo_path,payment_status,amount_cents,pricing_type,standard_price_cents,registration_price_cents",
        { count: "exact" },
      ],
      ["eq", "choir_id", authorizedChoirId],
      ["or", String.raw`name.ilike."%Ana 100\\%\\_\\\\\"%",cpf.ilike."%100%"`],
      ["order", "name", { ascending: true }],
      ["order", "id", { ascending: true }],
      ["range", 20, 39],
    ]);
    expect(JSON.stringify(traces[0])).not.toContain(otherChoirId);
  });

  it("loads one authorized payment history batch without provider identifiers", async () => {
    queueQueryResponse([]);

    await createSupabaseRegentPortalRepository().listParticipantPayments(authorizedChoirId, [
      registrationId,
    ]);

    expect(traces[0]?.slice(0, 5)).toEqual([
      ["from", "registration_complement_payments"],
      [
        "select",
        "id,registration_id,amount_cents,status,checkout_url,created_at,paid_at,initiated_by_name,initiated_as",
        undefined,
      ],
      ["eq", "choir_id", authorizedChoirId],
      ["in", "registration_id", [registrationId]],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("keeps both all-choir summary queries scoped and counts only paid principal", async () => {
    queueQueryResponse([]);
    queueQueryResponse([]);

    const repository = createSupabaseRegentPortalRepository();
    await repository.listSummaryRegistrations(authorizedChoirId);
    await repository.listSummaryPaidComplements(authorizedChoirId);

    expect(traces[0]?.slice(0, 3)).toEqual([
      ["from", "registrations"],
      [
        "select",
        "id,payment_status,amount_cents,pricing_type,standard_price_cents,registration_price_cents",
        undefined,
      ],
      ["eq", "choir_id", authorizedChoirId],
    ]);
    expect(traces[1]?.slice(0, 4)).toEqual([
      ["from", "registration_complement_payments"],
      ["select", "registration_id,amount_cents", undefined],
      ["eq", "choir_id", authorizedChoirId],
      ["eq", "status", "paid"],
    ]);
  });

  it("fails closed instead of exposing non-integer registration price snapshots", async () => {
    queueQueryResponse(
      [
        {
          id: registrationId,
          name: "Ana Silva",
          cpf: "12345678901",
          phone: "(88) 99999-1234",
          photo_path: null,
          payment_status: "paid",
          pricing_type: "promotional",
          standard_price_cents: 30_000.5,
          registration_price_cents: 10_000,
        },
      ],
      { count: 1 },
    );

    await expect(
      createSupabaseRegentPortalRepository().listParticipants(authorizedChoirId, {
        search: "",
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toThrow("Não foi possível consultar os participantes.");
  });

  it("fails closed instead of returning a non-integer confirmed principal", async () => {
    queueQueryResponse([{ registration_id: registrationId, amount_cents: 5_000.5 }]);

    await expect(
      createSupabaseRegentPortalRepository().listSummaryPaidComplements(authorizedChoirId),
    ).rejects.toThrow("Não foi possível consultar o resumo financeiro.");
  });

  it("signs a private registration photo for five minutes", async () => {
    await expect(
      createSupabaseRegentPortalRepository().signPhoto(
        registrationId,
        `${registrationId}/participant.webp`,
      ),
    ).resolves.toBe("https://storage.example.test/signed-photo");

    expect(storageFrom).toHaveBeenCalledExactlyOnceWith("registration-photos");
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith(
      `${registrationId}/participant.webp`,
      300,
    );
  });

  it.each([
    "registrations/ana.webp",
    `${otherChoirId}/participant.webp`,
    `${registrationId}/participant.svg`,
    `${registrationId}/../participant.webp`,
  ])("rejects an unauthorized photo path before signing: %s", async (photoPath) => {
    await expect(
      createSupabaseRegentPortalRepository().signPhoto(registrationId, photoPath),
    ).rejects.toThrow("Não foi possível carregar a foto.");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("regent portal service", () => {
  it("maps confirmed principal and an open checkout without reducing the participant balance", async () => {
    const repository = setupRepository();

    const page = await createRegentPortalService(repository).list(authorizedChoirId, {
      search: "Ana",
      page: 1,
      pageSize: 20,
    });

    expect(page).toEqual({
      rows: [
        {
          id: registrationId,
          name: "Ana Silva",
          cpf: "12345678901",
          phone: "(88) 99999-1234",
          whatsappUrl: "https://wa.me/5588999991234",
          photoUrl: "https://storage.example.test/signed-photo",
          paymentStatus: "paid",
          initialAmountCents: 10_000,
          pricingType: "promotional",
          standardPriceCents: 30_000,
          registrationPriceCents: 10_000,
          financialState: {
            status: "partially_paid",
            pendingCents: 12_000,
            confirmedPrincipalCents: 18_000,
          },
          complement: {
            eligible: true,
            totalCents: 20_000,
            paidCents: 8_000,
            balanceCents: 12_000,
            openPayment: pendingInstallment,
          },
          payments: [
            paidInstallment("44444444-4444-4444-8444-444444444444", 5_000),
            paidInstallment("55555555-5555-4555-8555-555555555555", 3_000),
            pendingInstallment,
          ],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("projects the initial checkout and only confirmed complement principal into financial state", async () => {
    const repository = setupRepository({
      listParticipants: vi.fn().mockResolvedValue({
        rows: [{ ...registration, initialAmountCents: 10_000 }],
        total: 1,
      }),
    });

    const page = await createRegentPortalService(repository).list(authorizedChoirId, {
      search: "",
      page: 1,
      pageSize: 20,
    });

    expect(page.rows[0]).toMatchObject({
      initialAmountCents: 10_000,
      financialState: {
        status: "partially_paid",
        pendingCents: 12_000,
        confirmedPrincipalCents: 18_000,
      },
    });
  });

  it("signs only current-page photo paths and isolates each signing failure", async () => {
    const outsidePage = { ...registration, id: otherChoirId, photoPath: "outside/page.webp" };
    const repository = setupRepository({
      listParticipants: vi.fn().mockResolvedValue({
        rows: [registration, { ...registration, id: otherChoirId, photoPath: "broken.webp" }],
        total: 3,
      }),
      listParticipantPayments: vi.fn().mockResolvedValue([]),
      listSummaryRegistrations: vi.fn().mockResolvedValue([registration, outsidePage]),
      signPhoto: vi
        .fn()
        .mockResolvedValueOnce("https://storage.example.test/ana")
        .mockRejectedValueOnce(new Error("Storage unavailable")),
    });

    const page = await createRegentPortalService(repository).list(authorizedChoirId, {
      search: "",
      page: 1,
      pageSize: 2,
    });

    expect(repository.signPhoto).toHaveBeenNthCalledWith(
      1,
      registrationId,
      `${registrationId}/participant.webp`,
    );
    expect(repository.signPhoto).not.toHaveBeenCalledWith(otherChoirId, "broken.webp");
    expect(repository.signPhoto).not.toHaveBeenCalledWith(otherChoirId, "outside/page.webp");
    expect(repository.signPhoto).not.toHaveBeenCalledWith("outside/page.webp");
    expect(page.rows.map((row) => row.photoUrl)).toEqual([
      "https://storage.example.test/ana",
      null,
    ]);
  });

  it("computes the whole authorized choir summary independently of page and pending payments", async () => {
    const repository = setupRepository();

    await expect(createRegentPortalService(repository).summary(authorizedChoirId)).resolves.toEqual(
      {
        totalParticipants: 1,
        eligibleComplementCents: 20_000,
        confirmedComplementCents: 8_000,
        outstandingComplementCents: 12_000,
      },
    );

    expect(repository.listParticipants).not.toHaveBeenCalled();
    expect(repository.listParticipantPayments).not.toHaveBeenCalled();
    expect(repository.listSummaryRegistrations).toHaveBeenCalledExactlyOnceWith(authorizedChoirId);
    expect(repository.listSummaryPaidComplements).toHaveBeenCalledExactlyOnceWith(
      authorizedChoirId,
    );
  });

  it("excludes a financially incoherent initial checkout from the derived summary", async () => {
    const repository = setupRepository({
      listSummaryRegistrations: vi
        .fn()
        .mockResolvedValue([{ ...registration, initialAmountCents: 9_999 }]),
      listSummaryPaidComplements: vi
        .fn()
        .mockResolvedValue([{ registrationId, amountCents: 8_000 }]),
    });

    await expect(createRegentPortalService(repository).summary(authorizedChoirId)).resolves.toEqual(
      {
        totalParticipants: 1,
        eligibleComplementCents: 0,
        confirmedComplementCents: 0,
        outstandingComplementCents: 0,
      },
    );
  });
});
