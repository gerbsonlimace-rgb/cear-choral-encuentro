import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireParticipantAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { getParticipantAuthorizer } = await import("./participant-auth.server");
    const participantAccess = await getParticipantAuthorizer().requireActive(context.userId);
    return next({ context: { participantAccess } });
  });
