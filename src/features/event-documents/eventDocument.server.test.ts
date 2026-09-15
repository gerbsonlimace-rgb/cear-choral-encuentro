import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";

import {
  createEventDocumentService,
  type EventDocumentRepository,
  type EventDocumentStorage,
} from "./eventDocument.server";

const eventId = "22222222-2222-4222-8222-222222222222";
const otherEventId = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";
const replacementId = "55555555-5555-4555-8555-555555555555";
const adminId = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-12T21:00:00.000Z";

const source: CoroAppEventSource = {
  eventId,
  eventName: "Grande Concerto",
  publicUrl: `https://coroapp.example.com/e/${eventId}`,
  sortOrder: 0,
  updatedAt: now,
};

async function pdfUpload() {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  return {
    base64: Buffer.from(bytes).toString("base64"),
    mimeType: "application/pdf" as const,
    fileName: "guia oficial.pdf",
  };
}

function createRepository(): EventDocumentRepository {
  return {
    list: vi.fn(async () => []),
    listGeneral: vi.fn(async () => []),
    listByEventIds: vi.fn(async () => []),
    find: vi.fn(async () => null),
    create: vi.fn(async (input) => ({ ...input, eventName: "", createdAt: now, updatedAt: now })),
    update: vi.fn(async (id, input) => ({
      id,
      eventId: input.eventId,
      eventName: "",
      title: input.title,
      category: input.category,
      storagePath: input.storagePath ?? `${eventId}/${id}/original.pdf`,
      originalFileName: input.originalFileName ?? "original.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: input.sizeBytes ?? 512,
      createdAt: now,
      updatedAt: now,
    })),
    deleteExact: vi.fn(async () => undefined),
  };
}

function createStorage(): EventDocumentStorage {
  return {
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    createSignedUrl: vi.fn(async () => "https://signed.example.test/document.pdf?token=short"),
  };
}

