import { getAdminAuthorizer } from "@/features/admin/admin-auth.server";
import { getParticipantAuthorizer } from "@/features/participant/participant-auth.server";
import { getPortalAuthorizer } from "@/features/regent/regent-auth.server";

export async function resolvePortalModes(userId: string) {
  const [admin, participant, portal] = await Promise.all([
    getAdminAuthorizer().findActive(userId),
    getParticipantAuthorizer().findAccess(userId),
    getPortalAuthorizer().findActive(userId, null),
  ]);
  return {
    admin: admin !== null,
    participant: participant.status === "authorized",
    regent: portal?.role === "regent",
  };
}
