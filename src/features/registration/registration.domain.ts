import { z } from "zod";

export const REGISTRATION_PRICE_CENTS = 10000;
export const SHIRT_PRICE_CENTS = 3990;

export const DIOCESES = [
  "Arquidiocese de Fortaleza",
  "Diocese do Crato",
  "Diocese de Crateús",
  "Diocese de Iguatu",
  "Diocese de Itapipoca",
  "Diocese de Limoeiro do Norte",
  "Diocese de Quixadá",
  "Diocese de Sobral",
  "Diocese de Tianguá",
] as const;

export const dioceseSchema = z.enum(DIOCESES);

export const shirtSizeSchema = z.enum(["P", "M", "G", "GG", "XG"]);

const fortalezaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getFortalezaCalendarDate(instant = new Date()) {
  const parts = fortalezaDateFormatter.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) throw new Error("Não foi possível determinar a data local.");
  return `${year}-${month}-${day}`;
}

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de nascimento válida.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Informe uma data de nascimento válida.")
  .refine(
    (value) => value <= getFortalezaCalendarDate(),
    "A data de nascimento não pode estar no futuro.",
  );

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(8).max(30),
    birthDate: birthDateSchema,
    diocese: dioceseSchema,
    includeShirt: z.boolean(),
    shirtSize: shirtSizeSchema.or(z.literal("")),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.includeShirt && !value.shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "Escolha o tamanho da camisa.",
      });
    }
    if (!value.includeShirt && value.shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "O tamanho só pode ser informado quando a camisa está incluída.",
      });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type CheckoutItem = { quantity: 1; price: number; description: string };

export function buildCheckoutItems(input: RegistrationInput): CheckoutItem[] {
  const items: CheckoutItem[] = [
    {
      quantity: 1,
      price: REGISTRATION_PRICE_CENTS,
      description: "Inscrição — II Encontro de Coros",
    },
  ];
  if (input.includeShirt) {
    items.push({
      quantity: 1,
      price: SHIRT_PRICE_CENTS,
      description: `Camisa oficial — tamanho ${input.shirtSize}`,
    });
  }
  return items;
}

export function calculateOrderAmountCents(input: RegistrationInput): number {
  return buildCheckoutItems(input).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export const paymentLookupSchema = z.object({
  orderNsu: z.string().uuid(),
  transactionNsu: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  receiptUrl: z.string().url().optional(),
});

export type PaymentLookup = z.infer<typeof paymentLookupSchema>;
