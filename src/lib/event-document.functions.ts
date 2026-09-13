import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  eventDocumentActionSchema,
  eventDocumentCreateSchema,
  eventDocumentUpdateSchema,
  type EventDocument,
} from "@/features/event-documents/eventDocument.domain";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";

export type AdminEventDocumentBootstrap = {
  documents: EventDocument[];
  events: CoroAppEventSource[];
};

async function loadService() {
  const { getEventDocumentService } =
    await import("@/features/event-documents/eventDocument.service.server");
  return getEventDocumentService();
}

export const getAdminEventDocumentBootstrap = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminEventDocumentBootstrap> => {
    const [{ getCoroAppEventSourceService }, service] = await Promise.all([
      import("@/features/coroapp-integration/coroAppEventSource.service.server"),
      loadService(),
    ]);
    const [documents, events] = await Promise.all([
      service.listAdmin(),
      getCoroAppEventSourceService().list(),
    ]);
    return { documents, events };
  });

export const createAdminEventDocument = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventDocumentCreateSchema)
  .handler(async ({ data, context }) =>
    (await loadService()).create({ ...data, adminUserId: context.adminUserId }),
  );

export const updateAdminEventDocument = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventDocumentUpdateSchema)
  .handler(async ({ data, context }) =>
    (await loadService()).update({ ...data, adminUserId: context.adminUserId }),
  );

export const deleteAdminEventDocument = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventDocumentActionSchema)
  .handler(async ({ data }) => (await loadService()).remove(data));

export const getAdminEventDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(eventDocumentActionSchema)
  .handler(async ({ data }) => (await loadService()).createAdminSignedUrl(data));

export const getParticipantEventDocuments = createServerFn({ method: "GET" })
  .middleware([requireParticipantAccess])
  .handler(async () => (await loadService()).listParticipant());

export const getParticipantEventDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess])
  .validator(eventDocumentActionSchema)
  .handler(async ({ data }) => (await loadService()).createParticipantSignedUrl(data));
