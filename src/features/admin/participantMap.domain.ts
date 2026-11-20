import type { AdminRegistrationRow } from "./admin.domain";
import { DIOCESE_SEATS } from "./cearaGeo";
import { voicePartOptions } from "@/features/registration/registration.domain";

export type ParticipantCount = { key: string; label: string; value: number };
export type GenderGroup = ParticipantCount & { names: string[] };

export type ParticipantChoirMap = {
  choirName: string;
  diocese: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  total: number;
  regentName: string | null;
  regentPhotoUrl: string | null;
  voices: ParticipantCount[];
  genders: ParticipantCount[];
};

export type ParticipantDioceseMap = {
  diocese: string;
  city: string;
  latitude: number;
  longitude: number;
  total: number;
  choirs: number;
};

export type ParticipantMapData = {
  generatedAt: string;
  total: number;
  genders: ParticipantCount[];
  genderGroups: GenderGroup[];
  inferredGenderCount: number;
  voices: ParticipantCount[];
  ageBands: ParticipantCount[];
  choirs: ParticipantChoirMap[];
  dioceses: ParticipantDioceseMap[];
  unlocated: number;
};

export const GENDER_LABELS: Readonly<Record<string, string>> = {
  masculino: "Masculino",
  feminino: "Feminino",
  nao_informado: "Não informado",
};

const AGE_BANDS = [
  { key: "ate-17", label: "Até 17 anos", max: 17 },
  { key: "18-25", label: "18 a 25 anos", max: 25 },
  { key: "26-35", label: "26 a 35 anos", max: 35 },
  { key: "36-45", label: "36 a 45 anos", max: 45 },
  { key: "46-59", label: "46 a 59 anos", max: 59 },
  { key: "60-mais", label: "60 anos ou mais", max: Number.POSITIVE_INFINITY },
] as const;

const CONFIRMED_STATUSES = new Set(["paid", "partially_paid", "exempt"]);

const VOICE_KEYS = voicePartOptions.map((option) => option.value);
const GENDER_KEYS = ["masculino", "feminino", "nao_informado"] as const;
const FEMALE_FIRST_NAMES = new Set(
  "ana alice amanda amelia amanda andrea antonia beatriz bianca camila carla carolina clara claudia cristina daniela debora edigleuma eliane eliana elisabete emilia ester fabiana fatima fernanda francisca gloria helena iracema iris isabel janaina josefa julia juliana lais larissa leticia lucia luciana luiza macrina margarida maria marilene marisa marlene matea neide neusa nelsiana paula paulina raquel rafaela regina rosa ruth socorro valeria vanessa veronica vitoria".split(" "),
);
const MALE_FIRST_NAMES = new Set(
  "alexandre antonio arthur augusto breno caio carlos cesar cicero clayton daniel davi diego domingos edmilson elias emmanuel emanuel euritonio felipe filipe fernando francisco gabriel henrique iury joao jorge jose luca lucas luiz manuel marcelo marcos mateus matheus miguel paulo pedro rafael raimundo ricardo samuel thiago tomas vinicius vitor victor yuri leonys".split(" "),
);
const NAME_PREFIXES = new Set(["d", "dom", "frei", "fre", "padre", "pe", "irma", "ir"]);

export function isConfirmedParticipant(row: AdminRegistrationRow): boolean {
  return !row.cancelledAt && CONFIRMED_STATUSES.has(row.financialState?.status ?? row.paymentStatus);
}

export function ageOn(birthDate: string, reference: Date): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let years = reference.getFullYear() - birth.getFullYear();
  const month = reference.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && reference.getDate() < birth.getDate())) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

