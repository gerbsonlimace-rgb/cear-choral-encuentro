import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import {
  eventNoticeCreateSchema,
  eventNoticeUpdateSchema,
  type EventNotice,
} from "@/features/event-notices/eventNotice.domain";
import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";

export type AdminEventNoticeBootstrap = { notices: EventNotice[]; events: CoroAppEventSource[] };

async function loadService() {
  const { getEventNoticeService } =
    await import("@/features/event-notices/eventNotice.service.server");
  return getEventNoticeService();
}

export const getAdminEventNoticeBootstrap = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminEventNoticeBootstrap> => {
    const [{ getCoroAppEventSourceService }, service] = await Promise.all([
      import("@/features/coroapp-integration/coroAppEventSource.service.server"),
      loadService(),
    ]);
    const [notices, events] = await Promise.all([
      service.listAdmin(),
      getCoroAppEventSourceService().list(),
    ]);
    return { notices, events };
  });

export const createAdminEventNotice = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventNoticeCreateSchema)
  .handler(async ({ data, context }) =>
    (await loadService()).create({ ...data, adminUserId: context.adminUserId }),
  );

export const updateAdminEventNotice = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventNoticeUpdateSchema)
  .handler(async ({ data, context }) =>
    (await loadService()).update({ ...data, adminUserId: context.adminUserId }),
  );

export const getParticipantEventNotices = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async () => (await loadService()).listParticipant());
