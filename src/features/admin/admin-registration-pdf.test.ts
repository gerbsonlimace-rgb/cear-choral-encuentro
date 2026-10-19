import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildRegistrationsPdf } from "./admin-registration-pdf";
import type { AdminRegistrationRow } from "./admin.domain";

describe("registration PDF", () => {
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