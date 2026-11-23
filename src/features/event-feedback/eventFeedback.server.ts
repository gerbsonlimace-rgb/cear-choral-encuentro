import { eventFeedbackSchema, type EventFeedbackStats } from "./eventFeedback.domain";

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
  identity: string,
) => PromiseLike<{ error: { code?: string; message?: string } | null }>;

async function persistFeedback(row: FeedbackRow, identity: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Keep new migration types local until the integration types are regenerated.
  const client = supabaseAdmin as unknown as {
    rpc(
      name: "save_anonymous_event_feedback",
      args: { p_identity: string; p_feedback: FeedbackRow },
    ): ReturnType<PersistFeedback>;
  };
  return client.rpc("save_anonymous_event_feedback", { p_identity: identity, p_feedback: row });
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
    `${data.identity.includes("@") ? "email" : "cpf"}:${data.identity}`,
  );
  // Upsert keeps one row and also saves edits after an uncertain network response.
  if (error?.code === "P0001" && error.message === "feedback_already_sent")
    throw new Error("Já recebemos uma avaliação com este CPF ou e-mail. Obrigado por participar!");
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
