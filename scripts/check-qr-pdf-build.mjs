// Run after `npm run build`: node scripts/check-qr-pdf-build.mjs
// Import the deployed chunk in Node, outside Vitest's dependency transforms.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";

const serverDir = resolve(process.argv[2] ?? ".output/server/_ssr");
const chunks = (await readdir(serverDir)).filter((name) =>
  /^eventActivityQrPdf\.server-.*\.mjs$/.test(name),
);
assert.equal(chunks.length, 1, "Build the application before checking the QR PDF.");
const { buildEventActivityQrPdf } = await import(pathToFileURL(resolve(serverDir, chunks[0])).href);
const qrPngDataUrl = await QRCode.toDataURL(
  "https://evento.test/participante/presenca?token=qr-pdf-build-check",
  { errorCorrectionLevel: "M", margin: 2, width: 900 },
);
const result = await buildEventActivityQrPdf({
  generatedAt: new Date("2026-09-14T12:00:00Z"),
  logoBytes: new Uint8Array(
    await readFile(new URL("../src/assets/logo-coros-preto.png", import.meta.url)),
  ),
  activities: [
    {
      title: "Conferência de abertura",
      activityDate: "2026-11-20",
      startsAt: "20:00",
      endsAt: "21:00",
      location: "Auditório principal",
      qrPngDataUrl,
    },
    {
      title: "Ensaio geral",
      activityDate: "2026-11-21",
      startsAt: null,
      endsAt: null,
      location: null,
      qrPngDataUrl,
    },
  ],
});
assert.equal(result.filename, "qrcodes-programacao-2026-09-14.pdf");
// Exercise the same base64 transport used by the download server function.
const downloaded = Buffer.from(Buffer.from(result.bytes).toString("base64"), "base64");
const document = await PDFDocument.load(downloaded);
assert.equal(document.getPageCount(), 2);
for (const page of document.getPages()) {
  assert.deepEqual(page.getSize(), { width: 595.28, height: 841.89 });
}
await assert.rejects(
  buildEventActivityQrPdf({ generatedAt: new Date(), logoBytes: new Uint8Array(), activities: [] }),
  /Nenhuma atividade ativa com QR Code/,
);
console.log(
  `QR PDF server build passed: ${document.getPageCount()} A4 pages, ${downloaded.length} bytes.`,
);
