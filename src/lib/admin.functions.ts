import { createServerFn } from "@tanstack/react-start";
import {
  adminRegistrationExportSchema,
  adminRegistrationQuerySchema,
  type AdminExportFile,
  type AdminRegistrationExportQuery,
  type AdminRegistrationPage,
  type AdminRegistrationQuery,
  type AdminRegistrationSummary,
} from "@/features/admin/admin.domain";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminAccessState =
  | { status: "authorized"; userId: string; email: string | null }
  | { status: "forbidden" };

type AdminAccessInput = {
  userId: string;
  email: string | null;
  authorized: boolean;
};

export type AdminRegistrationServicePort = {
  list(query: AdminRegistrationQuery): Promise<AdminRegistrationPage>;
  summary(): Promise<AdminRegistrationSummary>;
  export(query: AdminRegistrationExportQuery, adminUserId: string): Promise<AdminExportFile>;
};

export function toAdminAccessState<T extends AdminAccessInput>(input: T): AdminAccessState {
  if (!input.authorized) return { status: "forbidden" };

  return {
    status: "authorized",
    userId: input.userId,
    email: input.email,
  };
}

export function createAdminFunctionHandlers(service: AdminRegistrationServicePort) {
  return {
    async list(input: unknown) {
      return service.list(adminRegistrationQuerySchema.parse(input));
    },
    async summary() {
      return service.summary();
    },
    async export(input: unknown, adminUserId: string) {
      return service.export(adminRegistrationExportSchema.parse(input), adminUserId);
    },
  };
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminAuthorizer } = await import("@/features/admin/admin-auth.server");
    const membership = await getAdminAuthorizer().findActive(context.userId);

    return toAdminAccessState({
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      authorized: membership !== null,
    });
  });

export const listAdminRegistrations = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRegistrationQuerySchema)
  .handler(async ({ data }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return createAdminFunctionHandlers(getAdminRegistrationService()).list(data);
  });

export const getAdminRegistrationSummary = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return createAdminFunctionHandlers(getAdminRegistrationService()).summary();
  });

export const exportAdminRegistrations = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRegistrationExportSchema)
  .handler(async ({ data, context }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return createAdminFunctionHandlers(getAdminRegistrationService()).export(
      data,
      context.adminUserId,
    );
  });
