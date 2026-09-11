import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { regentIdSchema, regentMutationSchema } from "@/features/regent/regent.domain";
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

const temporaryPasswordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres na senha temporária.")
  .max(128);
const createRegentSchema = regentMutationSchema
  .extend({ password: temporaryPasswordSchema })
  .strict();
const membershipSchema = z.object({ id: regentIdSchema }).strict();
const resetRegentSchema = membershipSchema.extend({ password: temporaryPasswordSchema }).strict();

async function loadAdminService() {
  const { getRegentAdminService } = await import("@/features/regent/regent-admin.server");
  return getRegentAdminService();
}

export const listAdminRegents = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await loadAdminService()).list());

export const createAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createRegentSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).create(data, context.adminUserId),
  );

export const replaceAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createRegentSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).replace(data, context.adminUserId),
  );

export const revokeAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(membershipSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).revoke(data.id, context.adminUserId),
  );

export const resetAdminRegentPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(resetRegentSchema)
  .handler(async ({ data }) => (await loadAdminService()).resetPassword(data.id, data.password));
