import { getCoroAppEventSourceService } from "@/features/coroapp-integration/coroAppEventSource.service.server";
import { loadCoroAppFeed } from "@/features/chorister-app/choristerApp.server";
import { createSupabaseEventNoticeRepository } from "./eventNotice.repository.server";
import { createEventNoticeService } from "./eventNotice.server";

let service: ReturnType<typeof createEventNoticeService> | undefined;

export function getEventNoticeService() {
  service ??= createEventNoticeService({
    repository: createSupabaseEventNoticeRepository(),
    listSources: () => getCoroAppEventSourceService().list(),
    async isEventPublished(eventId) {
      const feed = await loadCoroAppFeed({
        eventId,
        fetchImpl: globalThis.fetch,
        clock: () => new Date(),
        env: process.env,
      });
      if (feed.status === "unavailable")
        throw new Error("Não foi possível consultar os eventos dos avisos.");
      return feed.status === "published" && feed.event.id === eventId;
    },
  });
  return service;
}
