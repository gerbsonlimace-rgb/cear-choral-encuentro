import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildRegistrationsPdf, getPdfFinancialColumns, getPdfHeaderDetails, summarizePdfRegistrations } from "./admin-registration-pdf";
import type { AdminRegistrationRow } from "./admin.domain";

describe("registration PDF", () => {
  it("shows the selected choir and its regent in the report header", () => {
    const query = { search: "", paymentStatus: "all", choirId: "all", musicalProfile: "all", loginStatus: "all" } as const;
    const rows = [
      { choirName: "Coro São José", regentName: "Maria Oliveira" },
      { choirName: "Coro São José", regentName: "Maria Oliveira" },
    ] as AdminRegistrationRow[];
    expect(getPdfHeaderDetails(rows, query)).toEqual({ choir: "Coro São José", regent: "Maria Oliveira" });
    expect(getPdfHeaderDetails([...rows, { choirName: "Coro Santa Cecília", regentName: "João Silva" } as AdminRegistrationRow], query))
      .toEqual({ choir: "Vários coros", regent: "Vários regentes" });
    expect(getPdfHeaderDetails([], { ...query, choirName: "Coro São José" }))
      .toEqual({ choir: "Coro São José", regent: "Não informado" });
  });

  it("shows registration and raffle amounts with independent payment indicators", () => {
    const promotional = {
      pricingType: "promotional", registrationPriceCents: 10_000,
      standardPriceCents: 30_000, remainingPriceCents: 20_000,
    } as AdminRegistrationRow;
    expect(getPdfFinancialColumns({
      ...promotional,
      financialState: { status: "pending", pendingCents: 30_000, confirmedPrincipalCents: 0 },
    })).toEqual({
      registration: { value: "R$ 100,00", indicator: "pending" },
      raffles: { value: "R$ 200,00", indicator: "pending" },
    });
    expect(getPdfFinancialColumns({
      ...promotional,
      financialState: { status: "partially_paid", pendingCents: 12_000, confirmedPrincipalCents: 18_000 },
    })).toEqual({
      registration: { value: "R$ 100,00", indicator: "paid" },
      raffles: { value: "R$ 120,00", indicator: "pending" },
    });
    expect(getPdfFinancialColumns({
      ...promotional,
      financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 },
    })).toEqual({
      registration: { value: "R$ 100,00", indicator: "paid" },
      raffles: { value: "R$ 0,00", indicator: "paid" },
    });
  });

  it("marks raffle charges as inapplicable when the registration has no raffle program", () => {
    expect(getPdfFinancialColumns({
      registrationPriceCents: 30_000,
      pricingType: "standard",
      financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 },
    } as AdminRegistrationRow)).toEqual({
      registration: { value: "R$ 300,00", indicator: "paid" },
      raffles: { value: "—", indicator: "none" },
    });
  });

  it("counts only the exported participants and keeps registration money separate from raffles", () => {
    const rows = [
      { pricingType: "promotional", registrationPriceCents: 10000, standardPriceCents: 30000, remainingPriceCents: 20000, financialState: { status: "pending", pendingCents: 30000, confirmedPrincipalCents: 0 } },
      { pricingType: "standard", financialState: { status: "pending", pendingCents: 30000, confirmedPrincipalCents: 0 } },
    ] as AdminRegistrationRow[];
    expect(summarizePdfRegistrations(rows)).toEqual({ total: 2, pendingMoneyCents: 40000, raffleCents: 20000, raffleTickets: 20 });
  });
  it("includes twenty raffles worth R$200 for each exempt-group participant without adding registration debt", () => {
    const row = { isFreeRegistration: true, financialState: { status: "exempt", pendingCents: 0, confirmedPrincipalCents: 0 } } as AdminRegistrationRow;
    expect(summarizePdfRegistrations([row, row])).toEqual({ total: 2, pendingMoneyCents: 0, raffleCents: 40000, raffleTickets: 40 });
  });
  it("creates a complete landscape multi-page PDF from all 105 supplied registrations", async () => {
    const rows = Array.from({ length: 105 }, (_, i) => ({
      name: `José da Conceição ${i}`, choirName: "Coro Diocesano de Quixadá", choirId: "all",
      musicalProfile: "coralista", email: `jose${i}@example.com`, phone: "+55 85 99999-9999",
      financialState: { status: "pending", pendingCents: 20000, confirmedPrincipalCents: 0 },
    } as AdminRegistrationRow));
    const file = await buildRegistrationsPdf(rows, { search: "José", paymentStatus: "pending", choirId: "all", musicalProfile: "coralista", loginStatus: "never" }, new Date("2026-10-20T01:00:00Z"));
    expect(file.fileName).toBe("inscricoes-2026-10-19.pdf");
    const pdf = await PDFDocument.load(file.base64);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
  });
});
