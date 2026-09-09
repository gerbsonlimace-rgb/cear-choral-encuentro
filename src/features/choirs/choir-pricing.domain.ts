import { z } from "zod";

const optionalPositiveCentsSchema = z.number().int().positive().nullable();

export const pricingTypeSchema = z.enum(["standard", "promotional"]);

export const pricingSettingsSchema = z
  .object({
    standardPriceCents: optionalPositiveCentsSchema,
    promotionalPriceCents: optionalPositiveCentsSchema,
    shirtPriceCents: optionalPositiveCentsSchema,
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
    usesPromotionalPrice: z.boolean(),
    isActive: z.boolean(),
  })
  .strict();

export const choirIdSchema = z.string().uuid();

export const displayedQuoteSchema = z
  .object({
    pricingType: pricingTypeSchema,
    standardPriceCents: z.number().int().positive(),
    registrationPriceCents: z.number().int().positive(),
  })
  .strict();

export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export type ChoirMutation = z.infer<typeof choirMutationSchema>;
export type DisplayedQuote = z.infer<typeof displayedQuoteSchema>;
export type ResolvedChoirPrice = DisplayedQuote;

export type AdminChoir = ChoirMutation & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicChoirOption = {
  id: string;
  name: string;
  pricingType: DisplayedQuote["pricingType"];
  standardPriceCents: number;
  registrationPriceCents: number;
};

export type PublicRegistrationConfiguration = {
  choirs: PublicChoirOption[];
  shirtPriceCents: number | null;
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
    };
  }

  return {
    pricingType: "standard",
    standardPriceCents: settings.standardPriceCents,
    registrationPriceCents: settings.standardPriceCents,
  };
}
