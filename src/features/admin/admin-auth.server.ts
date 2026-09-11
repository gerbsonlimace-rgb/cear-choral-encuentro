import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminMembership = { id: string; userId: string };

export type AdminMembershipRepository = {
  findActive(userId: string): Promise<AdminMembership | null>;
};

export function createAdminAuthorizer(repository: AdminMembershipRepository) {
  return {
    findActive: (userId: string) => repository.findActive(userId),
    async requireActive(userId: string) {
      const membership = await repository.findActive(userId);
      if (!membership) throw new Error("Acesso não autorizado.");
      return membership;
    },
  };
}

export async function authorizeAdminOperation<T>(
  userId: string,
  authorizer: ReturnType<typeof createAdminAuthorizer>,
  operation: (membership: AdminMembership) => Promise<T>,
) {
  const membership = await authorizer.requireActive(userId);
  return operation(membership);
}

let adminAuthorizer: ReturnType<typeof createAdminAuthorizer> | undefined;

export function getAdminAuthorizer() {
  if (!adminAuthorizer) {
    adminAuthorizer = createAdminAuthorizer({
      async findActive(userId) {
        const { data, error } = await supabaseAdmin
          .from("admin_users")
          .select("id,user_id")
          .eq("user_id", userId)
          .is("revoked_at", null)
          .maybeSingle();

        if (error) {
          throw new Error("Não foi possível validar o acesso administrativo.");
        }

        return data ? { id: data.id, userId: data.user_id } : null;
      },
    });
  }

  return adminAuthorizer;
}