function ageBandOf(birthDate: string, reference: Date): string {
  const age = ageOn(birthDate, reference);
  if (age === null) return "nao-informado";
  return AGE_BANDS.find((band) => age <= band.max)?.key ?? "60-mais";
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function orderedCounts(
  counts: Map<string, number>,
  keys: readonly string[],
  labels: Readonly<Record<string, string>>,
): ParticipantCount[] {
  const result = keys
    .map((key) => ({ key, label: labels[key] ?? key, value: counts.get(key) ?? 0 }))
    .filter((item) => item.value > 0);
  const known = new Set(keys);
  for (const [key, value] of counts) {
    if (!known.has(key) && value > 0) result.push({ key, label: labels[key] ?? key, value });
  }
  return result;
}

function seatOf(diocese: string | null) {
  return DIOCESE_SEATS.find((seat) => seat.diocese === diocese) ?? null;
}

function genderFor(row: AdminRegistrationRow): { key: string; inferred: boolean } {
  const declared = row.gender?.trim().toLocaleLowerCase("pt-BR");
  if (declared && declared in GENDER_LABELS && declared !== "nao_informado") {
    return { key: declared, inferred: false };
  }
  const nameParts = row.name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter((part) => part && !NAME_PREFIXES.has(part));
  const firstName = nameParts[0] ?? "";
  const knownName = nameParts.find((part) => FEMALE_FIRST_NAMES.has(part) || MALE_FIRST_NAMES.has(part));
  const key = FEMALE_FIRST_NAMES.has(firstName) || (knownName && FEMALE_FIRST_NAMES.has(knownName))
    ? "feminino"
    : MALE_FIRST_NAMES.has(firstName) || (knownName && MALE_FIRST_NAMES.has(knownName))
      ? "masculino"
      : firstName.endsWith("a")
        ? "feminino"
        : "masculino";
  return { key, inferred: true };
}

function countGenders(rows: AdminRegistrationRow[]): { counts: ParticipantCount[]; inferred: number } {
  const values = new Map<string, number>();
  const inferredValues = new Map<string, number>();
  for (const row of rows) {
    const gender = genderFor(row);
    values.set(gender.key, (values.get(gender.key) ?? 0) + 1);
    if (gender.inferred) {
      inferredValues.set(gender.key, (inferredValues.get(gender.key) ?? 0) + 1);
    }
  }
  const counts = GENDER_KEYS.flatMap((key) => {
    const value = values.get(key) ?? 0;
    return value > 0 ? [{ key, label: GENDER_LABELS[key], value }] : [];
  });
  const inferred = [...inferredValues.values()].reduce((sum, value) => sum + value, 0);
  return { counts, inferred };
}

/** Pure aggregation used by the administrative dashboard and by its PDF export. */
export function buildParticipantMapData(
  registrations: AdminRegistrationRow[],
  now: Date = new Date(),
): ParticipantMapData {
  const rows = registrations.filter(isConfirmedParticipant);
  const genderSummary = countGenders(rows);
  const genderNames = new Map<string, string[]>();
  for (const row of rows) {
    const gender = genderFor(row);
    const name = row.name.trim();
    const displayName = `${name}${gender.inferred ? " *" : ""}`;
    genderNames.set(gender.key, [...(genderNames.get(gender.key) ?? []), displayName].filter(Boolean));
  }
  const voiceCounts = countBy(rows.map((row) => row.voicePart ?? "nao_sei_informar"));
  const ageCounts = countBy(rows.map((row) => ageBandOf(row.birthDate, now)));

  const choirGroups = new Map<string, AdminRegistrationRow[]>();
  for (const row of rows) {
    const name = row.choirName?.trim();
    if (!name) continue;
    choirGroups.set(name, [...(choirGroups.get(name) ?? []), row]);
  }

  const choirs: ParticipantChoirMap[] = [...choirGroups.entries()]
    .map(([choirName, members]) => {
      const dioceseCounts = countBy(members.map((member) => member.diocese || "(não informada)"));
      const diocese = [...dioceseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const seat = seatOf(diocese);
      const genderSummary = countGenders(members);
      const regent =
        members.find(
          (member) =>
            member.musicalProfile === "regente" &&
            Boolean(member.photoUrl) &&
            Boolean(member.regentName || member.name),
        ) ?? members.find((member) => member.musicalProfile === "regente") ?? null;
      return {
        choirName,
        diocese,
        city: seat?.city ?? null,
        latitude: seat?.latitude ?? null,
        longitude: seat?.longitude ?? null,
        total: members.length,
        regentName: regent?.regentName || regent?.name || null,
        regentPhotoUrl: regent?.photoUrl ?? null,
        voices: orderedCounts(
          countBy(members.map((member) => member.voicePart ?? "nao_sei_informar")),
          VOICE_KEYS,
          Object.fromEntries(voicePartOptions.map((option) => [option.value, option.label])),
        ),
        genders: genderSummary.counts,
      };
    })
    .sort((left, right) => right.total - left.total || left.choirName.localeCompare(right.choirName, "pt-BR"));

  const dioceseGroups = new Map<string, { total: number; choirNames: Set<string> }>();
  for (const choir of choirs) {
    if (!choir.diocese) continue;
    const group = dioceseGroups.get(choir.diocese) ?? { total: 0, choirNames: new Set<string>() };
    group.total += choir.total;
    group.choirNames.add(choir.choirName);
    dioceseGroups.set(choir.diocese, group);
  }
  const dioceses: ParticipantDioceseMap[] = DIOCESE_SEATS.flatMap((seat) => {
    const group = dioceseGroups.get(seat.diocese);
    if (!group) return [];
    return [{
      diocese: seat.diocese,
      city: seat.city,
      latitude: seat.latitude,
      longitude: seat.longitude,
      total: group.total,
      choirs: group.choirNames.size,
    }];
  });

  return {
    generatedAt: now.toISOString(),
    total: rows.length,
    genders: genderSummary.counts,
    genderGroups: genderSummary.counts.map((item) => ({
      ...item,
      names: [...(genderNames.get(item.key) ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    })),
    inferredGenderCount: genderSummary.inferred,
    voices: orderedCounts(
      voiceCounts,
      VOICE_KEYS,
      Object.fromEntries(voicePartOptions.map((option) => [option.value, option.label])),
    ),
    ageBands: orderedCounts(
      ageCounts,
      [...AGE_BANDS.map((band) => band.key), "nao-informado"],
      {
        ...Object.fromEntries(AGE_BANDS.map((band) => [band.key, band.label])),
        "nao-informado": "Não informado",
      },
    ),
    choirs,
    dioceses,
    unlocated: rows.length - dioceses.reduce((sum, item) => sum + item.total, 0),
  };
}
