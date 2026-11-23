import { describe, expect, it, vi } from "vitest";
import { eventFeedbackSchema, feedbackIdentitySchema } from "./eventFeedback.domain";
import { saveEventFeedback } from "./eventFeedback.server";

export const validFeedback = {
  submissionId: "22222222-2222-4222-8222-222222222222",
  identity: "Pessoa@Exemplo.com",
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
  it("requires and normalizes a valid CPF or email for separate response control", () => {
    expect(feedbackIdentitySchema.parse("  Pessoa@Exemplo.com  ")).toBe("pessoa@exemplo.com");
    expect(feedbackIdentitySchema.parse("529.982.247-25")).toBe("52998224725");
    for (const identity of ["", "11111111111", "52998224724", "invalido@", "abc52998224725"])
      expect(feedbackIdentitySchema.safeParse(identity).success).toBe(false);
    expect(eventFeedbackSchema.safeParse({ ...validFeedback, identity: undefined }).success).toBe(
      false,
    );
  });
  it("accepts explicit unused services and trims the optional suggestion", () => {
    expect(
      eventFeedbackSchema.parse({ ...validFeedback, suggestion: "  Obrigado!  " }).suggestion,
    ).toBe("Obrigado!");
    expect(eventFeedbackSchema.parse(validFeedback).aspects.lodging).toBe("not_used");
  });
  it("rejects incomplete, out-of-range, oversized and identifying payloads", () => {
    for (const input of [
      { ...validFeedback, overall: 0 },
      { ...validFeedback, aspects: { ...validFeedback.aspects, venue: 0 } },
      { ...validFeedback, aspects: { ...validFeedback.aspects, venue: undefined } },
      { ...validFeedback, aspects: { ...validFeedback.aspects, formation: "not_used" } },
      { ...validFeedback, suggestion: "a".repeat(1001) },
      { ...validFeedback, email: "a@test.com" },
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
      "email:pessoa@exemplo.com",
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
  it("explains a repeated identifier without exposing it in the error", async () => {
    await expect(
      saveEventFeedback(validFeedback, async () => ({
        error: { code: "P0001", message: "feedback_already_sent" },
      })),
    ).rejects.toThrow("Já recebemos uma avaliação com este CPF ou e-mail");
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
