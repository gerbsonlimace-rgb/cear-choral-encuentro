import { z } from "zod";

export const FEEDBACK_ASPECTS = [
  { key: "organization", label: "Organização", description: "Orientações e acolhida" },
  { key: "formation", label: "Formação", description: "Conteúdo musical e litúrgico" },
  { key: "celebrations", label: "Celebrações", description: "Momentos de fé e oração" },
  { key: "fellowship", label: "Convivência", description: "Encontro e troca entre os coros" },
  { key: "venue", label: "Estrutura", description: "Espaços utilizados no encontro" },
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
        organization: aspectRating,
        formation: aspectRating,
        celebrations: aspectRating,
        fellowship: aspectRating,
        venue: aspectRating,
        food: aspectRating,
        lodging: aspectRating,
      })
      .strict(),
    contribution: z.number().int().min(1).max(4),
    returnIntent: z.enum(["yes", "maybe", "no"]),
    suggestion: z.string().trim().max(1000).default(""),
  })
  .strict();

export type EventFeedback = z.infer<typeof eventFeedbackSchema>;

export type EventFeedbackStats = { registrations: number | null; responses: number | null };
export const FEEDBACK_URL = "https://encontrocorosce.lovable.app/avaliacao";
