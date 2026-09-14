import { z } from "zod";

import { raffleChoiceSchema, type RaffleChoice } from "@/features/choirs/choir-pricing.domain";
import {
  MAX_REGISTRATION_PHOTO_BYTES,
  voicePartSchema,
  type RegistrationPhotoInput,
  type VoicePart,
} from "./registration.domain";

export const REGISTRATION_DRAFT_STORAGE_KEY = "encontro-coros-registration-draft-v1";
const REGISTRATION_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_REGISTRATION_PHOTO_BASE64_LENGTH = Math.ceil(MAX_REGISTRATION_PHOTO_BYTES / 3) * 4;

export type RegistrationDraftForm = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string;
  choirId: string;
  raffleChoice: "" | RaffleChoice;
  voicePart: "" | VoicePart;
};

export type RegistrationDraft = {
  form: RegistrationDraftForm;
  photo: RegistrationPhotoInput | null;
  photoFileName: string;
  currentStep: 1 | 2 | 3;
};

const draftSchema = z
  .object({
    version: z.literal(1),
    savedAt: z.number().finite().nonnegative(),
    form: z
      .object({
        name: z.string().max(100),
        cpf: z.string().max(20),
        email: z.string().max(254),
        phone: z.string().max(30),
        birthDate: z.string().max(10),
        choirId: z.string().max(100),
        raffleChoice: z.union([z.literal(""), raffleChoiceSchema]),
        voicePart: z.union([z.literal(""), voicePartSchema]),
      })
      .strict(),
    photo: z
      .object({
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        dataBase64: z.string().min(4).max(MAX_REGISTRATION_PHOTO_BASE64_LENGTH),
      })
      .strict()
      .nullable(),
    photoFileName: z.string().max(255),
    currentStep: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRegistrationDraft(now = Date.now()): RegistrationDraft | null {
  const storage = browserStorage();
  if (!storage) return null;

  try {
    const serialized = storage.getItem(REGISTRATION_DRAFT_STORAGE_KEY);
    if (!serialized) return null;
    const parsed = draftSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success || now - parsed.data.savedAt > REGISTRATION_DRAFT_MAX_AGE_MS) {
      storage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
      return null;
    }

    const { form, photo, photoFileName } = parsed.data;
    return {
      form,
      photo,
      photoFileName,
      currentStep: photo ? parsed.data.currentStep : 1,
    };
  } catch {
    storage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
    return null;
  }
}

export function saveRegistrationDraft(draft: RegistrationDraft, now = Date.now()): void {
  const storage = browserStorage();
  if (!storage) return;

  const hasEnteredData =
    draft.photo !== null ||
    draft.currentStep !== 1 ||
    Object.values(draft.form).some((value) => value.length > 0);
  if (!hasEnteredData) {
    storage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
    return;
  }

  const serialized = JSON.stringify({ version: 1, savedAt: now, ...draft });
  try {
    storage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, serialized);
  } catch {
    if (!draft.photo) return;
    try {
      storage.setItem(
        REGISTRATION_DRAFT_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: now,
          ...draft,
          photo: null,
          photoFileName: "",
          currentStep: 1,
        }),
      );
    } catch {
      // Browsers may disable storage or reject the draft when their quota is exhausted.
    }
  }
}

export function clearRegistrationDraft(): void {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
