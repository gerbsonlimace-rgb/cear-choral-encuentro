import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z
  .object({
    v: z.literal(2),
    activityId: z.string().uuid(),
    qrVersion: z.number().int().positive(),
  })
  .strict();

export type AttendanceTokenPayload = {
  activityId: string;
  qrVersion: number;
};

export type AttendanceTokenCodec = {
  issue(activityId: string, qrVersion: number): { token: string };
  verify(token: string): AttendanceTokenPayload;
};

function signature(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function createAttendanceTokenCodec(secret: string): AttendanceTokenCodec {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("A chave de assinatura dos QR Codes não está configurada com segurança.");
  }

  return {
    issue(activityId, qrVersion) {
      if (!z.string().uuid().safeParse(activityId).success) throw new Error("Atividade inválida.");
      if (!Number.isInteger(qrVersion) || qrVersion < 1) {
        throw new Error("Versão do QR Code inválida.");
      }
      const encodedPayload = Buffer.from(
        JSON.stringify({ v: 2, activityId, qrVersion }),
      ).toString("base64url");
      const encodedSignature = signature(encodedPayload, secret).toString("base64url");
      return { token: `v2.${encodedPayload}.${encodedSignature}` };
    },

    verify(token) {
      const [version, encodedPayload, encodedSignature, extra] = token.split(".");
      if (version !== "v2" || !encodedPayload || !encodedSignature || extra) {
        throw new Error("QR Code inválido.");
      }

      const expected = signature(encodedPayload, secret);
      let supplied: Buffer;
      try {
        supplied = Buffer.from(encodedSignature, "base64url");
      } catch {
        throw new Error("QR Code inválido.");
      }
      if (
        supplied.toString("base64url") !== encodedSignature ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        throw new Error("QR Code inválido.");
      }

      try {
        const payload = payloadSchema.parse(
          JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
        );
        return { activityId: payload.activityId, qrVersion: payload.qrVersion };
      } catch {
        throw new Error("QR Code inválido.");
      }
    },
  };
}