describe("event document service", () => {
  let repository: EventDocumentRepository;
  let storage: EventDocumentStorage;
  let publishedEventIds: Set<string>;

  beforeEach(() => {
    repository = createRepository();
    storage = createStorage();
    publishedEventIds = new Set([eventId]);
  });

  function service(ids = [documentId, replacementId]) {
    return createEventDocumentService({
      repository,
      storage,
      listSources: vi.fn(async () => [source]),
      isEventPublished: vi.fn(async (candidate) => publishedEventIds.has(candidate)),
      createId: vi.fn(() => ids.shift() ?? replacementId),
      clock: () => new Date(now),
    });
  }

  it("creates and opens a general PDF without loading any event configuration", async () => {
    const independentService = createEventDocumentService({
      repository,
      storage,
      listSources: async () => {
        throw new Error("No event configuration available");
      },
      isEventPublished: async () => false,
      createId: () => documentId,
    });
    const saved = await independentService.create({
      title: "Orientações",
      file: await pdfUpload(),
      adminUserId: adminId,
    });
    expect(saved).toMatchObject({ title: "Orientações", eventId: null, category: "Documentos" });
    expect(saved.storagePath).toBe(`general/${documentId}/${documentId}.pdf`);
    vi.mocked(repository.find).mockResolvedValue(saved);
    await expect(
      independentService.createParticipantSignedUrl({ id: saved.id }),
    ).resolves.toMatchObject({ expiresIn: 120 });
    vi.mocked(repository.listGeneral).mockResolvedValue([saved]);
    await expect(independentService.listGeneralAssets()).resolves.toEqual([
      expect.objectContaining({
        id: saved.id,
        title: "Orientações",
        kind: "document",
        sortOrder: 0,
      }),
    ]);
    const updated = await independentService.update({
      id: saved.id,
      title: "Orientações atualizadas",
      adminUserId: adminId,
    });
    expect(updated).toMatchObject({ eventId: null, title: "Orientações atualizadas" });
    const replaced = await independentService.update({
      id: saved.id,
      title: "Novo PDF",
      file: await pdfUpload(),
      adminUserId: adminId,
    });
    expect(replaced).toMatchObject({
      eventId: null,
      storagePath: `general/${documentId}/${documentId}.pdf`,
    });
  });

  it("uploads a validated PDF to a server-generated path only for a configured event", async () => {
    const upload = await pdfUpload();

    await expect(
      service().create({
        eventId,
        title: "Guia do evento",
        category: "Guia",
        file: upload,
        adminUserId: adminId,
      }),
    ).resolves.toMatchObject({
      id: documentId,
      eventId,
      eventName: "Grande Concerto",
      title: "Guia do evento",
      originalFileName: "guia oficial.pdf",
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${eventId}/${documentId}/${replacementId}.pdf`,
        contentType: "application/pdf",
      }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: documentId,
        eventId,
        storagePath: `${eventId}/${documentId}/${replacementId}.pdf`,
        createdBy: adminId,
        updatedBy: adminId,
      }),
    );
  });

  it("rejects an event that is not in the configured CoroApp sources before uploading", async () => {
    const upload = await pdfUpload();

    await expect(
      service().create({
        eventId: otherEventId,
        title: "Guia",
        category: "Guia",
        file: upload,
        adminUserId: adminId,
      }),
    ).rejects.toThrow("Selecione um evento configurado.");
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("removes a newly uploaded object when metadata persistence fails", async () => {
    const upload = await pdfUpload();
    vi.mocked(repository.create).mockRejectedValueOnce(new Error("db unavailable"));

    await expect(
      service().create({
        eventId,
        title: "Guia",
        category: "Guia",
        file: upload,
        adminUserId: adminId,
      }),
    ).rejects.toThrow("Não foi possível salvar o documento.");
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith([
      `${eventId}/${documentId}/${replacementId}.pdf`,
    ]);
  });

  it("replaces the database path before deleting the previous object", async () => {
    const upload = await pdfUpload();
    const previous = {
      id: documentId,
      eventId,
      eventName: "Grande Concerto",
      title: "Guia antigo",
      category: "Guia",
      storagePath: `${eventId}/${documentId}/old.pdf`,
      originalFileName: "old.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 100,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(repository.find).mockResolvedValue(previous);
    const order: string[] = [];
    vi.mocked(repository.update).mockImplementation(async (id, input) => {
      order.push("metadata");
      return { ...previous, ...input, id, eventName: "" };
    });
    vi.mocked(storage.remove).mockImplementation(async () => {
      order.push("old-object");
    });

    await service([replacementId]).update({
      id: documentId,
      eventId,
      title: "Guia novo",
      category: "Guia",
      file: upload,
      adminUserId: adminId,
    });

    expect(order).toEqual(["metadata", "old-object"]);
    expect(storage.remove).toHaveBeenCalledWith([previous.storagePath]);
  });

  it("keeps the replacement readable when cleanup of the previous private object fails", async () => {
    const upload = await pdfUpload();
    const previous = {
      id: documentId,
      eventId,
      eventName: "Grande Concerto",
      title: "Guia antigo",
      category: "Guia",
      storagePath: `${eventId}/${documentId}/old.pdf`,
      originalFileName: "old.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 100,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(repository.find).mockResolvedValue(previous);
    vi.mocked(repository.update).mockImplementation(async (id, input) => ({
      ...previous,
      ...input,
      id,
      eventName: "",
    }));
    vi.mocked(storage.remove).mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      service([replacementId]).update({
        id: documentId,
        eventId,
        title: "Guia novo",
        category: "Guia",
        file: upload,
        adminUserId: adminId,
      }),
    ).resolves.toMatchObject({
      storagePath: `${eventId}/${documentId}/${replacementId}.pdf`,
      title: "Guia novo",
    });
    expect(repository.update).toHaveBeenCalledWith(
      documentId,
      expect.objectContaining({
        storagePath: `${eventId}/${documentId}/${replacementId}.pdf`,
      }),
    );
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith([previous.storagePath]);
  });

  it("deletes the exact metadata first and reports a private orphan if Storage cleanup fails", async () => {
    const persisted = {
      id: documentId,
      eventId,
      eventName: "Grande Concerto",
      title: "Guia",
      category: "Guia",
      storagePath: `${eventId}/${documentId}/exact.pdf`,
      originalFileName: "guia.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 100,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(repository.find).mockResolvedValue(persisted);
    const order: string[] = [];
    vi.mocked(repository.deleteExact).mockImplementation(async () => {
      order.push("metadata");
    });
    vi.mocked(storage.remove).mockImplementation(async () => {
      order.push("object");
    });

    await expect(service().remove({ id: documentId })).resolves.toEqual({
      cleanupPending: false,
    });
    expect(order).toEqual(["metadata", "object"]);
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith([persisted.storagePath]);
    expect(repository.deleteExact).toHaveBeenCalledExactlyOnceWith(
      documentId,
      persisted.storagePath,
    );

    vi.mocked(storage.remove).mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(service().remove({ id: documentId })).resolves.toEqual({
      cleanupPending: true,
    });
    expect(repository.deleteExact).toHaveBeenCalledTimes(2);
  });

  it("returns participant documents and signed URLs only for configured events", async () => {
    const allowed = {
      id: documentId,
      eventId,
      eventName: "",
      title: "Livro de partituras",
      category: "Livro de partituras",
      storagePath: `${eventId}/${documentId}/book.pdf`,
      originalFileName: "book.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 123,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(repository.listByEventIds).mockResolvedValue([allowed]);
    vi.mocked(repository.find).mockResolvedValue(allowed);

    await expect(service().listParticipant()).resolves.toEqual([
      { ...allowed, eventName: "Grande Concerto" },
    ]);
    await expect(service().createParticipantSignedUrl({ id: documentId })).resolves.toEqual({
      signedUrl: "https://signed.example.test/document.pdf?token=short",
      expiresIn: 120,
    });
    expect(repository.listByEventIds).toHaveBeenCalledWith([eventId]);
    expect(storage.createSignedUrl).toHaveBeenCalledExactlyOnceWith(allowed.storagePath, 120);

    vi.mocked(repository.find).mockResolvedValue({ ...allowed, eventId: otherEventId });
    await expect(service().createParticipantSignedUrl({ id: documentId })).rejects.toThrow(
      "Documento não disponível.",
    );
  });

  it("does not list or sign a document when its configured CoroApp event is no longer published", async () => {
    const document = {
      id: documentId,
      eventId,
      eventName: "",
      title: "Guia",
      category: "Guia",
      storagePath: `${eventId}/${documentId}/guide.pdf`,
      originalFileName: "guide.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 123,
      createdAt: now,
      updatedAt: now,
    };
    publishedEventIds.clear();
    vi.mocked(repository.find).mockResolvedValue(document);

    await expect(service().listParticipant()).resolves.toEqual([]);
    await expect(service().createParticipantSignedUrl({ id: documentId })).rejects.toThrow(
      "Documento não disponível.",
    );
    expect(repository.listByEventIds).toHaveBeenCalledWith([]);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it("maps participant documents to the strict event asset contract with short URLs", async () => {
    const allowed = {
      id: documentId,
      eventId,
      eventName: "",
      title: "Livro de partituras",
      category: "Livro de partituras",
      storagePath: `${eventId}/${documentId}/book.pdf`,
      originalFileName: "book.pdf",
      mimeType: "application/pdf" as const,
      sizeBytes: 123,
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(repository.listByEventIds).mockResolvedValue([allowed]);

    await expect(service().listParticipantAssets()).resolves.toEqual([
      {
        eventId,
        asset: {
          id: documentId,
          title: "Livro de partituras",
          category: "Livro de partituras",
          kind: "document",
          sortOrder: 0,
          signedUrl: "https://signed.example.test/document.pdf?token=short",
          expiresAt: "2026-09-12T21:02:00.000Z",
        },
      },
    ]);
    expect(storage.createSignedUrl).toHaveBeenCalledExactlyOnceWith(allowed.storagePath, 120);
  });
});
