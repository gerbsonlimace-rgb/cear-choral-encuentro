import { createServerFn } from "@tanstack/react-start";
import type { UnifiedPortalAccess } from "@/features/access/portal-access.domain";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalModes = { admin: boolean; participant: boolean; regent: boolean };

export const getPortalModes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalModes> => {
    const { resolvePortalModes } = await import("@/features/access/portal-modes.server");
    return resolvePortalModes(context.userId);
  });

export const getUnifiedPortalAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UnifiedPortalAccess> => {
    const { getUnifiedPortalAccessResolver } =
      await import("@/features/access/portal-access.server");
    return getUnifiedPortalAccessResolver().resolve(
      context.userId,
      typeof context.claims.email === "string" ? context.claims.email : null,
    );
  });
