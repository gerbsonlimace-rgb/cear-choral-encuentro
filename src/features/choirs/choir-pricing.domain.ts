import { z } from "zod";

import { dioceseSchema, type Diocese } from "@/features/dioceses/diocese.domain";

const optionalPositiveCentsSchema = z.number().int().positive().nullable();
const optionalNonNegativeCentsSchema = z.number().int().nonnegative().nullable();

export const pricingTypeSchema = z.enum(["standard", "promotional"]);

export const pricingSettingsSchema = z
  .object({
    standardPriceCents: optionalPositiveCentsSchema,
    promotionalPriceCents: optionalPositiveCentsSchema,
    promotionalRemainingPriceCents: optionalNonNegativeCentsSchema.optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      settings.standardPriceCents !== null &&
      settings.promotionalPriceCents !== null &&
      settings.promotionalPriceCents >= settings.standardPriceCents
    ) {
      context.addIssue({
        code: "custom",
        path: ["promotionalPriceCents"],
        message: "O valor promocional deve ser menor que o valor normal.",
      });
    }
  });

export const choirMutationSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do coro.").max(120),
    diocese: dioceseSchema,
    usesPromotionalPrice: z.boolean(),
    isActive: z.boolean(),
  })
  .strict();

export const choirIdSchema = z.string().uuid();

export const choirUpdateSchema = choirMutationSchema.extend({ id: choirIdSchema });

export const choirActiveSchema = z
  .object({
    id: choirIdSchema,
    isActive: z.boolean(),
  })
  .strict();

export const displayedQuoteSchema = z
  .object({
    pricingType: pricingTypeSchema,
    standardPriceCents: z.number().int().positive(),
    registrationPriceCents: z.number().int().positive(),
    remainingPriceCents: z.number().int().nonnegative().optional(),
  })
  .strict();

export const raffleChoiceSchema = z.enum(["participate", "full_price"]);

export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export type ChoirMutation = z.infer<typeof choirMutationSchema>;
export type DisplayedQuote = z.infer<typeof displayedQuoteSchema>;
export type RaffleChoice = z.infer<typeof raffleChoiceSchema>;
export type ResolvedChoirPrice = DisplayedQuote;

export type AdminChoir = Omit<ChoirMutation, "diocese"> & {
  id: string;
  diocese: Diocese | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicChoirOption = {
  id: string;
  name: string;
  diocese: Diocese | null;
  pricingType: DisplayedQuote["pricingType"];
  standardPriceCents: number;
  registrationPriceCents: number;
  remainingPriceCents?: number;
};

export type PublicRegistrationConfiguration = {
  standardPriceCents: number | null;
  choirs: PublicChoirOption[];
};

export function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+(?:,\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor válido com até duas casas decimais.");
  }

  const [reais, decimal = ""] = normalized.split(",");
  const cents = Number(reais) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Informe um valor válido e maior que zero.");
  }
  return cents;
}

export function formatCentsForInput(value: number | null): string {
  if (value === null) return "";
  return (value / 100).toFixed(2).replace(".", ",");
}

export function resolveChoirPrice(
  choir: Pick<AdminChoir, "isActive" | "usesPromotionalPrice">,
  settings: PricingSettings,
): ResolvedChoirPrice | null {
  if (!choir.isActive || settings.standardPriceCents === null) return null;

  if (choir.usesPromotionalPrice) {
    if (
      settings.promotionalPriceCents === null ||
      settings.promotionalPriceCents >= settings.standardPriceCents
    ) {
      return null;
    }
    return {
      pricingType: "promotional",
      standardPriceCents: settings.standardPriceCents,
      registrationPriceCents: settings.promotionalPriceCents,
      ...(settings.promotionalRemainingPriceCents === undefined ||
      settings.promotionalRemainingPriceCents === null
        ? {}
        : { remainingPriceCents: settings.promotionalRemainingPriceCents }),
    };
  }

  return {
    pricingType: "standard",
    standardPriceCents: settings.standardPriceCents,
    registrationPriceCents: settings.standardPriceCents,
  };
}

export function applyRaffleChoice(
  availableQuote: DisplayedQuote,
  choice: RaffleChoice,
): DisplayedQuote {
  if (choice === "participate") {
    if (availableQuote.pricingType !== "promotional") {
      throw new Error("O programa de rifas não está disponível para este coro.");
    }
    return availableQuote;
  }

  return {
    pricingType: "standard",
    standardPriceCents: availableQuote.standardPriceCents,
    registrationPriceCents: availableQuote.standardPriceCents,
  };
}
