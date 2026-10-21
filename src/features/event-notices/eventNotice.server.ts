import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";
import {
  eventNoticeCreateSchema,
  eventNoticeUpdateSchema,
  sortEventNotices,
  type EventNotice,
  type EventNoticeCreate,
  type EventNoticeUpdate,
} from "./eventNotice.domain";

export type EventNoticeRepository = {
  list(): Promise<EventNotice[]>;
  find(id: string): Promise<EventNotice | null>;
  listPublishedGeneral(): Promise<EventNotice[]>;
  listPublished(eventIds: string[]): Promise<EventNotice[]>;
  create(input: EventNoticeCreate & { adminUserId: string }): Promise<EventNotice>;
  update(id: string, input: EventNoticeCreate & { adminUserId: string }): Promise<EventNotice>;
};

export function createEventNoticeService({
  repository,
  listSources,
  isEventPublished,
}: {
  repository: EventNoticeRepository;
  listSources: () => Promise<CoroAppEventSource[]>;
  isEventPublished: (eventId: string) => Promise<boolean>;
}) {
  function named(notice: EventNotice, sources: CoroAppEventSource[]): EventNotice {
    return {
      ...notice,
      eventName:
        notice.eventId === null
          ? "Aviso geral"
          : sources.find((source) => source.eventId === notice.eventId)?.eventName ??
            "Evento não configurado",
    };
  }

  async function validateEvent(eventId: string) {
    const sources = await listSources();
    if (!sources.some((source) => source.eventId === eventId))
      throw new Error("Selecione um evento configurado.");
    return sources;
  }

  return {
    async listAdmin() {
      const [notices, sources] = await Promise.all([repository.list(), listSources()]);
      return sortEventNotices(notices).map((notice) => named(notice, sources));
    },
    async listParticipant() {
      const [generalNotices, sources] = await Promise.all([
        repository.listPublishedGeneral(),
        listSources().catch(() => []),
      ]);
      const published = await Promise.allSettled(
        sources.map(async (source) =>
          (await isEventPublished(source.eventId)) ? source.eventId : null,
        ),
      );
      const eventIds = published.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      );
      const notices = eventIds.length ? await repository.listPublished(eventIds) : [];
      return sortEventNotices([...generalNotices, ...notices]).map((notice) => named(notice, sources));
    },
    async create(input: EventNoticeCreate & { adminUserId: string }) {
      const { adminUserId, ...data } = input;
      const parsed = eventNoticeCreateSchema.parse(data);
      const sources = parsed.eventId === null ? [] : await validateEvent(parsed.eventId);
      return named(await repository.create({ ...parsed, adminUserId }), sources);
    },
    async update(input: EventNoticeUpdate & { adminUserId: string }) {
      const { adminUserId, ...data } = input;
      const { id, ...parsed } = eventNoticeUpdateSchema.parse(data);
      const current = await repository.find(id);
      if (!current) throw new Error("Aviso não encontrado.");
      const sources = parsed.eventId === null ? [] : await listSources();
      const preservingUnpublishedEvent = !parsed.isPublished && current.eventId === parsed.eventId;
      if (
        parsed.eventId !== null &&
        !preservingUnpublishedEvent &&
        !sources.some((source) => source.eventId === parsed.eventId)
      ) {
        throw new Error("Selecione um evento configurado.");
      }
      return named(await repository.update(id, { ...parsed, adminUserId }), sources);
    },
  };
}
