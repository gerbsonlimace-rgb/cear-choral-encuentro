import { loadCoroAppFeed } from "@/features/chorister-app/choristerApp.server";

import { parseTrustedCoroAppOrigins } from "./coroAppEventSource.domain";
import { createCoroAppEventSourceRepository } from "./coroAppEventSource.repository.server";
import { createCoroAppEventSourceService } from "./coroAppEventSource.server";

const DEFAULT_COROAPP_ORIGIN = "https://coroapp.lovable.app";

export function getTrustedCoroAppOrigins(environment: NodeJS.ProcessEnv = process.env): string[] {
  const configured = parseTrustedCoroAppOrigins(environment.COROAPP_PUBLIC_EVENT_ORIGINS);
  return configured.length > 0 ? configured : [DEFAULT_COROAPP_ORIGIN];
}

export function getCoroAppEventSourceService() {
  return createCoroAppEventSourceService({
    repository: createCoroAppEventSourceRepository(),
    trustedOrigins: getTrustedCoroAppOrigins(),
    verifier: {
      async verify(eventId) {
        const feed = await loadCoroAppFeed({
          eventId,
          fetchImpl: globalThis.fetch,
          clock: () => new Date(),
          env: process.env,
        });
        return feed.status === "published"
          ? { eventId: feed.event.id, name: feed.event.name }
          : null;
      },
    },
  });
}
