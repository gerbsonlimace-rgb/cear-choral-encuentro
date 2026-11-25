import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";

export const getAdminEventFeedback = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { loadAdminEventFeedback } =
      await import("@/features/event-feedback/adminEventFeedback.server");
    return loadAdminEventFeedback();
  });

export const exportAdminEventFeedbackPdf = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { loadAdminEventFeedback } =
      await import("@/features/event-feedback/adminEventFeedback.server");
    const { buildEventFeedbackPdf } =
      await import("@/features/event-feedback/adminEventFeedback.pdf");
    return buildEventFeedbackPdf(await loadAdminEventFeedback());
  });
