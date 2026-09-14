import { getAdminAuthorizer } from "@/features/admin/admin-auth.server";
import { getParticipantAuthorizer } from "@/features/participant/participant-auth.server";

export async function resolvePortalModes(userId: string) {
  const [admin, participant] = await Promise.all([
    getAdminAuthorizer().findActive(userId),
    getParticipantAuthorizer().findAccess(userId),
  ]);
  return { admin: admin !== null, participant: participant.status === "authorized" };
}
