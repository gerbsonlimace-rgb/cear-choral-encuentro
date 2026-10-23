import { describe, expect, it } from "vitest";
import { createPixBrCode, isValidPixKey } from "./pixBrCode";

describe("createPixBrCode", () => {
  it("matches the Central Bank's static QR example, including CRC", () => {
    expect(createPixBrCode({
      key: "123e4567-e12b-12d1-a456-426655440000",
      name: "Fulano de Tal",
      city: "BRASILIA",
    })).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("keeps the amount open so one QR can receive payments for any number of raffles", () => {
    const code = createPixBrCode({ key: "pix@exemplo.com", name: "Maria Silva", city: "Quixadá" });
    expect(code).toContain("5802BR");
    expect(code).toContain("6007QUIXADA");
    expect(code).not.toMatch(/540[0-9]/);
    expect(code).toMatch(/6304[0-9A-F]{4}$/);
  });

  it("accepts normal Pix key formats and rejects an empty or malformed key", () => {
    expect(isValidPixKey("pix@exemplo.com")).toBe(true);
    expect(isValidPixKey("+5585999999999")).toBe(true);
    expect(isValidPixKey("123e4567-e12b-12d1-a456-426655440000")).toBe(true);
    expect(isValidPixKey(" ")).toBe(false);
    expect(isValidPixKey("texto qualquer")).toBe(false);
  });
});
