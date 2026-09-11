import { z } from "zod";

import {
  birthDateSchema,
  cpfSchema,
  type VoicePart,
} from "@/features/registration/registration.domain";

export const participantAccessStatusSchema = z.enum(["active", "pending", "conflict"]);
export type ParticipantAccessStatus = z.infer<typeof participantAccessStatusSchema>;

export const participantRegistrationIdSchema = z
  .object({
    registrationId: z.string().uuid(),
  })
  .strict();

export type ParticipantRegistrationId = z.infer<typeof participantRegistrationIdSchema>;

export type ParticipantRegistrationView = {
  identity: {
    name: string;
    cpf: string;
    birthDate: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
  };
  registration: {
    choirName: string;
    diocese: string;
    city?: string | null;
    institution?: string | null;
    role?: string | null;
    voicePart?: VoicePart | null;
    includeShirt: boolean;
    shirtSize?: string | null;
    pricingType?: "standard" | "promotional" | null;
    standardPriceCents?: number | null;
    registrationPriceCents?: number | null;
    shirtPriceCents?: number | null;
  };
  payment: {
    status: "paid";
    amountCents?: number | null;
    paidAmountCents?: number | null;
    paymentMethod?: "pix" | "credit_card" | null;
    installments?: number | null;
    paidAt?: string | null;
    orderNsu?: string | null;
    receiptUrl?: string | null;
  };
};

export function buildInitialParticipantPassword(cpf: string, birthDate: string): string {
  const digits = cpfSchema.parse(cpf);
  const normalizedDate = birthDateSchema.parse(birthDate);
  const [year, month, day] = normalizedDate.split("-");
  return `${digits}${day}${month}${year}`;
}

export function maskCpf(cpf: string): string {
  const digits = cpfSchema.parse(cpf);
  return `***.***.***-${digits.slice(-2)}`;
}
