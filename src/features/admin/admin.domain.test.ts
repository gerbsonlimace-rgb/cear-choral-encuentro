import { describe, expect, it } from "vitest";
import type { RegistrationDatabaseRow } from "./admin.domain";
import {
  adminRegistrationExportSchema,
  adminRegistrationQuerySchema,
  buildRegistrationsCsv,
  enrichAdminRegistrationRow,
  mapAdminRegistrationRow,
  resolveParticipantAccess,
  summarizeAdminRegistrations,
} from "./admin.domain";

describe("admin participant access state", () => {
  it.each([
    ["pending", null, null],
    ["paid", null, { label: "Aguardando criação", canReprocess: true, canReset: false }],
    ["paid", "pending", { label: "Aguardando criação", canReprocess: true, canReset: false }],
    ["paid", "conflict", { label: "Conflito de e-mail", canReprocess: true, canReset: false }],
    ["paid", "active", { label: "Ativo", canReprocess: false, canReset: true }],
  ] as const)(
    "maps payment %s and account %s to the approved recovery state",
    (paymentStatus, accountStatus, expected) => {
      expect(resolveParticipantAccess(paymentStatus, accountStatus)).toEqual(expected);
    },
  );
});

const legacyRow: RegistrationDatabaseRow = {
  id: "4ea5e017-366b-4bba-a1d6-8cf7fec7e93e",
  created_at: "2025-08-22T14:00:00.000Z",
  name: "Ana Histórica",
  cpf: "52998224725",
  birth_date: "1990-01-01",
  choir_id: null,
  choir_name: "Diocese de Sobral",
  other_choir_name: null,
  diocese: "Diocese de Sobral",
  email: "ana@example.com",
  phone: "85988887777",
  city: "Sobral",
  institution: null,
  role: "singer",
  badge_name: null,
  include_shirt: false,
  shirt_size: null,
  shirt_price_cents: null,
  pricing_type: null,
  standard_price_cents: null,
  registration_price_cents: null,
  remaining_price_cents: null,
  amount_cents: null,
  paid_amount_cents: null,
  payment_status: "legacy",
  payment_origin: "site",
  photo_path: null,
  payment_method: null,
  installments: null,
  paid_at: null,
  checkout_url: null,
  infinitepay_invoice_slug: null,
  infinitepay_transaction_nsu: null,
  observations: null,
  order_nsu: null,
  receipt_url: null,
  musical_profile: null,
  voice_part: null,
  manual_paid_by: null,
  manual_receipt_file_name: null,
  manual_receipt_mime_type: null,
  manual_receipt_path: null,
  manual_receipt_size_bytes: null,
};

const pendingRow: RegistrationDatabaseRow = {
  ...legacyRow,
  id: "a7669694-66a4-48ec-b237-c7b088d07a52",
  created_at: "2026-09-06T15:00:00.000Z",
  name: "Bia Pendente",
  payment_status: "pending",
  amount_cents: 10000,
  payment_method: "pix",
  choir_id: "11111111-1111-4111-8111-111111111111",
  pricing_type: "promotional",
  standard_price_cents: 30000,
  registration_price_cents: 10000,
};

