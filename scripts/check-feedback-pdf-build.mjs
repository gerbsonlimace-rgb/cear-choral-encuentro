// Run after npm run build. Generate a synthetic report from the deployed server chunk.
import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const serverDir = resolve(".output/server/_ssr");
const chunk = (await readdir(serverDir)).find((name) =>
  /^adminEventFeedback\.pdf-.*\.mjs$/.test(name),
);
assert.ok(chunk, "Build the application before auditing the feedback PDF.");
const { buildEventFeedbackPdf } = await import(pathToFileURL(resolve(serverDir, chunk)).href);
const rows = Array.from({ length: 12 }, (_, i) => ({
  submission_id: `synthetic-${i}`,
  created_at: "2026-11-24T12:00:00Z",
  overall: i < 8 ? 5 : 4,
  organization: 5,
  formation: 4,
  celebrations: 5,
  venue: 4,
  food: i < 4 ? null : 4,
  lodging: null,
  criterion_comments: {
    formation:
      i < 3
        ? "Gostei da formação musical. Seria bom ter mais tempo para praticar o repertório e trocar experiências entre os coros."
        : "",
    organization:
      i === 0 ? "Equipe atenciosa e orientações claras.\nA acolhida fez a diferença." : "",
    food: i === 6 ? "As refeições estavam boas. Sugiro mais opções de frutas." : "",
  },
  suggestion:
    i < 2
      ? "Foi uma experiência de comunhão e aprendizado. Que o próximo encontro tenha mais oficinas e momentos de partilha!"
      : "",
}));
const file = await buildEventFeedbackPdf(rows, new Date("2026-11-25T12:00:00Z"));
const bytes = Buffer.from(file.base64, "base64");
const doc = await PDFDocument.load(bytes);
assert.ok(doc.getPageCount() >= 8);
const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
const pdf = await task.promise;
let text = "";
for (let index = 1; index <= pdf.numPages; index++) {
  const content = await (await pdf.getPage(index)).getTextContent();
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    assert.ok(
      item.transform[4] >= 23 && item.transform[4] + item.width <= 397,
      `Horizontal overflow on page ${index}: ${item.str}`,
    );
    assert.ok(
      item.transform[5] >= 20 && item.transform[5] <= 576,
      `Vertical overflow on page ${index}: ${item.str}`,
    );
    text += `${item.str} `;
  }
}
await task.destroy();
assert.ok(text.includes("4,7"));
assert.ok(text.includes("Não utilizaram: 4"));
assert.ok(text.includes("momentos de partilha!"));
assert.ok(!text.includes("synthetic-"));
await mkdir(resolve("tmp/pdfs"), { recursive: true });
await writeFile(resolve("tmp/pdfs/feedback-preview.pdf"), bytes);
console.log(
  `Feedback PDF build audit passed: ${doc.getPageCount()} A5 pages, ${bytes.length} bytes. Synthetic preview: tmp/pdfs/feedback-preview.pdf`,
);
