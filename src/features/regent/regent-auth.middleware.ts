import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findPortalAccessForAuthorization } from "./regent-auth.server";

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

/** Request middleware for full-page routes; function middleware remains the server-function guard. */
export const requirePortalReadyRequestAccess = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const probe = await findPortalAccessForAuthorization(request.headers.get("authorization"));
    if (!probe.authenticated || !probe.access) throw new Error("Acesso não autorizado.");
    if (probe.access.role === "regent" && probe.access.passwordChangeRequired) {
      throw new Error("Altere sua senha antes de acessar a área do regente.");
    }
    return next();
  },
);
