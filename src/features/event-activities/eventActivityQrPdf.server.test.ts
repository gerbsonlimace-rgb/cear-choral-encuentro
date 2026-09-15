import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildEventActivityQrPdf } from "./eventActivityQrPdf.server";

const transparentPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Z4n+WQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("event activity QR PDF", () => {
  it("creates one A4 page for every supplied QR activity", async () => {
    const result = await buildEventActivityQrPdf({
      generatedAt: new Date("2026-09-13T12:00:00Z"),
      logoBytes: transparentPng,
      activities: [
        {
          title: "1ª Conferência",
          activityDate: "2026-11-20",
          startsAt: "20:00",
          endsAt: "21:00",
          location: "Auditório principal",
          qrPngDataUrl: `data:image/png;base64,${Buffer.from(transparentPng).toString("base64")}`,
        },
        {
          title: "Ensaio 2",
          activityDate: "2026-11-21",
          startsAt: "15:00",
          endsAt: "16:00",
          location: null,
          qrPngDataUrl: `data:image/png;base64,${Buffer.from(transparentPng).toString("base64")}`,
        },
      ],
    });
    const document = await PDFDocument.load(result.bytes);

    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getSize()).toMatchObject({ width: 595.28, height: 841.89 });
    expect(result.filename).toBe("qrcodes-programacao-2026-09-13.pdf");
  });

  it("rejects an empty activity collection", async () => {
    await expect(
      buildEventActivityQrPdf({
        generatedAt: new Date("2026-09-13T12:00:00Z"),
        logoBytes: transparentPng,
        activities: [],
      }),
    ).rejects.toThrow("Nenhuma atividade ativa com QR Code");
  });
});
