import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";

export const getAdminEventFeedback = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { loadAdminEventFeedback } =
      await import("@/features/event-feedback/adminEventFeedback.server");
    return loadAdminEventFeedback();
  });
