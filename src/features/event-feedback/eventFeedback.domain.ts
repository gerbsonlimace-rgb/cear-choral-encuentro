import { z } from "zod";
import { cpfSchema } from "@/features/registration/registration.domain";

export const feedbackIdentitySchema = z
  .string()
  .trim()
  .max(254)
  .transform((value, context) => {
    if (value.includes("@")) {
      const email = z.string().email().safeParse(value);
      if (email.success) return email.data.toLowerCase();
    } else if (/^[\d.\-\s]+$/.test(value)) {
      const cpf = cpfSchema.safeParse(value);
      if (cpf.success) return cpf.data;
    }
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um CPF ou e-mail válido." });
    return z.NEVER;
  });
export const feedbackAccessTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const feedbackAccessRequestSchema = z.union([
  z.object({ identity: feedbackIdentitySchema }).strict(),
  z.object({ token: feedbackAccessTokenSchema, claimId: z.string().uuid().optional() }).strict(),
]);
export const feedbackVideoClaimSchema = z
  .object({ token: feedbackAccessTokenSchema, claimId: z.string().uuid() })
  .strict();
export type FeedbackAccess = { token: string; responded: boolean; videoUrl: string | null };

export const FEEDBACK_ASPECTS = [
  { key: "organization", label: "Organização", description: "Orientações e acolhida" },
  { key: "formation", label: "Formação", description: "Conteúdo musical e litúrgico" },
  { key: "celebrations", label: "Celebrações", description: "Momentos de fé e oração" },
  {
    key: "venue",
    label: "Estrutura",
    description: "Organização do espaço e dos materiais do encontro",
  },
  { key: "food", label: "Alimentação", description: "Refeições oferecidas" },
  { key: "lodging", label: "Hospedagem", description: "Acomodação durante o evento" },
] as const;

export type AspectKey = (typeof FEEDBACK_ASPECTS)[number]["key"];
export type Rating = 1 | 2 | 3 | 4 | 5;
export type AspectRating = Rating | "not_used";
export const RATING_LABELS = ["Péssimo", "Ruim", "Regular", "Bom", "Excelente"] as const;
const rating = z.number().int().min(1).max(5);
const aspectRating = z.union([rating, z.literal("not_used")]);
export const eventFeedbackSchema = z
  .object({
    submissionId: z.string().uuid(),
    accessToken: feedbackAccessTokenSchema,
    overall: rating,
    aspects: z
      .object({
        organization: rating,
        formation: rating,
        celebrations: rating,
        venue: rating,
        food: aspectRating,
        lodging: aspectRating,
      })
      .strict(),
    suggestion: z.string().trim().max(1000).default(""),
  })
  .strict();

export type EventFeedback = z.infer<typeof eventFeedbackSchema>;

export type EventFeedbackStats = { registrations: number | null; responses: number | null };
export const FEEDBACK_URL = "https://encontrocorosce.lovable.app/avaliacao";

const CPF_INPUT = /^[\d.\-\s]*$/;

/** Formats the identity field as a CPF (000.000.000-00) while it holds only digits; emails pass through. */
export function formatFeedbackIdentityInput(next: string, previous = ""): string {
  if (CPF_INPUT.test(next)) {
    const digits = next.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  // Typing a letter or "@" after digits means an email: drop the CPF punctuation we inserted.
  if (previous && CPF_INPUT.test(previous) && next.startsWith(previous)) {
    return previous.replace(/[.\-\s]/g, "") + next.slice(previous.length);
  }
  return next;
}
