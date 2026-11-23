import { createServerFn } from "@tanstack/react-start";
import { eventFeedbackSchema } from "@/features/event-feedback/eventFeedback.domain";

export const submitEventFeedback = createServerFn({ method: "POST" })
  .validator(eventFeedbackSchema)
  .handler(async ({ data }) => {
    const { saveEventFeedback } = await import("@/features/event-feedback/eventFeedback.server");
    return saveEventFeedback(data);
  });
