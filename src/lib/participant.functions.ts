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

const participantPasswordRecoverySchema = z
  .object({
    cpf: z.string().trim().min(11).max(14),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    email: z.string().trim().email(),
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
    return getParticipantProvisioningService().requestPasswordRecovery(
      data,
      participantPasswordRecoveryRedirect(),
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
