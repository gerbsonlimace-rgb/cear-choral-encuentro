import { z } from "zod";
import { displayedQuoteSchema, type DisplayedQuote } from "@/features/choirs/choir-pricing.domain";

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculateDigit = (length: number) => {
    const sum = value
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10]);
}

export const cpfSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine(isValidCpf, "Informe um CPF válido.");

const voicePartValues = ["soprano", "contralto", "tenor", "baixo", "nao_sei_informar"] as const;
export const voicePartSchema = z.enum(voicePartValues);
export type VoicePart = z.infer<typeof voicePartSchema>;
export const voicePartOptions: ReadonlyArray<{ value: VoicePart; label: string }> = [
  { value: "soprano", label: "Soprano" },
  { value: "contralto", label: "Contralto" },
  { value: "tenor", label: "Tenor" },
  { value: "baixo", label: "Baixo" },
  { value: "nao_sei_informar", label: "Não sei informar" },
];

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

export const birthDateSchema = z
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

export const registrationResumeSchema = z
  .object({
    cpf: cpfSchema,
    birthDate: birthDateSchema,
  })
  .strict();

export type RegistrationResumeInput = z.infer<typeof registrationResumeSchema>;

export const shirtSizeSchema = z.enum(["P", "M", "G", "GG", "XG"]);

export const MAX_REGISTRATION_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_REGISTRATION_PHOTO_BASE64_LENGTH = Math.ceil(MAX_REGISTRATION_PHOTO_BYTES / 3) * 4;

const registrationPhotoSchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    dataBase64: z
      .string()
      .min(4, "Envie uma foto do participante.")
      .max(MAX_REGISTRATION_PHOTO_BASE64_LENGTH, "A foto deve ter até 5 MB.")
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, {
        message: "A foto enviada é inválida.",
      }),
  })
  .strict();

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    cpf: cpfSchema,
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    phone: z.string().trim().min(8).max(30),
    birthDate: birthDateSchema,
    choirId: z.string().uuid("Selecione um coro válido."),
    voicePart: voicePartSchema,
    photo: registrationPhotoSchema,
    displayedQuote: displayedQuoteSchema,
    displayedShirtPriceCents: z.number().int().positive().nullable().optional(),
    includeShirt: z.boolean().optional(),
    shirtSize: shirtSizeSchema.or(z.literal("")).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const coherentQuote =
      value.displayedQuote.pricingType === "standard"
        ? value.displayedQuote.registrationPriceCents === value.displayedQuote.standardPriceCents
        : value.displayedQuote.registrationPriceCents < value.displayedQuote.standardPriceCents;
    if (!coherentQuote) {
      context.addIssue({
        code: "custom",
        path: ["displayedQuote"],
        message: "O valor exibido para a inscrição é inválido.",
      });
    }
    const includeShirt = value.includeShirt ?? false;
    const shirtSize = value.shirtSize ?? "";
    if (includeShirt && !shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "Escolha o tamanho da camisa.",
      });
    }
    if (!includeShirt && shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "O tamanho só pode ser informado quando a camisa está incluída.",
      });
    }
    if (includeShirt && value.displayedShirtPriceCents == null) {
      context.addIssue({
        code: "custom",
        path: ["includeShirt"],
        message: "A camisa não está disponível.",
      });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type RegistrationPhotoInput = z.infer<typeof registrationPhotoSchema>;
export type CheckoutItem = { quantity: 1; price: number; description: string };

export function buildCheckoutItems(
  _input: RegistrationInput,
  trustedQuote: DisplayedQuote,
  trustedShirtPriceCents: number | null = null,
): CheckoutItem[] {
  const items: CheckoutItem[] = [
    {
      quantity: 1,
      price: trustedQuote.registrationPriceCents,
      description: "Inscrição — II Encontro de Coros",
    },
  ];
  if (_input.includeShirt) {
    if (trustedShirtPriceCents === null) throw new Error("A camisa não está disponível.");
    items.push({
      quantity: 1,
      price: trustedShirtPriceCents,
      description: `Camisa oficial — tamanho ${_input.shirtSize ?? ""}`,
    });
  }
  return items;
}

export function calculateOrderAmountCents(
  input: RegistrationInput,
  trustedQuote: DisplayedQuote,
  trustedShirtPriceCents: number | null = null,
): number {
  return buildCheckoutItems(input, trustedQuote, trustedShirtPriceCents).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

export const paymentLookupSchema = z.object({
  orderNsu: z.string().uuid(),
  transactionNsu: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  receiptUrl: z.string().url().optional(),
});

export type PaymentLookup = z.infer<typeof paymentLookupSchema>;
