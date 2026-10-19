import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminRegistrationExportSchema,
  adminMarkExemptSchema,
  adminMarkPaidSchema,
  adminRegistrationQuerySchema,
  adminUpdateRegistrationSchema,
  type AdminExportFile,
  type AdminRegistrationExportQuery,
  type AdminRegistrationPage,
  type AdminRegistrationQuery,
  type AdminRegistrationSummary,
} from "@/features/admin/admin.domain";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { participantRegistrationIdSchema } from "@/features/participant/participant.domain";

export type AdminAccessState =
  { status: "authorized"; userId: string; email: string | null } | { status: "forbidden" };

export type AdminPageBootstrap<T> = {
  access: AdminAccessState;
  data?: T;
};

export type AdminRegistrationsBootstrap = AdminPageBootstrap<{
  registrations: AdminRegistrationPage;
  summary: AdminRegistrationSummary;
}>;

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

export async function createAdminBootstrap<T>({
  userId,
  email,
  findActive,
  load,
}: {
  userId: string;
  email: string | null;
  findActive: (userId: string) => Promise<{ id: string; userId: string } | null>;
  load: () => Promise<T>;
}): Promise<AdminPageBootstrap<T>> {
  const membership = await findActive(userId);
  const access = toAdminAccessState({ userId, email, authorized: membership !== null });
  if (!membership) return { access };
  return { access, data: await load() };
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

type ParticipantRecoveryServicePort = {
  reprocess(
    registrationId: string,
    adminUserId: string,
  ): Promise<{ status: "active" | "pending" | "conflict" }>;
  resetInitialPassword(
    registrationId: string,
    adminUserId: string,
  ): Promise<{ status: "success"; sessionsRevoked: false }>;
};

export function createParticipantRecoveryHandlers(service: ParticipantRecoveryServicePort) {
  return {
    reprocess(input: unknown, adminUserId: string) {
      const { registrationId } = participantRegistrationIdSchema.parse(input);
      return service.reprocess(registrationId, adminUserId);
    },
    reset(input: unknown, adminUserId: string) {
      const { registrationId } = participantRegistrationIdSchema.parse(input);
      return service.resetInitialPassword(registrationId, adminUserId);
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

export const getAdminRegistrationsBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ getAdminAuthorizer }, { getAdminRegistrationService }] = await Promise.all([
      import("@/features/admin/admin-auth.server"),
      import("@/features/admin/admin-registration.server"),
    ]);
    return createAdminBootstrap<NonNullable<AdminRegistrationsBootstrap["data"]>>({
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      findActive: (userId) => getAdminAuthorizer().findActive(userId),
      load: async () => {
        const service = getAdminRegistrationService();
        const handlers = createAdminFunctionHandlers(service);
        const [registrations, summary] = await Promise.all([
          handlers.list({ search: "", paymentStatus: "all", page: 1, pageSize: 25 }),
          handlers.summary(),
        ]);
        return { registrations, summary };
      },
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

export const exportAdminRegistrationsPdf = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(adminRegistrationExportSchema)
  .handler(async ({ data, context }) => {
    const { getAdminRegistrationService } = await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().exportPdf(data, context.adminUserId);
  });

export const reprocessParticipantAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(participantRegistrationIdSchema)
  .handler(async ({ data, context }) => {
    const { getParticipantProvisioningService } =
      await import("@/features/participant/participant-provisioning.server");
    return createParticipantRecoveryHandlers(getParticipantProvisioningService()).reprocess(
      data,
      context.adminUserId,
    );
  });

export const resetParticipantInitialPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(participantRegistrationIdSchema)
  .handler(async ({ data, context }) => {
    const { getParticipantProvisioningService } =
      await import("@/features/participant/participant-provisioning.server");
    return createParticipantRecoveryHandlers(getParticipantProvisioningService()).reset(
      data,
      context.adminUserId,
    );
  });

export const createAdminRegistrationCheckoutLink = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(participantRegistrationIdSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } =
      await import("@/features/registration/registration-payment.server");
    return getRegistrationPaymentService().createCheckoutLink(data.registrationId);
  });

export const markAdminRegistrationPaid = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminMarkPaidSchema)
  .handler(async ({ data, context }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().markPaid(
      data.registrationId,
      context.adminUserId,
      data.receipt,
    );
  });

export const markAdminRegistrationExempt = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminMarkExemptSchema)
  .handler(async ({ data, context }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().markExempt(data.registrationId, context.adminUserId);
  });

export const deleteAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({ registrationId: z.string().uuid(), cpf: z.string().min(11).max(14) }).strict(),
  )
  .handler(async ({ data, context }) => {
    const { deleteAdminRegistration: run } =
      await import("@/features/admin/admin-registration-delete.server");
    return run(data.registrationId, context.adminUserId, data.cpf);
  });

export const updateAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminUpdateRegistrationSchema)
  .handler(async ({ data }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().update(data);
  });

export const getAdminRegistrationReceipt = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(participantRegistrationIdSchema)
  .handler(async ({ data }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().getReceiptUrl(data.registrationId);
  });

const adminRoleInput = z.object({ registrationId: z.string().uuid() }).strict();

export const listAdminRegistrationRoles = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ registrationIds: z.array(z.string().uuid()).max(200) }).strict())
  .handler(async ({ data, context }) => {
    const { listRegistrationAdminRoles } = await import("@/features/admin/admin-roles.server");
    return listRegistrationAdminRoles(data.registrationIds, context.adminUserId);
  });

export const grantAdminFromRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRoleInput)
  .handler(async ({ data, context }) => {
    const { grantAdminFromRegistration: run } = await import("@/features/admin/admin-roles.server");
    return run(data.registrationId, context.adminUserId);
  });

export const revokeAdminFromRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRoleInput)
  .handler(async ({ data, context }) => {
    const { revokeAdminFromRegistration: run } =
      await import("@/features/admin/admin-roles.server");
    return run(data.registrationId, context.adminUserId);
  });
