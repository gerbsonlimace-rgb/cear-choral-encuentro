import { createHash, randomBytes } from "node:crypto";
import {
  feedbackAccessRequestSchema,
  feedbackVideoClaimSchema,
  type FeedbackAccess,
} from "./eventFeedback.domain";
import videoConfig from "./feedback-surprise.json";
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
export type FeedbackRpc = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
export const hashFeedbackToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const feedbackRpc: FeedbackRpc = async (name, args) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as { rpc: FeedbackRpc };
  return client.rpc(name, args);
};
async function signVideo(): Promise<string | null> {
  if (!videoConfig.bucket || !videoConfig.path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(videoConfig.bucket)
    .createSignedUrl(videoConfig.path, 1800);
  return error ? null : data.signedUrl;
}
export async function prepareFeedbackAccess(
  input: unknown,
  deps: { rpc: FeedbackRpc; sign: () => Promise<string | null> } = {
    rpc: feedbackRpc,
    sign: signVideo,
  },
): Promise<FeedbackAccess> {
  const parsed = feedbackAccessRequestSchema.parse(input);
  const token = "token" in parsed ? parsed.token : randomBytes(32).toString("hex");
  const args: Record<string, unknown> = { p_token_hash: hashFeedbackToken(token) };
  if ("token" in parsed && parsed.claimId) args.p_claim_id = parsed.claimId;
  if ("identity" in parsed)
    args.p_identity = `${parsed.identity.includes("@") ? "email" : "cpf"}:${parsed.identity}`;
  const { data, error } = await deps.rpc(
    "identity" in parsed ? "prepare_registered_event_feedback" : "registered_feedback_status",
    args,
  );
  if (error?.message === "feedback_use_cpf")
    throw new Error("Este e-mail está em mais de uma inscrição. Informe seu CPF.");
  if (error?.message === "feedback_registration_not_found")
    throw new Error(
      "Não encontramos esse CPF ou e-mail nas inscrições. Confira os dados informados.",
    );
  const row = Array.isArray(data)
    ? (data[0] as { responded: boolean; video_available: boolean } | undefined)
    : undefined;
  if (error || !row)
    throw new Error("Não foi possível conferir sua inscrição. Informe o CPF ou e-mail novamente.");
  const videoUrl = row.video_available ? await deps.sign().catch(() => null) : null;
  return { token, responded: row.responded, videoUrl };
}
export async function claimFeedbackVideo(
  input: unknown,
  rpc: FeedbackRpc = feedbackRpc,
): Promise<{ allowed: boolean }> {
  const { token, claimId } = feedbackVideoClaimSchema.parse(input);
  const { data, error } = await rpc("claim_registered_feedback_video", {
    p_token_hash: hashFeedbackToken(token),
    p_claim_id: claimId,
  });
  if (error) throw new Error("Não foi possível abrir o vídeo agora. Tente novamente.");
  return { allowed: data === true };
}
