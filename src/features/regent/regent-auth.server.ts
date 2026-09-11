import { getRequest } from "@tanstack/react-start/server";
import { getAdminAuthorizer, type AdminMembership } from "@/features/admin/admin-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PortalAccess } from "./regent.domain";

export type RegentMembership = {
  id: string;
  userId: string;
  choirId: string;
  name: string;
  email: string;
  passwordChangeRequired: boolean;
  revokedAt: string | null;
};

export type PortalAccessRepository = {
  findActiveAdmin(userId: string): Promise<AdminMembership | null>;
  findActiveRegent(userId: string): Promise<RegentMembership | null>;
};

export type PortalAccessProbe =
  | { authenticated: false }
  | { authenticated: true; access: PortalAccess | null };

export function createPortalAuthorizer(repository: PortalAccessRepository) {
  async function findActive(userId: string, email: string | null): Promise<PortalAccess | null> {
    const admin = await repository.findActiveAdmin(userId);
    if (admin?.userId === userId) return { role: "admin", userId, email };

    const regent = await repository.findActiveRegent(userId);
    if (!regent || regent.userId !== userId || regent.revokedAt !== null) return null;
    return {
      role: "regent",
      userId,
      membershipId: regent.id,
      choirId: regent.choirId,
      name: regent.name,
      email: regent.email,
      passwordChangeRequired: regent.passwordChangeRequired,
    };
  }

  return {
    findActive,
    async requireActive(userId: string, email: string | null): Promise<PortalAccess> {
      const access = await findActive(userId, email);
      if (!access) throw new Error("Acesso não autorizado.");
      return access;
    },
  };
}

let portalAuthorizer: ReturnType<typeof createPortalAuthorizer> | undefined;

export function getPortalAuthorizer() {
  if (!portalAuthorizer) {
    portalAuthorizer = createPortalAuthorizer({
      findActiveAdmin: (userId) => getAdminAuthorizer().findActive(userId),
      async findActiveRegent(userId) {
        const { data, error } = await supabaseAdmin
          .from("choir_regents")
          .select("id,user_id,choir_id,name,email,password_change_required,revoked_at")
          .eq("user_id", userId)
          .is("revoked_at", null)
          .maybeSingle();

        if (error) throw new Error("Não foi possível validar o acesso do regente.");
        return data
          ? {
              id: data.id,
              userId: data.user_id,
              choirId: data.choir_id,
              name: data.name,
              email: data.email,
              passwordChangeRequired: data.password_change_required,
              revokedAt: data.revoked_at,
            }
          : null;
      },
    });
  }
  return portalAuthorizer;
}

// The access probe is also available before login, so invalid credentials yield
// an explicit state. Protected operations still compose requireSupabaseAuth.
export async function findPortalAccessForAuthorization(
  authorization: string | null | undefined,
): Promise<PortalAccessProbe> {
  const token = authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return { authenticated: false };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) return { authenticated: false };

  return {
    authenticated: true,
    access: await getPortalAuthorizer().findActive(data.user.id, data.user.email ?? null),
  };
}

export function getPortalRequestAccess(): Promise<PortalAccessProbe> {
  return findPortalAccessForAuthorization(getRequest().headers.get("authorization"));
}
