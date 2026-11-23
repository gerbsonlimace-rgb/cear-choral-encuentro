import { eventFeedbackSchema } from "./eventFeedback.domain";

type FeedbackRow = {
  submission_id: string;
  overall: number;
  organization: number | null;
  formation: number | null;
  celebrations: number | null;
  fellowship: number | null;
  venue: number | null;
  food: number | null;
  lodging: number | null;
  transport: number | null;
  contribution: number;
  return_intent: string;
  suggestion: string;
};
type PersistFeedback = (row: FeedbackRow) => PromiseLike<{ error: { code?: string } | null }>;

async function persistFeedback(row: FeedbackRow) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Keep new migration types local until the integration types are regenerated.
  const client = supabaseAdmin as unknown as {
    from(table: "event_feedback"): {
      upsert(value: FeedbackRow, options: { onConflict: string }): ReturnType<PersistFeedback>;
    };
  };
  return client.from("event_feedback").upsert(row, { onConflict: "submission_id" });
}

export async function saveEventFeedback(
  input: unknown,
  persist: PersistFeedback = persistFeedback,
): Promise<{ saved: true }> {
  const data = eventFeedbackSchema.parse(input);
  const aspects = Object.fromEntries(
    Object.entries(data.aspects).map(([key, value]) => [key, value === "not_used" ? null : value]),
  );
  const { error } = await persist({
    submission_id: data.submissionId,
    overall: data.overall,
    ...(aspects as Pick<FeedbackRow, keyof typeof data.aspects>),
    contribution: data.contribution,
    return_intent: data.returnIntent,
    suggestion: data.suggestion,
  });
  // Upsert keeps one row and also saves edits after an uncertain network response.
  if (error)
    throw new Error(
      "Não foi possível enviar sua avaliação. Suas respostas foram mantidas. Tente novamente.",
    );
  return { saved: true };
}
