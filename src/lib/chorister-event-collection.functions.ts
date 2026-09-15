import { createServerFn } from "@tanstack/react-start";

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";

export const getChoristerPortalCollection = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async ({ context }) => {
    const { createChoristerEventCollectionServer } =
      await import("@/features/chorister-app/choristerEventCollection.server");
    const { loadCoroAppFeed } = await import("@/features/chorister-app/choristerApp.server");
    const { getCoroAppEventSourceService } =
      await import("@/features/coroapp-integration/coroAppEventSource.service.server");
    const { getEventDocumentService } =
      await import("@/features/event-documents/eventDocument.service.server");

    return createChoristerEventCollectionServer({
      participantAccess: context.participantAccess,
      listSources: getCoroAppEventSourceService().list,
      loadDocuments: (publishedEventIds) =>
        getEventDocumentService().listParticipantAssets(publishedEventIds),
      loadEvent: (eventId) =>
        loadCoroAppFeed({
          eventId,
          fetchImpl: globalThis.fetch,
          clock: () => new Date(),
          env: process.env,
        }),
    }).load();
  });
