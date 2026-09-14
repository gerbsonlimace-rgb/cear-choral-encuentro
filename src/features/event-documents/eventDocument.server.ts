import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";
import type { ChoristerPortalCollection } from "@/features/chorister-app/choristerApp.domain";

import {
  eventDocumentActionSchema,
  eventDocumentCreateSchema,
  eventDocumentMetadataSchema,
  eventDocumentUpdateSchema,
  validateEventDocumentPdf,
  type EventDocument,
  type EventDocumentCreate,
  type EventDocumentUpdate,
} from "./eventDocument.domain";

export type EventDocumentPersistence = Omit<
  EventDocument,
  "eventName" | "createdAt" | "updatedAt"
> & {
  createdBy: string;
  updatedBy: string;
};

export type EventDocumentRepository = {
  list(): Promise<EventDocument[]>;
  listByEventIds(eventIds: string[]): Promise<EventDocument[]>;
  find(id: string): Promise<EventDocument | null>;
  create(input: EventDocumentPersistence): Promise<EventDocument>;
  update(
    id: string,
    input: Pick<EventDocument, "eventId" | "title" | "category"> &
      Partial<
        Pick<EventDocument, "storagePath" | "originalFileName" | "mimeType" | "sizeBytes">
      > & { updatedBy: string },
  ): Promise<EventDocument>;
  deleteExact(id: string, storagePath: string): Promise<void>;
};

export type EventDocumentStorage = {
  upload(input: { path: string; bytes: Uint8Array; contentType: "application/pdf" }): Promise<void>;
  remove(paths: string[]): Promise<void>;
  createSignedUrl(path: string, expiresIn: number): Promise<string>;
};

type ServiceOptions = {
  repository: EventDocumentRepository;
  storage: EventDocumentStorage;
  listSources: () => Promise<CoroAppEventSource[]>;
  isEventPublished: (eventId: string) => Promise<boolean>;
  createId?: () => string;
  clock?: () => Date;
};

type AdminCreateInput = EventDocumentCreate & { adminUserId: string };
type AdminUpdateInput = EventDocumentUpdate & { adminUserId: string };

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function withEventName(document: EventDocument, sources: readonly CoroAppEventSource[]) {
  return {
    ...document,
    eventName:
      sources.find(({ eventId }) => eventId === document.eventId)?.eventName ??
      "Evento não configurado",
  };
}

function requireConfiguredEvent(
  eventId: string,
  sources: readonly CoroAppEventSource[],
): CoroAppEventSource {
  const source = sources.find((candidate) => candidate.eventId === eventId);
  if (!source) throw new Error("Selecione um evento configurado.");
  return source;
}

