import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  sponsorActiveSchema,
  sponsorCreateSchema,
  sponsorUpdateSchema,
  type AdminSponsor,
  type PublicSponsor,
  type SponsorCreate,
  type SponsorUpdate,
} from "@/features/sponsors/sponsor.domain";

export type SponsorServicePort = {
  listPublic(): Promise<PublicSponsor[]>;
  listAdmin(): Promise<AdminSponsor[]>;
  create(input: SponsorCreate): Promise<AdminSponsor>;
  update(input: SponsorUpdate): Promise<AdminSponsor>;
  setActive(id: string, isActive: boolean): Promise<AdminSponsor>;
};

export function createSponsorFunctionHandlers(service: SponsorServicePort) {
  return {
    async listPublic() {
      return service.listPublic();
    },
    async listAdmin() {
      return service.listAdmin();
    },
    async create(input: unknown) {
      return service.create(sponsorCreateSchema.parse(input));
    },
    async update(input: unknown) {
      return service.update(sponsorUpdateSchema.parse(input));
    },
    async setActive(input: unknown) {
      const parsed = sponsorActiveSchema.parse(input);
      return service.setActive(parsed.id, parsed.isActive);
    },
  };
}

async function loadHandlers() {
  const { getSponsorService } = await import("@/features/sponsors/sponsor.service.server");
  return createSponsorFunctionHandlers(getSponsorService());
}

export const getPublicSponsors = createServerFn({ method: "GET" }).handler(async () =>
  (await loadHandlers()).listPublic(),
);

export const getAdminSponsors = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await loadHandlers()).listAdmin());

export const createAdminSponsor = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(sponsorCreateSchema)
  .handler(async ({ data }) => (await loadHandlers()).create(data));

export const updateAdminSponsor = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(sponsorUpdateSchema)
  .handler(async ({ data }) => (await loadHandlers()).update(data));

export const setAdminSponsorActive = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(sponsorActiveSchema)
  .handler(async ({ data }) => (await loadHandlers()).setActive(data));
