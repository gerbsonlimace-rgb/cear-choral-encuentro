import { z } from "zod";

export const REGISTRATION_PRICE_CENTS = 10000;
export const SHIRT_PRICE_CENTS = 3990;

export const registrationRoleSchema = z.enum([
  "participant",
  "musician",
  "singer",
  "conductor",
  "liturgist",
  "priest",
  "other",
]);

export const shirtSizeSchema = z.enum(["P", "M", "G", "GG", "XG"]);

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(8).max(30),
    city: z.string().trim().min(2).max(100),
    institution: z.string().trim().max(200).optional().or(z.literal("")),
    role: registrationRoleSchema,
    includeShirt: z.boolean(),
    shirtSize: shirtSizeSchema.or(z.literal("")),
    observations: z.string().trim().max(1000).optional().or(z.literal("")),
  })
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
