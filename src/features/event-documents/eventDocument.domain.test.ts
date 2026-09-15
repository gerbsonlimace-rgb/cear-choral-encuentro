import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { ChoristerPortalCollectionSchema } from "@/features/chorister-app/choristerApp.domain";

import {
  MAX_EVENT_DOCUMENT_BYTES,
  eventDocumentCreateSchema,
  eventDocumentMetadataSchema,
  validateEventDocumentPdf,
} from "./eventDocument.domain";

const eventId = "22222222-2222-4222-8222-222222222222";

async function validPdfBytes() {
  const document = await PDFDocument.create();
  document.addPage([595, 842]);
  return document.save();
}

describe("event document domain", () => {
  it("accepts only a name and PDF without an event or category", () => {
    expect(
      eventDocumentCreateSchema.parse({
        title: "  Orientações  ",
        file: { base64: "JVBERi0xLjQKJSVFT0Y=", mimeType: "application/pdf", fileName: "guia.pdf" },
      }),
    ).toMatchObject({ title: "Orientações", eventId: null, category: "Documentos" });
  });
  it("accepts a real PDF and rejects a disguised or oversized file", async () => {
    const pdf = await validPdfBytes();

    await expect(validateEventDocumentPdf(pdf, "application/pdf")).resolves.toBeUndefined();
    await expect(
      validateEventDocumentPdf(new Uint8Array([80, 75, 3, 4]), "application/pdf"),
    ).rejects.toThrow("Envie um arquivo PDF válido.");
    await expect(validateEventDocumentPdf(pdf, "text/plain")).rejects.toThrow(
      "Envie um arquivo no formato PDF.",
    );
    await expect(
      validateEventDocumentPdf(new Uint8Array(MAX_EVENT_DOCUMENT_BYTES + 1), "application/pdf"),
    ).rejects.toThrow("O documento deve ter no máximo 10 MB.");
  });

  it("keeps categories extensible while validating normalized metadata", () => {
    expect(
      eventDocumentMetadataSchema.parse({
        eventId,
        title: "  Livro de partituras  ",
        category: "  Livro de partituras  ",
      }),
    ).toEqual({
      eventId,
      title: "Livro de partituras",
      category: "Livro de partituras",
    });
    expect(
      eventDocumentMetadataSchema.parse({
        eventId,
        title: "Orientações de hospedagem",
        category: "Hospedagem",
      }).category,
    ).toBe("Hospedagem");
  });

  it("bounds the encoded payload and accepts only the PDF MIME type", () => {
    expect(
      eventDocumentCreateSchema.safeParse({
        eventId,
        title: "Guia do evento",
        category: "Guia",
        file: {
          base64: "JVBERi0xLjQKJSVFT0Y=",
          mimeType: "application/pdf",
          fileName: "guia.pdf",
        },
      }).success,
    ).toBe(true);
    expect(
      eventDocumentCreateSchema.safeParse({
        eventId,
        title: "Guia do evento",
        category: "Guia",
        file: {
          base64: "JVBERi0xLjQKJSVFT0Y=",
          mimeType: "text/plain",
          fileName: "guia.pdf",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps the administrative category in the participant event document contract", () => {
    expect(
      ChoristerPortalCollectionSchema.parse({
        status: "published",
        events: [
          {
            id: eventId,
            name: "Grande Concerto",
            date: "2026-11-21",
            location: "Quixadá",
            coverImageUrl: null,
            songs: [],
            documents: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                title: "Livro de partituras",
                category: "Livro de partituras",
                kind: "document",
                sortOrder: 0,
                signedUrl: "https://signed.example.test/book.pdf",
                expiresAt: "2099-01-01T00:00:00.000Z",
              },
            ],
            guide: { notes: null },
          },
        ],
      }).events[0].documents[0].category,
    ).toBe("Livro de partituras");
  });
});
