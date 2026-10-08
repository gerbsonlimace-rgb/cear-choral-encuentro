import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  pricingSettingsSchema,
  resolveChoirPrice,
  resolveEventParticipationQuote,
  type AdminChoir,
  type ChoirMutation,
  type PricingSettings,
  type PublicRegistrationConfiguration,
} from "./choir-pricing.domain";
import { dioceseSchema } from "@/features/dioceses/diocese.domain";

export type ChoirPricingRepository = {
  getSettings(): Promise<PricingSettings>;
  saveSettings(input: PricingSettings): Promise<PricingSettings>;
  listChoirs(): Promise<AdminChoir[]>;
  findChoir(id: string): Promise<AdminChoir | null>;
  createChoir(input: ChoirMutation): Promise<AdminChoir>;
  updateChoir(id: string, input: ChoirMutation): Promise<AdminChoir>;
  setChoirActive(id: string, isActive: boolean): Promise<AdminChoir>;
};

export type AdminChoirPricing = {
  settings: PricingSettings;
  choirs: AdminChoir[];
};

export type ResolvedChoirSelection = {
  choir: AdminChoir;
  quote: NonNullable<ReturnType<typeof resolveChoirPrice>>;
};

const sortChoirs = (choirs: AdminChoir[]) =>
  [...choirs].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );

export function createChoirPricingService(repository: ChoirPricingRepository) {
  return {
    async getPublicConfiguration(): Promise<PublicRegistrationConfiguration> {
      const [settings, choirs] = await Promise.all([
        repository.getSettings(),
        repository.listChoirs(),
      ]);

      return {
        standardPriceCents: settings.standardPriceCents,
        eventPriceCents: resolveEventParticipationQuote(settings).registrationPriceCents,
        choirs: sortChoirs(choirs).flatMap((choir) => {
          const quote = resolveChoirPrice(choir, settings);
          return quote
            ? [{ id: choir.id, name: choir.name, diocese: choir.diocese, ...quote }]
            : [];
        }),
      };
    },

    async resolveStandardRegistrationQuote() {
      const settings = await repository.getSettings();
      if (settings.standardPriceCents === null) {
        throw new Error("O valor normal da inscrição não está disponível.");
      }
      return {
        pricingType: "standard" as const,
        standardPriceCents: settings.standardPriceCents,
        registrationPriceCents: settings.standardPriceCents,
      };
    },

    async resolveEventParticipationQuote() {
      return resolveEventParticipationQuote(await repository.getSettings());
    },

    async resolveActiveChoir(id: string): Promise<ResolvedChoirSelection> {
      const [settings, choir] = await Promise.all([
        repository.getSettings(),
        repository.findChoir(id),
      ]);
      const quote = choir ? resolveChoirPrice(choir, settings) : null;
      if (!choir || !quote) {
        throw new Error("O coro selecionado não está disponível para inscrição.");
      }
      return { choir, quote };
    },

    async getAdminData(): Promise<AdminChoirPricing> {
      const [settings, choirs] = await Promise.all([
        repository.getSettings(),
        repository.listChoirs(),
      ]);
      return { settings, choirs: sortChoirs(choirs) };
    },

    saveSettings(input: PricingSettings) {
      return repository.saveSettings(pricingSettingsSchema.parse(input));
    },

    createChoir(input: ChoirMutation) {
      return repository.createChoir(input);
    },

    updateChoir(id: string, input: ChoirMutation) {
      return repository.updateChoir(id, input);
    },

    setChoirActive(id: string, isActive: boolean) {
      return repository.setChoirActive(id, isActive);
    },
  };
}

const settingsColumns =
  "standard_price_cents,promotional_price_cents,promotional_remaining_price_cents" as const;
const choirColumns =
  "id,name,diocese,uses_promotional_price,is_free,is_active,created_at,updated_at" as const;

function mapSettings(row: {
  standard_price_cents: number | null;
  promotional_price_cents: number | null;
  promotional_remaining_price_cents: number | null;
}): PricingSettings {
  return pricingSettingsSchema.parse({
    standardPriceCents: row.standard_price_cents,
    promotionalPriceCents: row.promotional_price_cents,
    promotionalRemainingPriceCents: row.promotional_remaining_price_cents,
  });
}

function mapChoir(row: {
  id: string;
  name: string;
  diocese: string | null;
  uses_promotional_price: boolean;
  is_free: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): AdminChoir {
  return {
    id: row.id,
    name: row.name,
    diocese: dioceseSchema.nullable().parse(row.diocese),
    usesPromotionalPrice: row.uses_promotional_price,
    isFree: row.is_free,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwRepositoryError(error: { code?: string } | null, fallback: string): never {
  if (error?.code === "23505") throw new Error("Já existe um coro com esse nome.");
  throw new Error(fallback);
}

export function createSupabaseChoirPricingRepository(): ChoirPricingRepository {
  const getSettings = async () => {
    const { data, error } = await supabaseAdmin
      .from("event_registration_settings")
      .select(settingsColumns)
      .eq("id", true)
      .single();
    if (error || !data)
      throwRepositoryError(error, "Não foi possível consultar os valores do evento.");
    return mapSettings(data);
  };

  const returningChoir = async (
    query: PromiseLike<{ data: unknown; error: { code?: string } | null }>,
  ) => {
    const { data, error } = await query;
    if (error || !data) throwRepositoryError(error, "Não foi possível salvar o coro.");
    return mapChoir(data as Parameters<typeof mapChoir>[0]);
  };

  return {
    getSettings,

    async saveSettings(input) {
      const { data, error } = await supabaseAdmin
        .from("event_registration_settings")
        .update({
          standard_price_cents: input.standardPriceCents,
          promotional_price_cents: input.promotionalPriceCents,
          promotional_remaining_price_cents: input.promotionalRemainingPriceCents ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .select(settingsColumns)
        .single();
      if (error || !data)
        throwRepositoryError(error, "Não foi possível salvar os valores do evento.");
      return mapSettings(data);
    },

    async listChoirs() {
      const { data, error } = await supabaseAdmin.from("choirs").select(choirColumns);
      if (error) throwRepositoryError(error, "Não foi possível consultar os coros.");
      return (data ?? []).map(mapChoir);
    },

    async findChoir(id) {
      const { data, error } = await supabaseAdmin
        .from("choirs")
        .select(choirColumns)
        .eq("id", id)
        .maybeSingle();
      if (error) throwRepositoryError(error, "Não foi possível consultar o coro.");
      return data ? mapChoir(data) : null;
    },

    createChoir(input) {
      return returningChoir(
        supabaseAdmin
          .from("choirs")
          .insert({
            name: input.name,
            diocese: input.diocese,
            uses_promotional_price: input.usesPromotionalPrice,
            is_free: input.isFree ?? false,
            is_active: input.isActive,
          })
          .select(choirColumns)
          .single(),
      );
    },

    updateChoir(id, input) {
      return returningChoir(
        supabaseAdmin
          .from("choirs")
          .update({
            name: input.name,
            diocese: input.diocese,
            uses_promotional_price: input.usesPromotionalPrice,
            is_free: input.isFree ?? false,
            is_active: input.isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select(choirColumns)
          .single(),
      );
    },

    setChoirActive(id, isActive) {
      return returningChoir(
        supabaseAdmin
          .from("choirs")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select(choirColumns)
          .single(),
      );
    },
  };
}

let choirPricingService: ReturnType<typeof createChoirPricingService> | undefined;

export function getChoirPricingService() {
  if (!choirPricingService) {
    choirPricingService = createChoirPricingService(createSupabaseChoirPricingRepository());
  }
  return choirPricingService;
}
