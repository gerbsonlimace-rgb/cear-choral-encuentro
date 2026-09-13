import { createServerFn } from "@tanstack/react-start";

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";

export const getChoristerPortalFeed = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async ({ context }) => {
    const { getCoroAppEventSourceService } = await import(
      "@/features/coroapp-integration/coroAppEventSource.service.server"
    );
    const { createChoristerAppServer } = await import(
      "@/features/chorister-app/choristerApp.server"
    );
    const sources = await getCoroAppEventSourceService().list();
    return createChoristerAppServer({
      participantAccess: context.participantAccess,
      eventId: sources[0]?.eventId ?? null,
      fetchImpl: globalThis.fetch,
      clock: () => new Date(),
      env: process.env,
    }).load();
  });
