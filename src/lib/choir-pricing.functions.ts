import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  choirActiveSchema,
  choirMutationSchema,
  choirUpdateSchema,
  pricingSettingsSchema,
  type AdminChoir,
  type ChoirMutation,
  type PricingSettings,
  type PublicRegistrationConfiguration,
} from "@/features/choirs/choir-pricing.domain";
import type { AdminChoirPricing } from "@/features/choirs/choir-pricing.server";

export type ChoirPricingServicePort = {
  getPublicConfiguration(): Promise<PublicRegistrationConfiguration>;
  getAdminData(): Promise<AdminChoirPricing>;
  saveSettings(input: PricingSettings): Promise<PricingSettings>;
  createChoir(input: ChoirMutation): Promise<AdminChoir>;
  updateChoir(id: string, input: ChoirMutation): Promise<AdminChoir>;
  setChoirActive(id: string, isActive: boolean): Promise<AdminChoir>;
};

export function createChoirPricingFunctionHandlers(service: ChoirPricingServicePort) {
  return {
    async getPublicConfiguration() {
      return service.getPublicConfiguration();
    },
    async getAdminData() {
      return service.getAdminData();
    },
    async saveSettings(input: unknown) {
      return service.saveSettings(pricingSettingsSchema.parse(input));
    },
    async createChoir(input: unknown) {
      return service.createChoir(choirMutationSchema.parse(input));
    },
    async updateChoir(input: unknown) {
      const { id, ...mutation } = choirUpdateSchema.parse(input);
      return service.updateChoir(id, mutation);
    },
    async setChoirActive(input: unknown) {
      const parsed = choirActiveSchema.parse(input);
      return service.setChoirActive(parsed.id, parsed.isActive);
    },
  };
}

async function loadHandlers() {
  const { getChoirPricingService } = await import(
    "@/features/choirs/choir-pricing.server"
  );
  return createChoirPricingFunctionHandlers(getChoirPricingService());
}

export const getPublicRegistrationConfiguration = createServerFn({ method: "GET" }).handler(
  async () => (await loadHandlers()).getPublicConfiguration(),
);

export const getAdminChoirPricing = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await loadHandlers()).getAdminData());

export const saveAdminPricingSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(pricingSettingsSchema)
  .handler(async ({ data }) => (await loadHandlers()).saveSettings(data));

export const createAdminChoir = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(choirMutationSchema)
  .handler(async ({ data }) => (await loadHandlers()).createChoir(data));

export const updateAdminChoir = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(choirUpdateSchema)
  .handler(async ({ data }) => (await loadHandlers()).updateChoir(data));

export const setAdminChoirActive = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(choirActiveSchema)
  .handler(async ({ data }) => (await loadHandlers()).setChoirActive(data));
