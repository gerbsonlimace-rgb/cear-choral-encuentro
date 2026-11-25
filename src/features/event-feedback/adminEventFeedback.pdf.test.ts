// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildEventFeedbackPdf } from "./adminEventFeedback.pdf";
import type { AdminFeedbackRow } from "./adminEventFeedback.domain";

const row: AdminFeedbackRow = {
  submission_id: "private-submission-id",
  created_at: "2026-11-24T12:00:00Z",
  overall: 5,
  organization: 5,
  formation: 4,
  celebrations: 5,
  venue: 4,
  food: null,
  lodging: null,
  criterion_comments: { formation: "Mais oficinas de canto" },
  suggestion: "Encontro muito acolhedor",
};

async function inspect(base64: string) {
  const data = Uint8Array.from(Buffer.from(base64, "base64"));
  const task = getDocument({ data, useSystemFonts: true });
  const pdf = await task.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.filter((item) => "str" in item));
  }
  await task.destroy();
  return pages;
}

describe("feedback PDF", () => {
  it("exports overall results, every criterion and comments without internal identifiers", async () => {
    const file = await buildEventFeedbackPdf(
      [
        row,
        {
          ...row,
          submission_id: "another-private-id",
          overall: 3,
          food: 2,
          criterion_comments: {},
          suggestion: "Última sugestão",
        },
      ],
      new Date("2026-11-25T12:00:00Z"),
    );
    const pages = await inspect(file.base64);
    const text = pages
      .flat()
      .map((item) => item.str)
      .join(" ");
    expect(text).toContain("4,0");
    expect(text).toContain("50%");
    for (const label of [
      "Organização",
      "Formação",
      "Celebrações",
      "Estrutura",
      "Alimentação",
      "Hospedagem",
    ])
      expect(text).toContain(label);
    expect(text).toContain("Mais oficinas de canto");
    expect(text).toContain("Encontro muito acolhedor");
    expect(text).toContain("Última sugestão");
    expect(text).toContain("Não utilizaram: 1");
    expect(text).toContain("Sem notas");
    expect(text).not.toContain("private");
    expect(file.fileName).toBe("resultados-avaliacoes-2026-11-25.pdf");
    const doc = await PDFDocument.load(Buffer.from(file.base64, "base64"));
    expect(doc.getPages().every((page) => page.getWidth() < page.getHeight())).toBe(true);
    // The real output must embed artwork, not depend on remote image requests.
    expect(
      doc.context
        .enumerateIndirectObjects()
        .some(([, value]) => value.toString().includes("/Subtype /Image")),
    ).toBe(true);
  });

  it("paginates all comments and breaks oversized words inside the page margins", async () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      ...row,
      criterion_comments: {
        formation: `Comentário ${i + 1}: ${"ótimo ".repeat(100)}${"W".repeat(180)} FIM${i + 1}`,
      },
      suggestion: i === 13 ? "SUGESTÃO FINAL" : "",
    }));
    const pages = await inspect((await buildEventFeedbackPdf(rows)).base64);
    const text = pages
      .flat()
      .map((item) => item.str)
      .join(" ");
    expect(text).toContain("FIM14");
    expect(text).toContain("SUGESTÃO FINAL");
    expect(pages.length).toBeGreaterThan(8);
    for (const items of pages)
      for (const item of items) {
        if (!item.str.trim()) continue;
        expect(item.transform[4]).toBeGreaterThanOrEqual(23);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(397);
        expect(item.transform[5]).toBeGreaterThanOrEqual(20);
        expect(item.transform[5]).toBeLessThanOrEqual(576);
      }
  });

  it("handles no responses and unsupported symbols without invented scores or crashes", async () => {
    const empty = (await inspect((await buildEventFeedbackPdf([])).base64))
      .flat()
      .map((item) => item.str)
      .join(" ");
    expect(empty).toContain("Nenhuma avaliação recebida");
    expect(empty).not.toContain("0,0");
    const file = await buildEventFeedbackPdf([{ ...row, suggestion: "Obrigado 🙏\nTudo ótimo" }]);
    const text = (await inspect(file.base64))
      .flat()
      .map((item) => item.str)
      .join(" ");
    expect(text).toContain("Tudo ótimo");
    expect(text).toContain("[símbolo]");
    expect(text).toContain("Símbolos sem suporte");
  });
});
