import { z } from "zod";

export const MAX_SPONSOR_LOGO_BYTES = 5 * 1024 * 1024;

export const sponsorLogoMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

export const sponsorLogoUploadSchema = z
  .object({
    base64: z
      .string()
      .min(1)
      .max(Math.ceil((MAX_SPONSOR_LOGO_BYTES * 4) / 3) + 4),
    mimeType: sponsorLogoMimeTypeSchema,
  })
  .strict();

const sponsorFieldsSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do patrocinador.").max(120),
    isActive: z.boolean(),
  })
  .strict();

export const sponsorCreateSchema = sponsorFieldsSchema.extend({
  logo: sponsorLogoUploadSchema,
});

export const sponsorIdSchema = z.string().uuid();

export const sponsorUpdateSchema = sponsorFieldsSchema.extend({
  id: sponsorIdSchema,
  logo: sponsorLogoUploadSchema.optional(),
});

export const sponsorActiveSchema = z
  .object({
    id: sponsorIdSchema,
    isActive: z.boolean(),
  })
  .strict();

export type SponsorLogoMimeType = z.infer<typeof sponsorLogoMimeTypeSchema>;
export type SponsorLogoUpload = z.infer<typeof sponsorLogoUploadSchema>;
export type SponsorCreate = z.infer<typeof sponsorCreateSchema>;
export type SponsorUpdate = z.infer<typeof sponsorUpdateSchema>;

export type AdminSponsor = {
  id: string;
  name: string;
  logoPath: string;
  logoUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicSponsor = Pick<AdminSponsor, "id" | "name" | "logoUrl">;

function beginsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function endsWith(bytes: Uint8Array, signature: number[]) {
  return (
    bytes.byteLength >= signature.length &&
    beginsWith(bytes, signature, bytes.byteLength - signature.length)
  );
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function isPngStructureValid(bytes: Uint8Array) {
  if (!beginsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return false;

  let offset = 8;
  let chunkIndex = 0;
  let hasHeader = false;
  let hasImageData = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32BigEndian(bytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + length + 4;
    if (chunkEnd > bytes.byteLength) return false;

    if (chunkIndex === 0) {
      if (length !== 13 || !beginsWith(bytes, [73, 72, 68, 82], typeOffset)) return false;
      const width = readUint32BigEndian(bytes, dataOffset);
      const height = readUint32BigEndian(bytes, dataOffset + 4);
      if (width === 0 || height === 0) return false;
      hasHeader = true;
    }
    if (beginsWith(bytes, [73, 68, 65, 84], typeOffset) && length > 0) {
      hasImageData = true;
    }
    if (beginsWith(bytes, [73, 69, 78, 68], typeOffset)) {
      return length === 0 && hasHeader && hasImageData && chunkEnd === bytes.byteLength;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }
  return false;
}

const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function isJpegStructureValid(bytes: Uint8Array) {
  if (!beginsWith(bytes, [255, 216]) || !endsWith(bytes, [255, 217])) return false;

  let offset = 2;
  let hasFrame = false;
  while (offset < bytes.byteLength - 2) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0x00 || marker === 0xd9) return false;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.byteLength - 2) return false;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.byteLength - 2) return false;

    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width === 0 || height === 0) return false;
      hasFrame = true;
    }
    if (marker === 0xda) {
      return hasFrame && segmentEnd < bytes.byteLength - 2;
    }
    offset = segmentEnd;
  }
  return false;
}

function isWebpStructureValid(bytes: Uint8Array) {
  if (
    bytes.byteLength < 20 ||
    !beginsWith(bytes, [82, 73, 70, 70]) ||
    !beginsWith(bytes, [87, 69, 66, 80], 8) ||
    readUint32LittleEndian(bytes, 4) !== bytes.byteLength - 8
  ) {
    return false;
  }

  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= bytes.byteLength) {
    const chunkSize = readUint32LittleEndian(bytes, offset + 4);
    const dataEnd = offset + 8 + chunkSize;
    const paddedEnd = dataEnd + (chunkSize % 2);
    if (paddedEnd > bytes.byteLength) return false;

    const isVp8 = beginsWith(bytes, [86, 80, 56, 32], offset) && chunkSize >= 10;
    const isVp8Lossless = beginsWith(bytes, [86, 80, 56, 76], offset) && chunkSize >= 5;
    const isVp8Extended = beginsWith(bytes, [86, 80, 56, 88], offset) && chunkSize >= 10;
    hasImageChunk ||= isVp8 || isVp8Lossless || isVp8Extended;
    offset = paddedEnd;
  }
  return hasImageChunk && offset === bytes.byteLength;
}

export function validateSponsorLogoBytes(
  bytes: Uint8Array,
  declaredMimeType: SponsorLogoMimeType,
): "png" | "jpg" | "webp" {
  if (bytes.byteLength > MAX_SPONSOR_LOGO_BYTES) {
    throw new Error("A logo deve ter no máximo 5 MB.");
  }

  const isPng = isPngStructureValid(bytes);
  const isJpeg = isJpegStructureValid(bytes);
  const isWebp = isWebpStructureValid(bytes);

  const detected = isPng
    ? { mimeType: "image/png" as const, extension: "png" as const }
    : isJpeg
      ? { mimeType: "image/jpeg" as const, extension: "jpg" as const }
      : isWebp
        ? { mimeType: "image/webp" as const, extension: "webp" as const }
        : null;

  if (!detected) {
    throw new Error("Envie uma logo válida em PNG, JPEG ou WebP.");
  }
  if (detected.mimeType !== declaredMimeType) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }
  return detected.extension;
}