export function createEventDocumentService({
  repository,
  storage,
  listSources,
  isEventPublished,
  createId = () => crypto.randomUUID(),
  clock = () => new Date(),
}: ServiceOptions) {
  async function configuredSources() {
    return listSources();
  }

  async function prepareFile(file: EventDocumentCreate["file"]) {
    const bytes = decodeBase64(file.base64);
    await validateEventDocumentPdf(bytes, file.mimeType);
    return bytes;
  }

  async function listParticipantDocuments(knownPublishedEventIds?: readonly string[]) {
    const sources = await configuredSources();
    const configuredEventIds = new Set(sources.map(({ eventId }) => eventId));
    const publishedEventIds = knownPublishedEventIds
      ? knownPublishedEventIds.filter((eventId) => configuredEventIds.has(eventId))
      : (
          await Promise.all(
            sources.map(async ({ eventId }) => ({
              eventId,
              published: await isEventPublished(eventId).catch(() => false),
            })),
          )
        )
          .filter(({ published }) => published)
          .map(({ eventId }) => eventId);
    const documents = await repository.listByEventIds(publishedEventIds);
    return documents.map((document) => withEventName(document, sources));
  }

  return {
    async listAdmin() {
      const [documents, sources] = await Promise.all([repository.list(), configuredSources()]);
      return documents.map((document) => withEventName(document, sources));
    },

    listParticipant: listParticipantDocuments,

    async listParticipantAssets(knownPublishedEventIds?: readonly string[]): Promise<
      Array<{
        eventId: string;
        asset: ChoristerPortalCollection["events"][number]["documents"][number];
      }>
    > {
      const documents = await listParticipantDocuments(knownPublishedEventIds);
      const sortOrders = new Map<string, number>();
      const expiresAt = new Date(clock().getTime() + 120_000).toISOString();
      return Promise.all(
        documents.map(async (document) => {
          const sortOrder = sortOrders.get(document.eventId) ?? 0;
          sortOrders.set(document.eventId, sortOrder + 1);
          return {
            eventId: document.eventId,
            asset: {
              id: document.id,
              title: document.title,
              category: document.category,
              kind: "document" as const,
              sortOrder,
              signedUrl: await storage.createSignedUrl(document.storagePath, 120),
              expiresAt,
            },
          };
        }),
      );
    },

    async create(input: AdminCreateInput) {
      const parsed = eventDocumentCreateSchema.parse({
        eventId: input.eventId,
        title: input.title,
        category: input.category,
        file: input.file,
      });
      const sources = await configuredSources();
      requireConfiguredEvent(parsed.eventId, sources);
      const bytes = await prepareFile(parsed.file);
      const id = createId();
      const storagePath = `${parsed.eventId}/${id}/${createId()}.pdf`;

      await storage.upload({ path: storagePath, bytes, contentType: "application/pdf" });
      try {
        const saved = await repository.create({
          id,
          eventId: parsed.eventId,
          title: parsed.title,
          category: parsed.category,
          storagePath,
          originalFileName: parsed.file.fileName,
          mimeType: "application/pdf",
          sizeBytes: bytes.byteLength,
          createdBy: input.adminUserId,
          updatedBy: input.adminUserId,
        });
        return withEventName(saved, sources);
      } catch {
        await storage.remove([storagePath]).catch(() => undefined);
        throw new Error("Não foi possível salvar o documento.");
      }
    },

    async update(input: AdminUpdateInput) {
      const parsed = eventDocumentUpdateSchema.parse({
        id: input.id,
        eventId: input.eventId,
        title: input.title,
        category: input.category,
        ...(input.file ? { file: input.file } : {}),
      });
      const sources = await configuredSources();
      requireConfiguredEvent(parsed.eventId, sources);
      const current = await repository.find(parsed.id);
      if (!current) throw new Error("Documento não encontrado.");

      if (!parsed.file) {
        const saved = await repository.update(parsed.id, {
          ...eventDocumentMetadataSchema.parse({
            eventId: parsed.eventId,
            title: parsed.title,
            category: parsed.category,
          }),
          updatedBy: input.adminUserId,
        });
        return withEventName(saved, sources);
      }

      const bytes = await prepareFile(parsed.file);
      const storagePath = `${parsed.eventId}/${parsed.id}/${createId()}.pdf`;
      await storage.upload({ path: storagePath, bytes, contentType: "application/pdf" });
      let saved: EventDocument;
      try {
        saved = await repository.update(parsed.id, {
          eventId: parsed.eventId,
          title: parsed.title,
          category: parsed.category,
          storagePath,
          originalFileName: parsed.file.fileName,
          mimeType: "application/pdf",
          sizeBytes: bytes.byteLength,
          updatedBy: input.adminUserId,
        });
      } catch {
        await storage.remove([storagePath]).catch(() => undefined);
        throw new Error("Não foi possível salvar o documento.");
      }
      // Metadata already points to the replacement before cleanup. If Storage is
      // temporarily unavailable, the remaining private object is only an orphan;
      // participant/admin reads can never receive a broken signed URL.
      await storage.remove([current.storagePath]).catch(() => undefined);
      return withEventName(saved, sources);
    },

    async remove(input: { id: string }) {
      const { id } = eventDocumentActionSchema.parse(input);
      const current = await repository.find(id);
      if (!current) throw new Error("Documento não encontrado.");
      try {
        await repository.deleteExact(id, current.storagePath);
      } catch {
        throw new Error("Não foi possível excluir o documento.");
      }
      try {
        await storage.remove([current.storagePath]);
        return { cleanupPending: false };
      } catch {
        // The metadata is already gone, so this private orphan cannot receive a new signed URL.
        // Reporting it lets the administrative UI surface that only Storage cleanup is pending.
        return { cleanupPending: true };
      }
    },

    async createAdminSignedUrl(input: { id: string }) {
      const { id } = eventDocumentActionSchema.parse(input);
      const document = await repository.find(id);
      if (!document) throw new Error("Documento não encontrado.");
      return {
        signedUrl: await storage.createSignedUrl(document.storagePath, 120),
        expiresIn: 120 as const,
      };
    },

    async createParticipantSignedUrl(input: { id: string }) {
      const { id } = eventDocumentActionSchema.parse(input);
      const [document, sources] = await Promise.all([repository.find(id), configuredSources()]);
      const configured = document
        ? sources.some(({ eventId }) => eventId === document.eventId)
        : false;
      const published =
        document && configured
          ? await isEventPublished(document.eventId).catch(() => false)
          : false;
      if (!document || !configured || !published) {
        throw new Error("Documento não disponível.");
      }
      return {
        signedUrl: await storage.createSignedUrl(document.storagePath, 120),
        expiresIn: 120 as const,
      };
    },
  };
}
