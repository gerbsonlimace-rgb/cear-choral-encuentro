import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { EventDocument } from "./eventDocument.domain";
import type { EventDocumentRepository, EventDocumentStorage } from "./eventDocument.server";

export const EVENT_DOCUMENT_BUCKET = "event-documents";

const columns =
  "id,event_id,title,category,storage_path,original_file_name,mime_type,size_bytes,created_at,updated_at" as const;

type EventDocumentRow = {
  id: string;
  event_id: string;
  title: string;
  category: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

type QueryError = { code?: string; message?: string } | null;

function mapRow(row: EventDocumentRow): EventDocument {
  if (row.mime_type !== "application/pdf") {
    throw new Error("O cadastro do documento possui um formato inválido.");
  }
  return {
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
  };
}

function checkQuery(error: QueryError, message: string) {
  if (error) throw new Error(message);
}

export function createSupabaseEventDocumentRepository(): EventDocumentRepository {
  const save = async (
    query: PromiseLike<{ data: unknown; error: QueryError }>,
  ): Promise<EventDocument> => {
    const { data, error } = await query;
    checkQuery(error, "Não foi possível salvar o documento.");
    if (!data) throw new Error("Documento não encontrado.");
    return mapRow(data as EventDocumentRow);
  };

  return {
    async list() {
      const { data, error } = (await supabaseAdmin
        .from("event_documents" as never)
        .select(columns)
        .order("created_at", { ascending: false })) as unknown as {
        data: EventDocumentRow[] | null;
        error: QueryError;
      };
      checkQuery(error, "Não foi possível carregar os documentos.");
      return (data ?? []).map(mapRow);
    },

    async listByEventIds(eventIds) {
      if (eventIds.length === 0) return [];
      const { data, error } = (await supabaseAdmin
        .from("event_documents" as never)
        .select(columns)
        .in("event_id", eventIds as never)
        .order("created_at", { ascending: false })) as unknown as {
        data: EventDocumentRow[] | null;
        error: QueryError;
      };
      checkQuery(error, "Não foi possível carregar os documentos.");
      return (data ?? []).map(mapRow);
    },

    async find(id) {
      const { data, error } = (await supabaseAdmin
        .from("event_documents" as never)
        .select(columns)
        .eq("id", id as never)
        .maybeSingle()) as unknown as { data: EventDocumentRow | null; error: QueryError };
      checkQuery(error, "Não foi possível carregar o documento.");
      return data ? mapRow(data) : null;
    },

    create(input) {
      return save(
        supabaseAdmin
          .from("event_documents" as never)
          .insert({
            id: input.id,
            event_id: input.eventId,
            title: input.title,
            category: input.category,
            storage_path: input.storagePath,
            original_file_name: input.originalFileName,
            mime_type: input.mimeType,
            size_bytes: input.sizeBytes,
            created_by: input.createdBy,
            updated_by: input.updatedBy,
          } as never)
          .select(columns)
          .single(),
      );
    },

    update(id, input) {
      return save(
        supabaseAdmin
          .from("event_documents" as never)
          .update({
            event_id: input.eventId,
            title: input.title,
            category: input.category,
            ...(input.storagePath ? { storage_path: input.storagePath } : {}),
            ...(input.originalFileName ? { original_file_name: input.originalFileName } : {}),
            ...(input.mimeType ? { mime_type: input.mimeType } : {}),
            ...(input.sizeBytes === undefined ? {} : { size_bytes: input.sizeBytes }),
            updated_by: input.updatedBy,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id as never)
          .select(columns)
          .single(),
      );
    },

    async deleteExact(id, storagePath) {
      const { data, error } = (await supabaseAdmin
        .from("event_documents" as never)
        .delete()
        .eq("id", id as never)
        .eq("storage_path", storagePath as never)
        .select("id")
        .maybeSingle()) as unknown as { data: { id: string } | null; error: QueryError };
      checkQuery(error, "Não foi possível excluir o documento.");
      if (!data)
        throw new Error("O documento mudou antes da exclusão. Atualize e tente novamente.");
    },
  };
}

export function createSupabaseEventDocumentStorage(): EventDocumentStorage {
  return {
    async upload({ path, bytes, contentType }) {
      const { error } = await supabaseAdmin.storage
        .from(EVENT_DOCUMENT_BUCKET)
        .upload(path, bytes, {
          cacheControl: "3600",
          contentType,
          upsert: false,
        });
      if (error) throw new Error("Não foi possível enviar o documento.");
    },

    async remove(paths) {
      const { error } = await supabaseAdmin.storage.from(EVENT_DOCUMENT_BUCKET).remove(paths);
      if (error) throw new Error("Não foi possível excluir o arquivo do documento.");
    },

    async createSignedUrl(path, expiresIn) {
      const { data, error } = await supabaseAdmin.storage
        .from(EVENT_DOCUMENT_BUCKET)
        .createSignedUrl(path, expiresIn);
      if (error || !data?.signedUrl) {
        throw new Error("Não foi possível abrir o documento.");
      }
      return data.signedUrl;
    },
  };
}
