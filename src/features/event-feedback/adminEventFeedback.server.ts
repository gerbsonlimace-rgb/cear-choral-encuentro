import type { AdminFeedbackRow } from "./adminEventFeedback.domain";

type ReadPage = (
  from: number,
  to: number,
) => PromiseLike<{ data: AdminFeedbackRow[] | null; error: unknown }>;

async function readFeedbackPage(from: number, to: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The table is intentionally unavailable to browser roles. Select only opinions,
  // never the private participation/access tables or registration identifiers.
  const client = supabaseAdmin as unknown as {
    from(table: "event_feedback"): {
      select(columns: string): {
        order(
          column: string,
          options: { ascending: boolean },
        ): {
          order(column: string, options: { ascending: boolean }): { range: ReadPage };
        };
      };
    };
  };
  return client
    .from("event_feedback")
    .select(
      "submission_id,created_at,overall,organization,formation,celebrations,venue,food,lodging,criterion_comments,suggestion",
    )
    .order("created_at", { ascending: false })
    .order("submission_id", { ascending: true })
    .range(from, to);
}

export async function loadAdminEventFeedback(
  read: ReadPage = readFeedbackPage,
  pageSize = 500,
): Promise<AdminFeedbackRow[]> {
  const rows: AdminFeedbackRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await read(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("Não foi possível carregar as avaliações.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
