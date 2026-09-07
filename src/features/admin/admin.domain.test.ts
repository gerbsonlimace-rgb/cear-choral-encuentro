import { describe, expect, it } from "vitest";
import type { RegistrationDatabaseRow } from "./admin.domain";
import {
  adminRegistrationExportSchema,
  adminRegistrationQuerySchema,
  buildRegistrationsCsv,
  mapAdminRegistrationRow,
} from "./admin.domain";

const legacyRow: RegistrationDatabaseRow = {
  id: "4ea5e017-366b-4bba-a1d6-8cf7fec7e93e",
  created_at: "2025-08-22T14:00:00.000Z",
  name: "Ana Histórica",
  email: "ana@example.com",
  phone: "85988887777",
  city: "Sobral",
  institution: null,
  role: "singer",
  include_shirt: false,
  shirt_size: null,
  amount_cents: null,
  paid_amount_cents: null,
  payment_status: "legacy",
  payment_method: null,
  installments: null,
  paid_at: null,
  checkout_url: null,
  infinitepay_invoice_slug: null,
  infinitepay_transaction_nsu: null,
  observations: null,
  order_nsu: null,
  receipt_url: null,
};

const pendingRow: RegistrationDatabaseRow = {
  ...legacyRow,
  id: "a7669694-66a4-48ec-b237-c7b088d07a52",
  created_at: "2026-09-06T15:00:00.000Z",
  name: "Bia Pendente",
  payment_status: "pending",
  include_shirt: false,
  shirt_size: null,
  amount_cents: 10000,
  payment_method: "pix",
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
  include_shirt: true,
  shirt_size: "M",
  amount_cents: 13990,
  paid_amount_cents: 13990,
  payment_method: "credit_card",
  installments: 2,
  paid_at: "2026-09-07T15:30:00.000Z",
};

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

  // Detects a production mutation that accepts an unsupported status or a page larger than the server contract.
  it("rejects unsupported status and oversized pages", () => {
    expect(() =>
      adminRegistrationQuerySchema.parse({ paymentStatus: "cancelled", pageSize: 101 }),
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
      shirtLabel: "Não informado",
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
      shirtLabel: "Sem camisa",
      amountCents: 10000,
      paymentMethod: "pix",
    });
  });

  // Detects a production mutation that loses selected shirt, charged/paid amounts, or card installments.
  it("maps a paid card registration faithfully", () => {
    expect(mapAdminRegistrationRow(paidRow)).toMatchObject({
      paymentStatus: "paid",
      shirtLabel: "Tamanho M",
      amountCents: 13990,
      paidAmountCents: 13990,
      paymentMethod: "credit_card",
      installments: 2,
    });
  });

  // Detects a production mutation that omits BOM or Brazilian formatting, corrupts delimiters, or leaves spreadsheet formulas executable.
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

    expect(file.fileName).toBe("inscricoes-2026-09-07.csv");
    expect(file.content.startsWith("\uFEFFData;Nome;E-mail;Telefone;")).toBe(true);
    expect(file.content).toContain("'=HYPERLINK(\"\"https://evil.example\"\")");
    expect(file.content).toContain("'  +5585999999999");
    expect(file.content).toContain('"Fortaleza; CE"');
    expect(file.content).toContain('"Coro ""Vozes""\nUnidas"');
    expect(file.content).toContain("07/09/2026");
    expect(file.content).toContain("R$\u00a0139,90");
    expect(file.content).toContain("Pix");
    expect(file.content).toContain("Cartão");
    expect(file.content).toContain("2");
    expect(file.content).toContain("Histórico");
    expect(file.content).toContain("Pendente");
    expect(file.content).toContain("Pago");
    expect(file.content).toContain("Não informado");
    expect(file.content).toContain("\r\n");
  });
});
