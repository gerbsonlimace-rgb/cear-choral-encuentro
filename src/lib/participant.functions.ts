import { createServerFn } from "@tanstack/react-start";

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";

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
