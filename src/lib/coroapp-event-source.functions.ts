import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { replaceCoroAppEventSourcesSchema } from "@/features/coroapp-integration/coroAppEventSource.domain";

async function loadService() {
  const { getCoroAppEventSourceService } = await import(
    "@/features/coroapp-integration/coroAppEventSource.service.server"
  );
  return getCoroAppEventSourceService();
}

export const getAdminCoroAppEventSources = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await loadService()).list());

export const replaceAdminCoroAppEventSources = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(replaceCoroAppEventSourcesSchema)
  .handler(async ({ data, context }) =>
    (await loadService()).replace({
      publicUrls: data.publicUrls,
      updatedBy: context.adminUserId,
    }),
  );
