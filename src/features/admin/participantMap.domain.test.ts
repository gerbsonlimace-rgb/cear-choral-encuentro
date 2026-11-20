import { describe, expect, it } from "vitest";
import type { AdminRegistrationRow } from "./admin.domain";
import {
  ageOn,
  buildParticipantMapData,
  isConfirmedParticipant,
} from "./participantMap.domain";

const reference = new Date("2026-11-20T12:00:00Z");

function makeRow(overrides: Partial<AdminRegistrationRow> & { gender?: string } = {}): AdminRegistrationRow {
  return {
    id: `row-${Math.random()}`,
    createdAt: "2026-10-01T12:00:00Z",
    name: "Participante",
    badgeName: null,
    cpf: "123.456.789-00",
    gender: "nao_informado",
    birthDate: "1990-05-10",
    diocese: "Diocese de Quixadá",
    choirName: "Coro São José",
    choirId: null,
    otherChoirName: null,
    email: "teste@example.com",
    phone: "85999999999",
    city: "Quixadá",
    institution: null,
    role: "coralista",
    musicalProfile: "coralista",
    voicePart: "soprano",
    observations: null,
    includeShirt: false,
    shirtSize: null,
    shirtPriceCents: null,
    paymentStatus: "paid",
    amountCents: 10000,
    paidAmountCents: 10000,
    paymentMethod: null,
    installments: null,
    paidAt: null,
    pricingType: null,
    standardPriceCents: null,
    registrationPriceCents: null,
    photoUrl: null,
    regentName: "Maria Regente",
    financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 10000 },
    ...overrides,
  } as AdminRegistrationRow;
}

describe("participant map aggregation", () => {
  it("counts only confirmed, non-cancelled registrations", () => {
    const confirmed = makeRow({ id: "confirmed" });
    const pending = makeRow({ id: "pending", financialState: { status: "pending", pendingCents: 100, confirmedPrincipalCents: 0 } });
    const cancelled = makeRow({ id: "cancelled", cancelledAt: "2026-11-01T12:00:00Z" });
    expect(isConfirmedParticipant(confirmed)).toBe(true);
    expect(buildParticipantMapData([confirmed, pending, cancelled], reference).total).toBe(1);
  });

  it("groups genders, voices and age bands with stable labels", () => {
    const data = buildParticipantMapData([
      makeRow({ id: "a", gender: "masculino", voicePart: "tenor", birthDate: "2010-01-01" }),
      makeRow({ id: "b", gender: "feminino", voicePart: "soprano", birthDate: "1985-01-01" }),
      makeRow({ id: "c", gender: "feminino", voicePart: "soprano", birthDate: "" }),
      makeRow({ id: "d", voicePart: null, birthDate: "1950-01-01" }),
    ], reference);
    expect(data.genders).toEqual([
      { key: "masculino", label: "Masculino", value: 1 },
      { key: "feminino", label: "Feminino", value: 2 },
      { key: "nao_informado", label: "Não informado", value: 1 },
    ]);
    expect(data.genderGroups.find((item) => item.key === "feminino")?.names).toEqual(["Participante", "Participante"]);
    expect(data.voices.find((item) => item.key === "soprano")?.value).toBe(2);
    expect(data.ageBands.find((item) => item.key === "ate-17")?.value).toBe(1);
    expect(data.ageBands.find((item) => item.key === "36-45")?.value).toBe(1);
    expect(data.ageBands.find((item) => item.key === "60-mais")?.value).toBe(1);
    expect(data.ageBands.find((item) => item.key === "nao-informado")?.value).toBe(1);
  });

  it("uses the diocese seat as a map point and links the regent photo", () => {
    const data = buildParticipantMapData([
      makeRow({ id: "singer", choirName: "Coro São José", diocese: "Diocese de Quixadá" }),
      makeRow({ id: "regent", choirName: "Coro São José", diocese: "Diocese de Quixadá", musicalProfile: "regente", name: "Pe. Lucas", regentName: null, photoUrl: "https://example.com/regent.jpg" }),
      makeRow({ id: "other", choirName: "Coro da Catedral", diocese: "Arquidiocese de Fortaleza" }),
    ], reference);
    expect(data.choirs).toHaveLength(2);
    expect(data.choirs[0]).toMatchObject({ choirName: "Coro São José", total: 2, city: "Quixadá", regentName: "Pe. Lucas", regentPhotoUrl: "https://example.com/regent.jpg" });
    expect(data.dioceses.find((item) => item.diocese === "Diocese de Quixadá")).toMatchObject({ city: "Quixadá", total: 2, choirs: 1 });
    expect(data.dioceses.find((item) => item.diocese === "Arquidiocese de Fortaleza")).toMatchObject({ city: "Fortaleza", total: 1 });
    expect(data.unlocated).toBe(0);
  });

  it("computes ages from the reference date", () => {
    expect(ageOn("2000-11-21", reference)).toBe(25);
    expect(ageOn("2000-11-20", reference)).toBe(26);
    expect(ageOn("", reference)).toBeNull();
  });
});
