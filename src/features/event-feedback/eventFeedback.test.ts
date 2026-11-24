import { describe, expect, it, vi } from "vitest";
import { eventFeedbackSchema } from "./eventFeedback.domain";
import { saveEventFeedback } from "./eventFeedback.server";

export const validFeedback = {
  submissionId: "22222222-2222-4222-8222-222222222222",
  accessToken: "a".repeat(64),
  overall: 4,
  aspects: {
    organization: 4,
    formation: 5,
    celebrations: 5,
    venue: 3,
    food: 4,
    lodging: "not_used",
  },
  suggestion: "Mais tempo de convivência.",
};

describe("anonymous event feedback", () => {
  it("accepts explicit unused services and trims the optional suggestion", () => {
    expect(
      eventFeedbackSchema.parse({ ...validFeedback, suggestion: "  Obrigado!  " }).suggestion,
    ).toBe("Obrigado!");
    expect(eventFeedbackSchema.parse(validFeedback).aspects.lodging).toBe("not_used");
  });
  it("rejects incomplete, out-of-range, oversized and identifying payloads", () => {
    for (const input of [
      { ...validFeedback, overall: 0 },
      { ...validFeedback, accessToken: undefined },
      { ...validFeedback, aspects: { ...validFeedback.aspects, venue: 0 } },
      { ...validFeedback, aspects: { ...validFeedback.aspects, venue: undefined } },
      { ...validFeedback, aspects: { ...validFeedback.aspects, formation: "not_used" } },
      { ...validFeedback, suggestion: "a".repeat(1001) },
      { ...validFeedback, email: "a@test.com" },
      { ...validFeedback, identity: "pessoa@exemplo.com" },
    ])
      expect(eventFeedbackSchema.safeParse(input).success).toBe(false);
  });
  it("validates before storage and uses the submission UUID as the idempotency key", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    await expect(saveEventFeedback({ ...validFeedback, overall: 0 }, insert)).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
    await expect(saveEventFeedback(validFeedback, insert)).resolves.toEqual({ saved: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ submission_id: validFeedback.submissionId, overall: 4 }),
      validFeedback.accessToken,
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty("user_id");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("accessToken");
  });
  it("never reports success for unhandled database conflicts or storage errors", async () => {
    await expect(
      saveEventFeedback(validFeedback, async () => ({ error: { code: "23505" } })),
    ).rejects.toThrow("Não foi possível enviar");
    await expect(
      saveEventFeedback(validFeedback, async () => ({ error: { code: "XX000" } })),
    ).rejects.toThrow("Não foi possível enviar");
  });
});

describe("feedback identity input mask", () => {
  it("formats digits as a CPF and stops at 11 digits", async () => {
    const { formatFeedbackIdentityInput } = await import("./eventFeedback.domain");
    expect(formatFeedbackIdentityInput("5299822")).toBe("529.982.2");
    expect(formatFeedbackIdentityInput("529982247251234")).toBe("529.982.247-25");
  });
  it("keeps emails unmasked, even when they start with digits", async () => {
    const { formatFeedbackIdentityInput } = await import("./eventFeedback.domain");
    expect(formatFeedbackIdentityInput("maria@gmail.com")).toBe("maria@gmail.com");
    expect(formatFeedbackIdentityInput("123.4a", "123.4")).toBe("1234a");
  });
});
