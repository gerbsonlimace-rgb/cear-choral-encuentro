import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requirePortalAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { getPortalAuthorizer } = await import("./regent-auth.server");
    const portalAccess = await getPortalAuthorizer().requireActive(
      context.userId,
      typeof context.claims.email === "string" ? context.claims.email : null,
    );
    return next({ context: { portalAccess } });
  });

export const requirePortalReadyAccess = createMiddleware({ type: "function" })
  .middleware([requirePortalAccess])
  .server(async ({ next, context }) => {
    if (context.portalAccess.role === "regent" && context.portalAccess.passwordChangeRequired) {
      throw new Error("Altere sua senha antes de acessar a área do regente.");
    }
    return next();
  });
