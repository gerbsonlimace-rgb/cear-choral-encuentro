import { normalizeCoroAppEventUrls, type CoroAppEventSource } from "./coroAppEventSource.domain";

export type CoroAppEventSourceRepository = {
  list(): Promise<CoroAppEventSource[]>;
  replace(
    input: Array<{
      eventId: string;
      publicUrl: string;
      eventName: string;
      sortOrder: number;
    }>,
    updatedBy: string,
  ): Promise<CoroAppEventSource[]>;
};

export type CoroAppEventVerifier = {
  verify(eventId: string): Promise<{ eventId: string; name: string } | null>;
};

type ServiceOptions = {
  repository: CoroAppEventSourceRepository;
  verifier: CoroAppEventVerifier;
  trustedOrigins: readonly string[];
};

export function createCoroAppEventSourceService({
  repository,
  verifier,
  trustedOrigins,
}: ServiceOptions) {
  return {
    list: () => repository.list(),
    async replace(input: {
      publicUrls: string[];
      updatedBy: string;
    }): Promise<CoroAppEventSource[]> {
      const normalized = normalizeCoroAppEventUrls(input.publicUrls, trustedOrigins);
      const verified = await Promise.all(
        normalized.map(async (source) => ({
          source,
          event: await verifier.verify(source.eventId),
        })),
      );
      if (verified.some(({ source, event }) => !event || event.eventId !== source.eventId)) {
        throw new Error("Um dos eventos não está disponível no feed autorizado do CoroApp.");
      }
      return repository.replace(
        verified.map(({ source, event }) => ({
          ...source,
          eventName: event!.name,
        })),
        input.updatedBy,
      );
    },
  };
}
