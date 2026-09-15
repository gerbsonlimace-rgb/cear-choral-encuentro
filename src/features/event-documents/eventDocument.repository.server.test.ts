import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseAdminMock }));

import {
  EVENT_DOCUMENT_BUCKET,
  createSupabaseEventDocumentRepository,
  createSupabaseEventDocumentStorage,
} from "./eventDocument.repository.server";

const row = {
  id: "44444444-4444-4444-8444-444444444444",
  event_id: "22222222-2222-4222-8222-222222222222",
  title: "Guia do evento",
  category: "Guia",
  storage_path:
    "22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/guide.pdf",
  original_file_name: "guia.pdf",
  mime_type: "application/pdf",
  size_bytes: 512,
  created_at: "2026-09-12T21:00:00.000Z",
  updated_at: "2026-09-12T21:00:00.000Z",
};

describe("Supabase event document repository", () => {
  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
    supabaseAdminMock.storage.from.mockReset();
  });

  it("loads general documents using a NULL event filter", async () => {
    const order = vi.fn(async () => ({ data: [{ ...row, event_id: null }], error: null }));
    const isFilter = vi.fn(() => ({ order }));
    supabaseAdminMock.from.mockReturnValue({ select: () => ({ is: isFilter }) });
    await expect(createSupabaseEventDocumentRepository().listGeneral()).resolves.toEqual([
      expect.objectContaining({ id: row.id, eventId: null, title: row.title }),
    ]);
    expect(isFilter).toHaveBeenCalledWith("event_id", null);
  });

  it("lists only documents from the requested configured events", async () => {
    const order = vi.fn(async () => ({ data: [row], error: null }));
    const inFilter = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ in: inFilter }));
    supabaseAdminMock.from.mockReturnValue({ select });

    await expect(
      createSupabaseEventDocumentRepository().listByEventIds([row.event_id]),
    ).resolves.toEqual([
      {
        id: row.id,
        eventId: row.event_id,
        eventName: "",
        title: row.title,
        category: row.category,
        storagePath: row.storage_path,
        originalFileName: row.original_file_name,
        mimeType: "application/pdf",
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ]);
    expect(inFilter).toHaveBeenCalledExactlyOnceWith("event_id", [row.event_id]);
    expect(order).toHaveBeenCalledExactlyOnceWith("created_at", { ascending: false });
  });

  it("deletes metadata only when both id and persisted path match", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: row.id }, error: null }));
    const selectAfterDelete = vi.fn(() => ({ maybeSingle }));
    const pathEq = vi.fn(() => ({ select: selectAfterDelete }));
    const idEq = vi.fn(() => ({ eq: pathEq }));
    const deleteQuery = vi.fn(() => ({ eq: idEq }));
    supabaseAdminMock.from.mockReturnValue({ delete: deleteQuery });

    await createSupabaseEventDocumentRepository().deleteExact(row.id, row.storage_path);

    expect(idEq).toHaveBeenCalledExactlyOnceWith("id", row.id);
    expect(pathEq).toHaveBeenCalledExactlyOnceWith("storage_path", row.storage_path);
  });
});

describe("Supabase event document storage", () => {
  it("uses a private bucket without upsert and signs access for the requested lifetime", async () => {
    const upload = vi.fn(async () => ({ data: { path: row.storage_path }, error: null }));
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example.test/document.pdf" },
      error: null,
    }));
    supabaseAdminMock.storage.from.mockReturnValue({ upload, createSignedUrl });
    const storage = createSupabaseEventDocumentStorage();
    const bytes = new Uint8Array([37, 80, 68, 70]);

    await storage.upload({ path: row.storage_path, bytes, contentType: "application/pdf" });
    await expect(storage.createSignedUrl(row.storage_path, 120)).resolves.toBe(
      "https://signed.example.test/document.pdf",
    );

    expect(supabaseAdminMock.storage.from).toHaveBeenCalledWith(EVENT_DOCUMENT_BUCKET);
    expect(upload).toHaveBeenCalledExactlyOnceWith(row.storage_path, bytes, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith(row.storage_path, 120);
  });
});
