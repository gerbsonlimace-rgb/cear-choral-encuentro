import { describe, expect, it } from "vitest";

import { createAttendanceTokenCodec } from "./eventAttendanceToken.server";

const activityId = "11111111-1111-4111-8111-111111111111";

describe("attendance token codec", () => {
  it("keeps a printed token valid without a time expiration", () => {
    const codec = createAttendanceTokenCodec("x".repeat(32));
    const issued = codec.issue(activityId, 3);

    expect(codec.verify(issued.token)).toEqual({
      activityId,
      qrVersion: 3,
    });
    expect(issued.token.split(".")[0]).toBe("v2");
  });

  it("rejects secrets shorter than 32 bytes", () => {
    expect(() => createAttendanceTokenCodec("x".repeat(31))).toThrow(
      "não está configurada com segurança",
    );
  });

  it("rejects malformed and modified tokens", () => {
    const codec = createAttendanceTokenCodec("x".repeat(32));
    const token = codec.issue(activityId, 1).token;

    expect(() => codec.verify("texto")).toThrow("QR Code inválido");
    expect(() => codec.verify(`${token}x`)).toThrow("QR Code inválido");
  });

  it("rejects invalid activity identifiers and versions", () => {
    const codec = createAttendanceTokenCodec("x".repeat(32));
    expect(() => codec.issue("not-a-uuid", 1)).toThrow("Atividade inválida");
    expect(() => codec.issue(activityId, 0)).toThrow("Versão do QR Code inválida");
  });
});
