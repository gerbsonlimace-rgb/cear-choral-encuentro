import type { AdminRegistrationRow } from "./admin.domain";
import type { LodgingPlan } from "./admin-lodging.domain";

type SequenceRegistration = Pick<
  AdminRegistrationRow,
  "id" | "name" | "badgeName" | "choirName" | "cancelledAt"
>;

export type LodgingPersonSequenceEntry = {
  kind: "registration" | "extra";
  id: string;
  sequenceNumber: number;
  badgeName: string;
  name: string;
  choirName: string;
  roomKey: string | null;
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const genericChoirNames = new Set([
  "",
  "ACOMPANHANTE",
  "ACOMPANHANTES",
  "AVULSO",
  "AVULSOS",
  "AVULSOS E ACOMPANHANTES",
  "MOTORISTA",
  "MOTORISTAS",
  "SEM CORO",
]);

function choirKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
}

function isGenericChoirName(value: string) {
  const key = choirKey(value);
  return genericChoirNames.has(key) || /^(?:ACOMPANHANTES?|MOTORISTAS?)(?:\s|$)/.test(key);
}

export function buildLodgingPersonSequence(
  registrations: SequenceRegistration[],
  plan: Pick<LodgingPlan, "assignments" | "extraPeople">,
): LodgingPersonSequenceEntry[] {
  const choirsByRoom = new Map<string, Set<string>>();
  const rememberChoir = (roomKey: string | null | undefined, choirName: string) => {
    if (!roomKey || !choirName.trim() || isGenericChoirName(choirName)) return;
    const choirs = choirsByRoom.get(roomKey) ?? new Set<string>();
    choirs.add(choirName.trim());
    choirsByRoom.set(roomKey, choirs);
  };

  for (const row of registrations) {
    if (row.cancelledAt) continue;
    rememberChoir(plan.assignments[row.id], row.choirName);
  }
  for (const person of plan.extraPeople) {
    rememberChoir(person.roomKey, person.choir);
  }

  const choirFor = (choirName: string, roomKey: string | null) => {
    const explicitChoir = choirName.trim();
    if (isGenericChoirName(explicitChoir)) {
      const roomChoirs = roomKey ? choirsByRoom.get(roomKey) : undefined;
      if (roomChoirs?.size === 1) return [...roomChoirs][0] ?? "";
      return "";
    }
    return explicitChoir;
  };

  const registered = registrations
    .filter((row) => !row.cancelledAt)
    .map((row) => {
      const roomKey = plan.assignments[row.id] ?? null;
      return {
        kind: "registration" as const,
        id: row.id,
        sequenceNumber: 0,
        badgeName: row.badgeName?.trim() || row.name,
        name: row.name,
        choirName: choirFor(row.choirName, roomKey),
        roomKey,
      };
    });

  const extras = plan.extraPeople.map((person) => {
    const name = person.name || "Acompanhante";
    const roomKey = person.roomKey ?? null;
    return {
      kind: "extra" as const,
      id: person.id,
      sequenceNumber: 0,
      badgeName: name,
      name,
      choirName: choirFor(person.choir, roomKey),
      roomKey,
    };
  });

  return [...registered, ...extras]
    .sort(
      (left, right) =>
        collator.compare(left.choirName, right.choirName) ||
        collator.compare(left.badgeName, right.badgeName) ||
        collator.compare(left.name, right.name) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
    )
    .map((person, index) => ({ ...person, sequenceNumber: index + 1 }));
}
