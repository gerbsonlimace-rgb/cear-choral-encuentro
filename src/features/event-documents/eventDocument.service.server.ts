import { getCoroAppEventSourceService } from "@/features/coroapp-integration/coroAppEventSource.service.server";
import { loadCoroAppFeed } from "@/features/chorister-app/choristerApp.server";

import {
  createSupabaseEventDocumentRepository,
  createSupabaseEventDocumentStorage,
} from "./eventDocument.repository.server";
import { createEventDocumentService } from "./eventDocument.server";

let service: ReturnType<typeof createEventDocumentService> | undefined;

export function getEventDocumentService() {
  if (!service) {
    service = createEventDocumentService({
      repository: createSupabaseEventDocumentRepository(),
      storage: createSupabaseEventDocumentStorage(),
      listSources: () => getCoroAppEventSourceService().list(),
      async isEventPublished(eventId) {
        const feed = await loadCoroAppFeed({
          eventId,
          fetchImpl: globalThis.fetch,
          clock: () => new Date(),
          env: process.env,
        });
        return feed.status === "published" && feed.event.id === eventId;
      },
    });
  }
  return service;
}
