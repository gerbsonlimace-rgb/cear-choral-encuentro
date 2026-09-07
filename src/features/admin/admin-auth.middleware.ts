import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { authorizeAdminOperation, getAdminAuthorizer } = await import("./admin-auth.server");

    return authorizeAdminOperation(context.userId, getAdminAuthorizer(), (membership) =>
      next({
        context: {
          adminUserId: context.userId,
          adminMembershipId: membership.id,
        },
      }),
    );
  });
