import { createServerFn } from "@tanstack/react-start";
import type { UnifiedPortalAccess } from "@/features/access/portal-access.domain";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
