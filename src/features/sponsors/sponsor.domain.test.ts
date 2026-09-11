import { describe, expect, it } from "vitest";

import {
  sponsorCreateSchema,
  sponsorUpdateSchema,
  validateSponsorLogoBytes,
} from "./sponsor.domain";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTES = Uint8Array.from(atob(PNG_BASE64), (character) => character.charCodeAt(0));

describe("sponsor domain", () => {
  it("normalizes a sponsor name and accepts a supported logo upload", () => {
    expect(
      sponsorCreateSchema.parse({
        name: "  Universidade Católica  ",
        isActive: true,
        logo: { base64: PNG_BASE64, mimeType: "image/png" },
      }),
    ).toEqual({
      name: "Universidade Católica",
      isActive: true,
      logo: { base64: PNG_BASE64, mimeType: "image/png" },
    });
  });

  it("allows an edit to keep the current logo", () => {
    expect(
      sponsorUpdateSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Patrocinador atualizado",
        isActive: false,
      }),
    ).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Patrocinador atualizado",
      isActive: false,
    });
  });

  it("detects the real image format instead of trusting the declared MIME type", () => {
    expect(validateSponsorLogoBytes(PNG_BYTES, "image/png")).toBe("png");
    expect(() => validateSponsorLogoBytes(PNG_BYTES, "image/jpeg")).toThrow(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  });

  it("rejects logos larger than five megabytes", () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(PNG_BYTES);

    expect(() => validateSponsorLogoBytes(oversized, "image/png")).toThrow(
      "A logo deve ter no máximo 5 MB.",
    );
  });

  it("rejects a truncated file that contains only a valid signature", () => {
    expect(() =>
      validateSponsorLogoBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    ).toThrow("Envie uma logo válida em PNG, JPEG ou WebP.");
  });

  it("rejects JPEG and WebP markers without image data", () => {
    expect(() =>
      validateSponsorLogoBytes(new Uint8Array([255, 216, 255, 217]), "image/jpeg"),
    ).toThrow("Envie uma logo válida em PNG, JPEG ou WebP.");
    expect(() =>
      validateSponsorLogoBytes(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32]),
        "image/webp",
      ),
    ).toThrow("Envie uma logo válida em PNG, JPEG ou WebP.");
  });
});
