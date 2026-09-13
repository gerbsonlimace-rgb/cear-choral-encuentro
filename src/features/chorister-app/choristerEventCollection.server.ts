import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";
import type { ParticipantAccess } from "@/features/participant/participant-auth.server";

import type {
  ChoristerPortalCollection,
  ChoristerPortalCollectionState,
  ChoristerPortalFeedState,
} from "./choristerApp.domain";

type CollectionServerOptions = {
  participantAccess: ParticipantAccess;
  listSources: () => Promise<CoroAppEventSource[]>;
  loadEvent: (eventId: string) => Promise<ChoristerPortalFeedState>;
  loadDocuments?: (publishedEventIds: string[]) => Promise<
    Array<{
      eventId: string;
      asset: ChoristerPortalCollection["events"][number]["documents"][number];
    }>
  >;
};

export function createChoristerEventCollectionServer({
  participantAccess,
  listSources,
  loadEvent,
  loadDocuments = async () => [],
}: CollectionServerOptions) {
  return {
    async load(): Promise<ChoristerPortalCollectionState> {
      if (participantAccess.status !== "authorized") return { status: "unavailable" };

      try {
        const sources = await listSources();
        if (sources.length === 0) return { status: "not_published" };

        const feeds = await Promise.all(sources.map(async ({ eventId }) => {
          try {
            return await loadEvent(eventId);
          } catch {
            console.warn("[CoroApp collection]", { eventId, reason: "event_load_error" });
            return { status: "unavailable" as const };
          }
        }));
        const publishedEventIds = feeds.flatMap((feed) =>
          feed.status === "published" ? [feed.event.id] : [],
        );
        const localDocuments = await loadDocuments(publishedEventIds).catch(() => []);
        const events = feeds
          .flatMap((feed) => (feed.status === "published" ? [feed.event] : []))
          .map((event) => {
            const matching = localDocuments
              .filter(({ eventId }) => eventId === event.id)
              .map(({ asset }, index) => ({
                ...asset,
                sortOrder: event.documents.length + index,
              }));
            return { ...event, documents: [...event.documents, ...matching] };
          });

        if (events.length > 0) return { status: "published", events };
        return feeds.every((feed) => feed.status === "not_published")
          ? { status: "not_published" }
          : { status: "unavailable" };
      } catch {
        console.warn("[CoroApp collection]", { reason: "collection_load_error" });
        return { status: "unavailable" };
      }
    },
  };
}