const paidRow: RegistrationDatabaseRow = {
  ...legacyRow,
  id: "ab424e67-dfa2-4a48-b3d7-e80280dc9d88",
  created_at: "2026-09-07T12:00:00.000Z",
  name: "Carla Paga",
  email: "carla@example.com",
  phone: "85977776666",
  city: "Fortaleza; CE",
  institution: 'Coro "Vozes"\nUnidas',
  payment_status: "paid",
  amount_cents: 13990,
  paid_amount_cents: 12990,
  payment_method: "credit_card",
  installments: 2,
  paid_at: "2026-09-08T15:30:00.000Z",
  pricing_type: "promotional",
  standard_price_cents: 30000,
  registration_price_cents: 10000,
  checkout_url: "https://checkout.example/checkout-secret",
  infinitepay_invoice_slug: "invoice-secret",
  infinitepay_transaction_nsu: "transaction-secret",
  observations: "observacao-secreta",
  order_nsu: "order-secret",
  receipt_url: "https://receipt.example/receipt-secret",
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = content.startsWith("\uFEFF") ? 1 : 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ";") {
      row.push(cell);
      cell = "";
    } else if (character === "\r" && content[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

describe("admin registration filters", () => {
  // Detects a production mutation that stops trimming the query or applying safe pagination defaults.
  it("normalizes defaults and trims search", () => {
    expect(adminRegistrationQuerySchema.parse({ search: "  Maria  " })).toEqual({
      search: "Maria",
      paymentStatus: "all",
      page: 1,
      pageSize: 25,
    });
  });

  // Detects a production mutation that accepts an unsupported payment status while all other fields are valid.
  it("rejects an unsupported payment status", () => {
    expect(() =>
      adminRegistrationQuerySchema.parse({ paymentStatus: "cancelled", pageSize: 25 }),
    ).toThrow();
  });

  // Detects a production mutation that accepts a page larger than the server contract while the status is valid.
  it("rejects an oversized page", () => {
    expect(() =>
      adminRegistrationQuerySchema.parse({ paymentStatus: "all", pageSize: 101 }),
    ).toThrow();
  });

  // Detects a production mutation that lets list-only pagination fields reach the export boundary.
  it("removes pagination from export input", () => {
    expect(adminRegistrationExportSchema.parse({ search: "Ana", paymentStatus: "paid" })).toEqual({
      search: "Ana",
      paymentStatus: "paid",
    });
  });
});

describe("admin registration history and CSV", () => {
  // Detects a production mutation that fabricates shirt, value, or payment details for legacy registrations.
  it("preserves unknown historical registration details", () => {
    expect(mapAdminRegistrationRow(legacyRow)).toMatchObject({
      paymentStatus: "legacy",
      amountCents: null,
      paidAmountCents: null,
      paymentMethod: null,
      installments: null,
      paidAt: null,
    });
  });

  // Detects a production mutation that treats an opt-out shirt choice as an unknown shirt or drops Pix data.
  it("maps a pending registration without a shirt", () => {
    expect(mapAdminRegistrationRow(pendingRow)).toMatchObject({
      paymentStatus: "pending",
      amountCents: 10000,
      paymentMethod: "pix",
    });
  });

  // Detects a production mutation that crashes exports when the simplified form leaves removed fields empty.
  it("exports removed optional fields as not informed", () => {
    const file = buildRegistrationsCsv(
      [
        mapAdminRegistrationRow({
          ...pendingRow,
          email: null,
          city: null,
          role: null,
        }),
      ],
      new Date("2026-09-07T12:00:00.000Z"),
    );

    expect(parseCsv(file.content)[1]).toEqual([
      "06/09/2026",
      "Bia Pendente",
      "529.982.247-25",
      "Diocese de Sobral",
      "Não informado",
      "85988887777",
      "Não informado",
      "Não informado",
      "Não informado",
      "Pendente",
      "Promocional",
      "R$\u00a0300,00",
      "R$\u00a0100,00",
      "R$\u00a0100,00",
      "Não informado",
      "Pix",
      "Não informado",
      "Não informado",
    ]);
  });

  // Detects a production mutation that loses selected shirt, charged/paid amounts, or card installments.
  it("maps a paid card registration faithfully", () => {
    expect(mapAdminRegistrationRow(paidRow)).toMatchObject({
      paymentStatus: "paid",
      pricingType: "promotional",
      standardPriceCents: 30000,
      registrationPriceCents: 10000,
      amountCents: 13990,
      paidAmountCents: 12990,
      paymentMethod: "credit_card",
      installments: 2,
    });
  });

  // Detects a production mutation that changes CSV column order, moves values between fields, exposes sensitive registration fields, or weakens CSV escaping.
  it("builds a safe semicolon CSV with Brazilian presentation", () => {
    const file = buildRegistrationsCsv(
      [
        mapAdminRegistrationRow(legacyRow),
        mapAdminRegistrationRow(pendingRow),
        mapAdminRegistrationRow({
          ...paidRow,
          name: '=HYPERLINK("https://evil.example")',
        }),
        mapAdminRegistrationRow({ ...pendingRow, phone: "  +5585999999999" }),
      ],
      new Date("2026-09-07T12:00:00.000Z"),
    );
    const csvRows = parseCsv(file.content);

    expect(file.fileName).toBe("inscricoes-2026-09-07.csv");
    expect(csvRows[0]).toEqual([
      "Data",
      "Nome",
      "CPF",
      "Coro/Diocese",
      "E-mail",
      "Telefone",
      "Cidade",
      "Instituição",
      "Função",
      "Situação",
      "Tipo do valor",
      "Valor normal",
      "Valor da inscrição",
      "Valor esperado",
      "Valor pago",
      "Forma de pagamento",
      "Parcelas",
      "Pago em",
    ]);
    expect(csvRows[3]).toEqual([
      "07/09/2026",
      '\'=HYPERLINK("https://evil.example")',
      "529.982.247-25",
      "Diocese de Sobral",
      "carla@example.com",
      "85977776666",
      "Fortaleza; CE",
      'Coro "Vozes"\nUnidas',
      "singer",
      "Pago",
      "Promocional",
      "R$\u00a0300,00",
      "R$\u00a0100,00",
      "R$\u00a0139,90",
      "R$\u00a0129,90",
      "Cartão",
      "2",
      "08/09/2026",
    ]);
    expect(csvRows[4][5]).toBe("'  +5585999999999");
    expect(file.content).not.toContain("checkout-secret");
    expect(file.content).not.toContain("invoice-secret");
    expect(file.content).not.toContain("transaction-secret");
    expect(file.content).not.toContain("observacao-secreta");
    expect(file.content).not.toContain("order-secret");
    expect(file.content).not.toContain("receipt-secret");
    expect(file.content).toContain("\r\n");
  });
});

describe("admin registration summary", () => {
  // Detects a production mutation that includes unpaid registrations in revenue or loses the
  // promotional balance owed by each choir/regent.
  it("summarizes received and outstanding regent amounts from paid registrations", () => {
    const rows = [
      mapAdminRegistrationRow({
        ...paidRow,
        id: "quixada-paid-1",
        choir_name: "Diocese de Quixadá",
        amount_cents: 10000,
        paid_amount_cents: 10000,
      }),
      mapAdminRegistrationRow({
        ...paidRow,
        id: "quixada-paid-2",
        choir_name: "Diocese de Quixadá",
        amount_cents: 10000,
        paid_amount_cents: 10000,
      }),
      mapAdminRegistrationRow({ ...pendingRow, choir_name: "Diocese de Quixadá" }),
      mapAdminRegistrationRow({ ...legacyRow, choir_name: "Diocese de Sobral" }),
      mapAdminRegistrationRow({
        ...paidRow,
        id: "fortaleza-standard",
        choir_name: "Arquidiocese de Fortaleza",
        pricing_type: "standard",
        standard_price_cents: 30000,
        registration_price_cents: 30000,
        amount_cents: 30000,
        paid_amount_cents: 30000,
      }),
    ];

    expect(summarizeAdminRegistrations(rows)).toEqual({
      total: 5,
      paid: 1,
      pending: 1,
      partiallyPaid: 2,
      legacy: 1,
      receivedCents: 50000,
      pendingCents: 30000,
      pendingRegentCents: 40000,
      expectedCents: 120000,
      byChoir: [
        {
          choirName: "Diocese de Quixadá",
          total: 3,
          receivedCents: 20000,
          pendingCents: 30000,
          pendingRegentCents: 40000,
          expectedCents: 90000,
        },
        {
          choirName: "Arquidiocese de Fortaleza",
          total: 1,
          receivedCents: 30000,
          pendingCents: 0,
          pendingRegentCents: 0,
          expectedCents: 30000,
        },
        {
          choirName: "Diocese de Sobral",
          total: 1,
          receivedCents: 0,
          pendingCents: 0,
          pendingRegentCents: 0,
          expectedCents: 0,
        },
      ],
    });
  });
});

describe("admin derived financial state", () => {
  it("counts only paid complement principal and keeps the newest open checkout", () => {
    const candidate = {
      row: {
        ...paidRow,
        amount_cents: 10000,
        paid_amount_cents: 10000,
        pricing_type: "promotional",
        standard_price_cents: 30000,
        registration_price_cents: 10000,
      },
      accountStatus: "active" as const,
      regentName: "Regente",
    };
    const row = enrichAdminRegistrationRow(candidate, [
      {
        id: "open-old",
        registrationId: candidate.row.id,
        amountCents: 5000,
        status: "pending",
        checkoutUrl: "https://checkout.infinitepay.io/old",
        createdAt: "2026-09-01T12:00:00Z",
        paidAt: null,
        initiatedByName: "Admin",
        initiatedAs: "admin",
      },
      {
        id: "paid-1",
        registrationId: candidate.row.id,
        amountCents: 8000,
        status: "paid",
        checkoutUrl: null,
        createdAt: "2026-09-02T12:00:00Z",
        paidAt: "2026-09-02T13:00:00Z",
        initiatedByName: "Admin",
        initiatedAs: "admin",
      },
      {
        id: "open-new",
        registrationId: candidate.row.id,
        amountCents: 12000,
        status: "creating",
        checkoutUrl: "https://checkout.infinitepay.io/new",
        createdAt: "2026-09-03T12:00:00Z",
        paidAt: null,
        initiatedByName: "Admin",
        initiatedAs: "admin",
      },
    ]);

    expect(row.financialState).toEqual({
      status: "partially_paid",
      pendingCents: 12000,
      confirmedPrincipalCents: 18000,
    });
    expect(row.openComplementPayment?.id).toBe("open-new");
    expect(row.participantAccess?.label).toBe("Ativo");
  });

  it("uses the configured remaining price and maps the musical profile", () => {
    const candidate = {
      row: {
        ...paidRow,
        amount_cents: 10000,
        paid_amount_cents: 10000,
        pricing_type: "promotional",
        standard_price_cents: 30000,
        registration_price_cents: 10000,
        remaining_price_cents: 25000,
        musical_profile: "instrumentista",
      },
      accountStatus: "active" as const,
      regentName: "Regente",
    };

    const row = enrichAdminRegistrationRow(candidate, []);

    expect(row).toMatchObject({
      remainingPriceCents: 25000,
      musicalProfile: "instrumentista",
      financialState: {
        status: "partially_paid",
        pendingCents: 25000,
        confirmedPrincipalCents: 10000,
      },
    });
  });
});
