import { describe, expect, it } from "vitest";

import {
  buildInitialParticipantPassword,
  maskCpf,
  participantAccessStatusSchema,
  participantRegistrationIdSchema,
  type ParticipantRegistrationView,
} from "./participant.domain";

describe("participant domain", () => {
  it("normalizes CPF and formats the initial password as DDMMAAAA", () => {
    expect(buildInitialParticipantPassword("529.982.247-25", "1990-01-15")).toBe(
      "5299822472515011990",
    );
  });

  it("keeps leap-day dates in the password", () => {
    expect(buildInitialParticipantPassword("52998224725", "2000-02-29")).toBe(
      "5299822472529022000",
    );
  });

  it("rejects invalid CPF and birth dates before building a password", () => {
    expect(() => buildInitialParticipantPassword("11111111111", "1990-01-15")).toThrow();
    expect(() => buildInitialParticipantPassword("52998224725", "1900-02-29")).toThrow();
    expect(() => buildInitialParticipantPassword("52998224725", "1990-02-30")).toThrow();
  });

  it("masks a normalized CPF while preserving only its last two digits", () => {
    expect(maskCpf("52998224725")).toBe("***.***.***-25");
    expect(maskCpf("529.982.247-25")).toBe("***.***.***-25");
    expect(() => maskCpf("11111111111")).toThrow();
  });

  it("accepts every participant access status", () => {
    for (const status of ["active", "pending", "conflict"] as const) {
      expect(participantAccessStatusSchema.parse(status)).toBe(status);
    }
    expect(participantAccessStatusSchema.safeParse("disabled").success).toBe(false);
  });

  it("keeps participant views omission-ready for nullable persisted values", () => {
    const view: ParticipantRegistrationView = {
      identity: {
        name: "Maria da Silva",
        cpf: "***.***.***-25",
        birthDate: "1990-01-15",
      },
      registration: {
        choirName: "Coro Diocesano de Quixadá",
        diocese: "Diocese de Quixadá",
        voicePart: null,
        role: null,
        includeShirt: false,
        shirtSize: null,
      },
      payment: {
        status: "paid",
        amountCents: 30000,
        paidAmountCents: null,
        paymentMethod: null,
        installments: null,
        paidAt: null,
        orderNsu: null,
      },
    };

    expect(view.identity.cpf).toBe("***.***.***-25");
    expect(JSON.stringify(view)).not.toContain("52998224725");
    expect(view.identity.photoUrl).toBeUndefined();
    expect(view.registration.voicePart).toBeNull();
    expect(view.payment.receiptUrl).toBeUndefined();
  });

  it("accepts only a strict UUID registration id for admin actions", () => {
    expect(
      participantRegistrationIdSchema.parse({
        registrationId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ registrationId: "11111111-1111-4111-8111-111111111111" });
    expect(() => participantRegistrationIdSchema.parse({ registrationId: "not-a-uuid" })).toThrow();
    expect(() =>
      participantRegistrationIdSchema.parse({
        registrationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow();
  });
});
