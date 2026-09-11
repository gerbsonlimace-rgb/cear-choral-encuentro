import { getParticipantAuthorizer } from "@/features/participant/participant-auth.server";
import { getPortalAuthorizer } from "@/features/regent/regent-auth.server";

import { createUnifiedPortalResolver } from "./portal-access.domain";

let resolver: ReturnType<typeof createUnifiedPortalResolver> | undefined;

export function getUnifiedPortalAccessResolver() {
  if (!resolver) {
    resolver = createUnifiedPortalResolver({
      async findAdminOrRegent(userId, email) {
        const access = await getPortalAuthorizer().findActive(userId, email);
        if (!access) return null;
        return access.role === "admin"
          ? { role: "admin" }
          : { role: "regent", passwordChangeRequired: access.passwordChangeRequired };
      },
      async hasParticipantAccess(userId) {
        return (await getParticipantAuthorizer().findAccess(userId)).status === "authorized";
      },
    });
  }
  return resolver;
}
