import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminRegistrationExportSchema,
  adminRegistrationPdfExportSchema,
  adminCancelRegistrationSchema,
  adminMarkExemptSchema,
  adminMarkPaidSchema,
  adminRegistrationQuerySchema,
  adminUpdateRegistrationSchema,
  type AdminExportFile,
  type AdminRegistrationExportQuery,
  type AdminRegistrationPage,
  type AdminRegistrationQuery,
  type AdminRegistrationRow,
  type AdminRegistrationSummary,
} from "@/features/admin/admin.domain";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { participantRegistrationIdSchema } from "@/features/participant/participant.domain";
import {
  LODGING_EXTRA_ROOM_BASE,
  type LodgingPlan,
} from "@/features/admin/admin-lodging.domain";

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

export type AdminHospedagemBootstrap = AdminPageBootstrap<{
  registrations: AdminRegistrationRow[];
  /** Null when the plan was never configured by an administrator. */
  plan: LodgingPlan | null;
  /** Signed URLs of the photos of the people added by hand. */
  extraPhotoUrls: Record<string, string>;
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
          service.list(
            adminRegistrationQuerySchema.parse({ search: "", paymentStatus: "all", page: 1, pageSize: 25 }),
            false,
          ),
          handlers.summary(),
        ]);
        return { registrations, summary };
      },
    });
  });

export const getAdminHospedagemBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ getAdminAuthorizer }, { getAdminRegistrationService }, lodging] = await Promise.all([
      import("@/features/admin/admin-auth.server"),
      import("@/features/admin/admin-registration.server"),
      import("@/features/admin/admin-lodging.server"),
    ]);
    return createAdminBootstrap<NonNullable<AdminHospedagemBootstrap["data"]>>({
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      findActive: (userId) => getAdminAuthorizer().findActive(userId),
      load: async () => {
        const service = getAdminRegistrationService();
        const rows: AdminRegistrationRow[] = [];
        let page = 1;
        while (true) {
          const batch = await service.list(
            {
              search: "",
              paymentStatus: "all",
              choirId: "all",
              musicalProfile: "all",
              loginStatus: "all",
              page,
              pageSize: 1000,
            },
            false,
          );
          rows.push(...batch.rows);
          if (rows.length >= batch.total || batch.rows.length === 0) break;
          page += 1;
        }
        const plan = await lodging.getAdminLodgingPlan();
        const extraPhotoUrls = await lodging.signAdminLodgingPhotos(
          (plan?.extraPeople ?? [])
            .map((person) => person.photoPath)
            .filter((path): path is string => Boolean(path)),
        );
        return {
          registrations: rows.filter((row) => !row.cancelledAt),
          plan,
          extraPhotoUrls,
        };
      },
    });
  });

const lodgingExtraPersonSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(180),
  cpf: z.string().max(20),
  paid: z.string().max(40),
  role: z.string().max(40),
  sex: z.string().max(20),
  birthDate: z.string().max(20),
  photoPath: z.string().max(300).nullable(),
  choir: z.string().max(180),
  roomKey: z.string().max(300).nullable(),
});

const lodgingPlanSchema = z.object({
  roomsAvailable: z.number().int().min(0).max(100000),
  roomCapacity: z.number().int().min(1).max(100),
  noLodgingIds: z.array(z.string().uuid()).max(5000),
  assignments: z.record(z.string(), z.string().max(300)).default({}),
  extraRooms: z.record(z.string(), z.array(z.number().int().min(LODGING_EXTRA_ROOM_BASE)).max(500)).default({}),
  hiddenRoomKeys: z.array(z.string().max(300)).max(5000),
  extraPeople: z.array(lodgingExtraPersonSchema).max(500),
  extraRoomCounter: z.number().int().min(LODGING_EXTRA_ROOM_BASE).max(10_000_000),
});

export const saveAdminLodgingPlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(lodgingPlanSchema)
  .handler(async ({ data }) => {
    const { saveAdminLodgingPlan } = await import("@/features/admin/admin-lodging.server");
    await saveAdminLodgingPlan(data);
    return { status: "saved" as const };
  });

export const uploadAdminLodgingPhoto = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      base64: z.string().min(4).max(8_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }),
  )
  .handler(async ({ data }) => {
    const { uploadAdminLodgingPhoto } = await import("@/features/admin/admin-lodging.server");
    return uploadAdminLodgingPhoto(data);
  });

export const listAdminRegistrations = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRegistrationQuerySchema)
  .handler(async ({ data }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    // Photos are signed by getAdminRegistrationPhotos after the table renders.
    return getAdminRegistrationService().list(adminRegistrationQuerySchema.parse(data), false);
  });

export const getAdminRegistrationPhotos = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ registrationIds: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().photoUrls(data.registrationIds);
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
  .inputValidator(adminRegistrationPdfExportSchema)
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
      {
        amountCents: data.amountCents,
        remainder: data.remainder,
        originalRegistrationPriceCents: data.originalRegistrationPriceCents,
        rafflePaidCents: data.rafflePaidCents ?? undefined,
        reason: data.reason,
      },
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

export const cancelAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminCancelRegistrationSchema)
  .handler(async ({ data, context }) => {
    const { getAdminRegistrationService } =
      await import("@/features/admin/admin-registration.server");
    return getAdminRegistrationService().cancel(
      data.registrationId,
      context.adminUserId,
      data.refundCents,
    );
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

const adminChoirRaffleSchema = z
  .object({ choirName: z.string().trim().min(1).max(255) })
  .strict();

export const listAdminChoirRaffles = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminChoirRaffleSchema)
  .handler(async ({ data }) => {
    const { listAdminChoirRaffles: run } =
      await import("@/features/admin/admin-raffle-settlement.server");
    return run(data.choirName);
  });

export const getAdminChoirRoster = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminChoirRaffleSchema)
  .handler(async ({ data }) => {
    const { getAdminChoirRoster: run } =
      await import("@/features/admin/admin-raffle-settlement.server");
    return run(data.choirName);
  });

export const settleAdminChoirRaffles = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z
      .object({
        choirName: z.string().trim().min(1).max(255),
        totalCents: z.number().int().min(0).max(100_000_000).optional(),
      })
      .strict(),
  )
  .handler(async ({ data }) => {
    const { settleAdminChoirRaffles: run } =
      await import("@/features/admin/admin-raffle-settlement.server");
    return run({ choirName: data.choirName, totalCents: data.totalCents });
  });

export const setAdminRegistrationRafflePaid = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z
      .object({
        registrationId: z.string().uuid(),
        rafflePaidCents: z.number().int().min(0).max(100_000_000).nullable(),
      })
      .strict(),
  )
  .handler(async ({ data }) => {
    const { setAdminRegistrationRafflePaid: run } =
      await import("@/features/admin/admin-raffle-settlement.server");
    return run(data);
  });
