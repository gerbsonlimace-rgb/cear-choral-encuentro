import { createServerFn } from "@tanstack/react-start";

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";

export const getChoristerPortalFeed = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async ({ context }) => {
    const { createChoristerAppServer } = await import(
      "@/features/chorister-app/choristerApp.server"
    );
    return createChoristerAppServer({
      participantAccess: context.participantAccess,
      fetchImpl: globalThis.fetch,
      clock: () => new Date(),
      env: process.env,
    }).load();
  });
