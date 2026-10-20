import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EventNotice } from "./eventNotice.domain";
import type { EventNoticeRepository } from "./eventNotice.server";

const columns = "id,event_id,title,body,is_published,created_at,updated_at";
type NoticeRow = {
  id: string;
  event_id: string | null;
  title: string;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};
type QueryError = { message?: string } | null;

function mapRow(row: NoticeRow): EventNotice {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    body: row.body,
    isPublished: row.is_published,
    eventName: "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseEventNoticeRepository(): EventNoticeRepository {
  async function save(query: PromiseLike<{ data: unknown; error: QueryError }>) {
    const { data, error } = await query;
    if (error) throw new Error("Não foi possível salvar o aviso.");
    if (!data) throw new Error("Aviso não encontrado. Atualize a página.");
    return mapRow(data as NoticeRow);
  }
  return {
    async find(id) {
      const { data, error } = await supabaseAdmin
        .from("event_notices" as never)
        .select(columns)
        .eq("id", id as never)
        .maybeSingle();
      if (error) throw new Error("Não foi possível carregar o aviso.");
      return data ? mapRow(data as unknown as NoticeRow) : null;
    },
    async list() {
      const { data, error } = await supabaseAdmin
        .from("event_notices" as never)
        .select(columns)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Não foi possível carregar os avisos.");
      return ((data ?? []) as unknown as NoticeRow[]).map(mapRow);
    },
    async listPublishedGeneral() {
      const { data, error } = await supabaseAdmin
        .from("event_notices" as never)
        .select(columns)
        .is("event_id", null)
        .eq("is_published", true as never)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Não foi possível carregar os avisos.");
      return ((data ?? []) as unknown as NoticeRow[]).map(mapRow);
    },
    async listPublished(eventIds) {
      if (!eventIds.length) return [];
      const { data, error } = await supabaseAdmin
        .from("event_notices" as never)
        .select(columns)
        .in("event_id", eventIds as never)
        .eq("is_published", true as never)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Não foi possível carregar os avisos.");
      return ((data ?? []) as unknown as NoticeRow[]).map(mapRow);
    },
    create(input) {
      return save(
        supabaseAdmin
          .from("event_notices" as never)
          .insert({
            event_id: input.eventId,
            title: input.title,
            body: input.body,
            is_published: input.isPublished,
            created_by: input.adminUserId,
            updated_by: input.adminUserId,
          } as never)
          .select(columns)
          .single(),
      );
    },
    update(id, input) {
      return save(
        supabaseAdmin
          .from("event_notices" as never)
          .update({
            event_id: input.eventId,
            title: input.title,
            body: input.body,
            is_published: input.isPublished,
            updated_by: input.adminUserId,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id as never)
          .select(columns)
          .maybeSingle(),
      );
    },
  };
}
