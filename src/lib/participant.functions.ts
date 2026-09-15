import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import { loginParticipantWithCredentials } from "@/features/registration/participant-area.server";

const participantLoginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  })
  .strict();

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const participantPasswordRecoverySchema = z
  .object({
    cpf: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length === 11, "CPF inválido"),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isCalendarDate, "Data de nascimento inválida"),
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

const DEFAULT_PUBLIC_SITE_URL = "https://encontrocorosce.lovable.app";

function participantPasswordRecoveryRedirect(): string {
  const siteUrl = process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_URL;
  return new URL("/acessar?recuperacao=senha", siteUrl).toString();
}

export const loginParticipant = createServerFn({ method: "POST" })
  .validator(participantLoginSchema)
  .handler(async ({ data }) => loginParticipantWithCredentials(data));

export const requestParticipantPasswordRecovery = createServerFn({ method: "POST" })
  .validator(participantPasswordRecoverySchema)
  .handler(async ({ data }) => {
    const { getParticipantProvisioningService } =
      await import("@/features/participant/participant-provisioning.server");
    let ip = "unknown";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const headers = getRequest().headers;
      ip =
        headers.get("cf-connecting-ip")?.trim() ||
        headers.get("x-real-ip")?.trim() ||
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
    } catch {
      // A missing transport IP must not change the public recovery response.
    }
    return getParticipantProvisioningService().requestPasswordRecovery(
      data,
      participantPasswordRecoveryRedirect(),
      { ip, identity: data.cpf.replace(/\D/g, "") },
    );
  });

export const getParticipantAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { getParticipantRequestAccess } =
    await import("@/features/participant/participant-auth.server");
  return getParticipantRequestAccess();
});

export const getParticipantRegistration = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async ({ context }) => {
    const { getParticipantRegistrationLoader } =
      await import("@/features/participant/participant-auth.server");
    return getParticipantRegistrationLoader().load(context.participantAccess);
  });
