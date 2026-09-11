import { createServerFn } from "@tanstack/react-start";
import {
  portalChoirSelectionSchema,
  resolveAuthorizedChoir,
  type PortalAccess,
  type RegentAccess,
} from "@/features/regent/regent.domain";
import type { PortalAccessProbe } from "@/features/regent/regent-auth.server";

export function toRegentAccessState(probe: PortalAccessProbe): RegentAccess {
  if (!probe.authenticated) return { status: "unauthenticated" };
  if (!probe.access) return { status: "forbidden" };
  if (probe.access.role === "admin") return { status: "authorized", role: "admin" };
  return {
    status: probe.access.passwordChangeRequired ? "password_change_required" : "authorized",
    role: "regent",
    choirId: probe.access.choirId,
  };
}

// Call only with access supplied by portal middleware, never request data.
export function resolvePortalChoirSelection(access: PortalAccess, input: unknown): string {
  if (access.role === "regent") return resolveAuthorizedChoir(access);
  return resolveAuthorizedChoir(access, portalChoirSelectionSchema.parse(input).choirId);
}

export const getRegentAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { getPortalRequestAccess } = await import("@/features/regent/regent-auth.server");
  return toRegentAccessState(await getPortalRequestAccess());
});
