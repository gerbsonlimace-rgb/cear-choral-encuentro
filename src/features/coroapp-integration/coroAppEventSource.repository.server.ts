import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { coroAppEventSourceSchema, type CoroAppEventSource } from "./coroAppEventSource.domain";
import type { CoroAppEventSourceRepository } from "./coroAppEventSource.server";

type SourceRow = {
  event_id: string;
  public_url: string;
  event_name: string;
  sort_order: number;
  updated_at: string;
};

type QueryResult<T> = { data: T; error: { message: string } | null };

function mapRow(row: SourceRow): CoroAppEventSource {
  return coroAppEventSourceSchema.parse({
    eventId: row.event_id,
    publicUrl: row.public_url,
    eventName: row.event_name,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  });
}

export function createCoroAppEventSourceRepository(): CoroAppEventSourceRepository {
  return {
    async list() {
      const result = (await supabaseAdmin
        .from("coroapp_event_sources" as never)
        .select("event_id,public_url,event_name,sort_order,updated_at")
        .order("sort_order", { ascending: true })) as unknown as QueryResult<SourceRow[]>;
      if (result.error) throw new Error("Não foi possível carregar os eventos do CoroApp.");
      return (result.data || []).map(mapRow);
    },
    async replace(sources, updatedBy) {
      const result = (await supabaseAdmin.rpc(
        "replace_coroapp_event_sources" as never,
        {
          p_admin_user_id: updatedBy,
          p_sources: sources.map((source) => ({
            event_id: source.eventId,
            public_url: source.publicUrl,
            event_name: source.eventName,
            sort_order: source.sortOrder,
          })),
        } as never,
      )) as unknown as QueryResult<SourceRow[]>;
      if (result.error) throw new Error("Não foi possível salvar os eventos do CoroApp.");
      return (result.data || []).map(mapRow);
    },
  };
}
