import { z } from "zod";

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
    returnIntent: z.enum(["yes", "maybe", "no"]),
    suggestion: z.string().trim().max(1000).default(""),
  })
  .strict();

export type EventFeedback = z.infer<typeof eventFeedbackSchema>;

export type EventFeedbackStats = { registrations: number | null; responses: number | null };
export const FEEDBACK_URL = "https://encontrocorosce.lovable.app/avaliacao";
