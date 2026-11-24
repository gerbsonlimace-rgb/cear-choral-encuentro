import { eventFeedbackSchema, type EventFeedbackStats } from "./eventFeedback.domain";
import { feedbackRpc, hashFeedbackToken } from "./eventFeedbackAccess.server";

type FeedbackRow = {
  submission_id: string;
  overall: number;
  organization: number | null;
  formation: number | null;
  celebrations: number | null;
  venue: number | null;
  food: number | null;
  lodging: number | null;
  suggestion: string;
};
type PersistFeedback = (
  row: FeedbackRow,
  token: string,
) => PromiseLike<{ error: { code?: string; message?: string } | null }>;

async function persistFeedback(row: FeedbackRow, token: string) {
  return feedbackRpc("save_registered_event_feedback", {
    p_token_hash: hashFeedbackToken(token),
    p_feedback: row,
  });
}

export async function saveEventFeedback(
  input: unknown,
  persist: PersistFeedback = persistFeedback,
): Promise<{ saved: true }> {
  const data = eventFeedbackSchema.parse(input);
  const aspects = Object.fromEntries(
    Object.entries(data.aspects).map(([key, value]) => [key, value === "not_used" ? null : value]),
  );
  const { error } = await persist(
    {
      submission_id: data.submissionId,
      overall: data.overall,
      ...(aspects as Pick<FeedbackRow, keyof typeof data.aspects>),
      suggestion: data.suggestion,
    },
    data.accessToken,
  );
  // Upsert keeps one row and also saves edits after an uncertain network response.
  if (error?.message === "feedback_already_sent")
    throw new Error("Sua avaliação já foi recebida. Reabra a página para continuar.");
  if (error?.message === "feedback_access_expired")
    throw new Error("Confira novamente seu CPF ou e-mail para enviar a avaliação.");
  if (error)
    throw new Error(
      "Não foi possível enviar sua avaliação. Suas respostas foram mantidas. Tente novamente.",
    );
  return { saved: true };
}

export async function loadEventFeedbackStats(): Promise<EventFeedbackStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  type CountResult = { count: number | null; error: unknown };
  const feedbackClient = supabaseAdmin as unknown as {
    from(table: "event_feedback"): {
      select(columns: string, options: { count: "exact"; head: true }): PromiseLike<CountResult>;
    };
  };
  const results = await Promise.allSettled([
    supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .is("cancelled_at", null),
    feedbackClient.from("event_feedback").select("submission_id", { count: "exact", head: true }),
  ]);
  const count = (index: number) => {
    const result = results[index];
    return result.status === "fulfilled" && !result.value.error ? result.value.count : null;
  };
  return { registrations: count(0), responses: count(1) };
}
