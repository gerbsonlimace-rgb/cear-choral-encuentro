import { z } from "zod";

export const eventNoticeCreateSchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string().trim().min(2, "Informe um título com pelo menos 2 caracteres.").max(160),
    body: z.string().trim().min(1, "Escreva a mensagem do aviso.").max(5000),
    isPublished: z.boolean(),
  })
  .strict();

export const eventNoticeUpdateSchema = eventNoticeCreateSchema.extend({ id: z.string().uuid() });
export type EventNoticeCreate = z.infer<typeof eventNoticeCreateSchema>;
export type EventNoticeUpdate = z.infer<typeof eventNoticeUpdateSchema>;
export type EventNotice = EventNoticeUpdate & {
  eventName: string;
  createdAt: string;
  updatedAt: string;
};

export function sortEventNotices(notices: readonly EventNotice[]) {
  return [...notices].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function formatNoticeDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
