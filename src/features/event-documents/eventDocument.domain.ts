import { z } from "zod";

export const MAX_EVENT_DOCUMENT_BYTES = 10 * 1024 * 1024;

function isSafePdfFileName(value: string) {
  return (
    value.toLowerCase().endsWith(".pdf") &&
    value !== ".pdf" &&
    !value.includes("/") &&
    !value.includes("\\") &&
    [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
  );
}

export const eventDocumentMetadataSchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(60),
  })
  .strict();

const eventDocumentFileSchema = z
  .object({
    base64: z
      .string()
      .min(1)
      .max(Math.ceil((MAX_EVENT_DOCUMENT_BYTES * 4) / 3) + 4),
    mimeType: z.literal("application/pdf"),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine(isSafePdfFileName, "Informe um nome de arquivo PDF válido."),
  })
  .strict();

export const eventDocumentCreateSchema = eventDocumentMetadataSchema.extend({
  file: eventDocumentFileSchema,
});

export const eventDocumentIdSchema = z.string().uuid();

export const eventDocumentUpdateSchema = eventDocumentMetadataSchema.extend({
  id: eventDocumentIdSchema,
  file: eventDocumentFileSchema.optional(),
});

export const eventDocumentActionSchema = z.object({ id: eventDocumentIdSchema }).strict();

export type EventDocumentCreate = z.infer<typeof eventDocumentCreateSchema>;
export type EventDocumentUpdate = z.infer<typeof eventDocumentUpdateSchema>;

export type EventDocument = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  category: string;
  storagePath: string;
  originalFileName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

function hasPdfHeader(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 8 && new TextDecoder("latin1").decode(bytes.slice(0, 8)).startsWith("%PDF-")
  );
}

function hasPdfTrailer(bytes: Uint8Array) {
  const tail = bytes.slice(Math.max(0, bytes.byteLength - 2_048));
  return new TextDecoder("latin1").decode(tail).includes("%%EOF");
}

export async function validateEventDocumentPdf(bytes: Uint8Array, mimeType: string) {
  if (mimeType !== "application/pdf") throw new Error("Envie um arquivo no formato PDF.");
  if (bytes.byteLength > MAX_EVENT_DOCUMENT_BYTES) {
    throw new Error("O documento deve ter no máximo 10 MB.");
  }
  if (!hasPdfHeader(bytes) || !hasPdfTrailer(bytes)) {
    throw new Error("Envie um arquivo PDF válido.");
  }
  try {
    const { PDFDocument } = await import("pdf-lib");
    await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
  } catch {
    throw new Error("Envie um arquivo PDF válido.");
  }
}
