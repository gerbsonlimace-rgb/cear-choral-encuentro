export type PortalDestination =
  "/admin/inscricoes" | "/regente/alterar-senha" | "/regente" | "/participante";

export type UnifiedPortalAccess =
  { status: "authorized"; destination: PortalDestination } | { status: "unavailable" };

export type AdminOrRegentProfile =
  { role: "admin" } | { role: "regent"; passwordChangeRequired: boolean } | null;

export type UnifiedPortalChecks = {
  findAdminOrRegent(userId: string, email: string | null): Promise<AdminOrRegentProfile>;
  hasParticipantAccess(userId: string): Promise<boolean>;
};

export function createUnifiedPortalResolver(checks: UnifiedPortalChecks) {
  return {
    async resolve(userId: string, email: string | null): Promise<UnifiedPortalAccess> {
      const portal = await checks.findAdminOrRegent(userId, email);
      if (portal?.role === "admin") {
        return { status: "authorized", destination: "/admin/inscricoes" };
      }
      if (portal?.role === "regent") {
        return {
          status: "authorized",
          destination: portal.passwordChangeRequired ? "/regente/alterar-senha" : "/regente",
        };
      }
      if (await checks.hasParticipantAccess(userId)) {
        return { status: "authorized", destination: "/participante" };
      }
      return { status: "unavailable" };
    },
  };
}
