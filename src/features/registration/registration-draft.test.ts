import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REGISTRATION_DRAFT_STORAGE_KEY,
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
  type RegistrationDraft,
} from "./registration-draft";

const savedAt = new Date("2026-09-13T12:00:00.000Z").getTime();
const draft: RegistrationDraft = {
  form: {
    name: "Maria da Silva",
    badgeName: "Maria Silva",
    cpf: "529.982.247-25",
    email: "maria@example.com",
    phone: "(85) 99999-9999",
    birthDate: "1990-05-20",
    diocese: "Diocese de Quixadá",
    choirId: "11111111-1111-4111-8111-111111111111",
    otherChoirName: "",
    raffleChoice: "participate",
    voicePart: "soprano",
  },
  photo: { contentType: "image/jpeg", dataBase64: "dGVzdA==" },
  photoFileName: "maria.jpg",
  currentStep: 3,
};

describe("registration draft", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("round-trips a complete registration draft", () => {
    saveRegistrationDraft(draft, savedAt);

    expect(loadRegistrationDraft(savedAt + 1)).toEqual(draft);
  });

  it("round-trips an other-choir draft", () => {
    const otherDraft = {
      ...draft,
      form: { ...draft.form, choirId: "other", otherChoirName: "Coral Santa Cecília" },
    };

    saveRegistrationDraft(otherDraft, savedAt);

    expect(loadRegistrationDraft(savedAt + 1)).toEqual(otherDraft);
  });

  it("preserves a partially typed birth date even when it is the only entered field", () => {
    const partialBirthDateDraft: RegistrationDraft = {
      form: {
        name: "",
        badgeName: "",
        cpf: "",
        email: "",
        phone: "",
        birthDate: "",
        diocese: "",
        choirId: "",
        otherChoirName: "",
        raffleChoice: "",
        voicePart: "",
      },
      photo: null,
      photoFileName: "",
      birthDateInput: "20/05",
      currentStep: 1,
    };

    saveRegistrationDraft(partialBirthDateDraft, savedAt);

    expect(loadRegistrationDraft(savedAt + 1)).toEqual(partialBirthDateDraft);
  });

  it("discards a draft after 24 hours", () => {
    saveRegistrationDraft(draft, savedAt);

    expect(loadRegistrationDraft(savedAt + 24 * 60 * 60 * 1000 + 1)).toBeNull();
    expect(window.localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("discards malformed browser data instead of breaking the form", () => {
    window.localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, "not-json");

    expect(loadRegistrationDraft(savedAt)).toBeNull();
    expect(window.localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("keeps the text fields when the browser quota rejects the photo", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });

    saveRegistrationDraft(draft, savedAt);

    expect(loadRegistrationDraft(savedAt + 1)).toEqual({
      ...draft,
      photo: null,
      photoFileName: "",
      currentStep: 1,
    });
  });

  it("clears a previously saved draft", () => {
    saveRegistrationDraft(draft, savedAt);

    clearRegistrationDraft();

    expect(loadRegistrationDraft(savedAt + 1)).toBeNull();
  });
});
