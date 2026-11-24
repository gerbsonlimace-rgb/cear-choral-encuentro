import { z } from "zod";
import {
  displayedQuoteSchema,
  participationTypeSchema,
  raffleChoiceSchema,
  type DisplayedQuote,
  type ParticipationType,
} from "@/features/choirs/choir-pricing.domain";

export type { ParticipationType } from "@/features/choirs/choir-pricing.domain";
import { dioceseSchema, type Diocese } from "@/features/dioceses/diocese.domain";

export { dioceseOptions, dioceseSchema, type Diocese } from "@/features/dioceses/diocese.domain";

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

const brazilianAreaCodes = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export function isValidBrazilianMobilePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.length === 13 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;

  return (
    nationalNumber.length === 11 &&
    brazilianAreaCodes.has(nationalNumber.slice(0, 2)) &&
    nationalNumber[2] === "9"
  );
}

export const brazilianMobilePhoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine(isValidBrazilianMobilePhone, "Informe um WhatsApp brasileiro válido.");

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

const musicalProfileValues = ["regente", "instrumentista", "coralista"] as const;
export const musicalProfileSchema = z.enum(musicalProfileValues);
export type MusicalProfile = z.infer<typeof musicalProfileSchema>;
export const musicalProfileOptions: ReadonlyArray<{ value: MusicalProfile; label: string }> = [
  { value: "regente", label: "Regente" },
  { value: "instrumentista", label: "Instrumentista" },
  { value: "coralista", label: "Coralista" },
];

const genderValues = ["masculino", "feminino", "nao_informado"] as const;
export const genderSchema = z.enum(genderValues);
export type Gender = z.infer<typeof genderSchema>;
export const genderOptions: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "nao_informado", label: "Não informado" },
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

export const registrationLookupSchema = registrationResumeSchema;
export type RegistrationLookupInput = z.infer<typeof registrationLookupSchema>;
export type RegistrationLookupResult =
  | {
      status: "found";
      name: string;
      badgeName?: string | null;
      email: string;
      phone: string;
      choirId: string | null;
      otherChoirName?: string | null;
      diocese?: Diocese | null;
      musicalProfile: MusicalProfile | null;
      voicePart: VoicePart | null;
      hasPhoto: boolean;
      paymentStatus: "legacy" | "pending" | "paid";
      hasPayableCheckout?: boolean;
      hasUsableCheckout?: boolean;
    }
  | { status: "not_found" };

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
    badgeName: z.string().trim().min(2, "Informe o nome para o crachá.").max(60),
    cpf: cpfSchema,
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    phone: brazilianMobilePhoneSchema,
    birthDate: birthDateSchema,
    diocese: dioceseSchema,
    choirId: z.string().uuid("Selecione um coro válido.").nullable(),
    otherChoirName: z.string().trim().min(2, "Informe o nome do coro.").max(120).nullable(),
    musicalProfile: musicalProfileSchema,
    gender: genderSchema.default("nao_informado"),
    voicePart: voicePartSchema.nullable(),
    photo: registrationPhotoSchema,
    participationType: participationTypeSchema,
    raffleChoice: raffleChoiceSchema,
    displayedQuote: displayedQuoteSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hasConfiguredChoir = value.choirId !== null;
    const hasOtherChoir = value.otherChoirName !== null;
    if (hasConfiguredChoir === hasOtherChoir) {
      context.addIssue({
        code: "custom",
        path: [hasConfiguredChoir ? "otherChoirName" : "choirId"],
        message: "Selecione um coro ou informe outro coro.",
      });
    }

    if (value.musicalProfile === "coralista" && value.voicePart === null) {
      context.addIssue({
        code: "custom",
        path: ["voicePart"],
        message: "Selecione seu naipe vocal.",
      });
    }
    if (value.musicalProfile !== "coralista" && value.voicePart !== null) {
      context.addIssue({
        code: "custom",
        path: ["voicePart"],
        message: "O naipe vocal deve ser informado apenas para Coralista.",
      });
    }

    const coherentQuote =
      value.displayedQuote.pricingType === "free"
        ? value.displayedQuote.standardPriceCents === 0 && value.displayedQuote.registrationPriceCents === 0
        : value.displayedQuote.pricingType === "standard"
        ? value.displayedQuote.registrationPriceCents === value.displayedQuote.standardPriceCents
        : value.displayedQuote.registrationPriceCents < value.displayedQuote.standardPriceCents;
    if (!coherentQuote) {
      context.addIssue({
        code: "custom",
        path: ["displayedQuote"],
        message: "O valor exibido para a inscrição é inválido.",
      });
    }

    const choiceMatchesQuote =
      value.participationType === "event"
        ? value.raffleChoice === "full_price" && value.displayedQuote.pricingType === "standard"
        : value.raffleChoice === "participate"
        ? value.displayedQuote.pricingType === "promotional"
        : value.displayedQuote.pricingType === "free" ||
          (value.displayedQuote.pricingType === "standard" &&
          value.displayedQuote.registrationPriceCents === value.displayedQuote.standardPriceCents);
    if (!choiceMatchesQuote) {
      context.addIssue({
        code: "custom",
        path: ["displayedQuote"],
        message: "A escolha de rifas não corresponde ao valor exibido para a inscrição.",
      });
    }
  });

// Input type keeps `gender` optional: the schema supplies the default at parse time.
export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationPhotoInput = z.infer<typeof registrationPhotoSchema>;
export type CheckoutItem = { quantity: number; price: number; description: string };

export function buildCheckoutItems(
  _input: RegistrationInput,
  trustedQuote: DisplayedQuote,
): CheckoutItem[] {
  return [
    {
      quantity: 1,
      price: trustedQuote.registrationPriceCents,
      description: "Inscrição — II Encontro de Coros",
    },
  ];
}

export function calculateOrderAmountCents(
  input: RegistrationInput,
  trustedQuote: DisplayedQuote,
): number {
  return buildCheckoutItems(input, trustedQuote).reduce(
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
