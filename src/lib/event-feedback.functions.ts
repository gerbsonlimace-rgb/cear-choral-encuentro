import { createServerFn } from "@tanstack/react-start";
import {
  eventFeedbackSchema,
  feedbackAccessRequestSchema,
  feedbackVideoClaimSchema,
} from "@/features/event-feedback/eventFeedback.domain";

export const prepareRegisteredFeedback = createServerFn({ method: "POST" })
  .validator(feedbackAccessRequestSchema)
  .handler(async ({ data }) => {
    const { prepareFeedbackAccess } =
      await import("@/features/event-feedback/eventFeedbackAccess.server");
    return prepareFeedbackAccess(data);
  });
export const claimRegisteredFeedbackVideo = createServerFn({ method: "POST" })
  .validator(feedbackVideoClaimSchema)
  .handler(async ({ data }) => {
    const { claimFeedbackVideo } =
      await import("@/features/event-feedback/eventFeedbackAccess.server");
    return claimFeedbackVideo(data);
  });

export const submitEventFeedback = createServerFn({ method: "POST" })
  .validator(eventFeedbackSchema)
  .handler(async ({ data }) => {
    const { saveEventFeedback } = await import("@/features/event-feedback/eventFeedback.server");
    return saveEventFeedback(data);
  });

export const getPublicFeedbackStats = createServerFn({ method: "GET" }).handler(async () => {
  const { loadEventFeedbackStats } = await import("@/features/event-feedback/eventFeedback.server");
  return loadEventFeedbackStats();
});
