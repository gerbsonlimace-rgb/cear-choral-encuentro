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

export const loginParticipant = createServerFn({ method: "POST" })
  .validator(participantLoginSchema)
  .handler(async ({ data }) => loginParticipantWithCredentials(data));

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
