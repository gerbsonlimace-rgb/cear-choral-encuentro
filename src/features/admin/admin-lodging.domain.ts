/**
 * Lodging plan shared by the administration lodging screen.
 *
 * The plan is stored as one server-side row so the whole allocation can be
 * replaced atomically. Rooms are addressed by a stable key
 * (`<choir>::<index>` for the rooms derived from the head count and
 * `<choir>::extra::<id>` for the manually added rooms) instead of the numeric
 * room id, so changing the capacity or the roster never moves a participant
 * to another room.
 */

/** Extra rooms created by the administrator use ids from this range. */
export const LODGING_EXTRA_ROOM_BASE = 100000;

export type LodgingExtraPerson = {
  id: string;
  name: string;
  cpf: string;
  paid: string;
  role: string;
  sex: string;
  birthDate: string;
  /** Storage path of the uploaded photo, when the person has one. */
  photoPath: string | null;
  choir: string;
  /** Stable room key, or null while the person is not allocated. */
  roomKey: string | null;
};

export type LodgingPlan = {
  roomsAvailable: number;
  roomCapacity: number;
  noLodgingIds: string[];
  /** Registration id -> stable room key. */
  assignments: Record<string, string>;
  /** Choir name -> ids of the manually added rooms. */
  extraRooms: Record<string, number[]>;
  /** Stable room keys of the rooms the administrator deleted. */
  hiddenRoomKeys: string[];
  extraPeople: LodgingExtraPerson[];
  extraRoomCounter: number;
};

export type LodgingRoomLayout = {
  /** Choir name -> the range of numeric room ids it owns. */
  choirs: Map<string, { base: number; rooms: number }>;
  /** Numeric room id -> stable room key. */
  keyByRoomId: Map<number, string>;
  /** Stable room key -> numeric room id. */
  roomIdByKey: Map<string, number>;
};

export function emptyLodgingPlan(): LodgingPlan {
  return {
    roomsAvailable: 0,
    roomCapacity: 3,
    noLodgingIds: [],
    assignments: {},
    extraRooms: {},
    hiddenRoomKeys: [],
    extraPeople: [],
    extraRoomCounter: LODGING_EXTRA_ROOM_BASE,
  };
}

export function lodgingRoomKey(choirName: string, index: number): string {
  return `${choirName}::${index}`;
}

export function lodgingExtraRoomKey(choirName: string, roomId: number): string {
  return `${choirName}::extra::${roomId}`;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

function asExtraRooms(value: unknown): Record<string, number[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number[]> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(item)) continue;
    result[key] = item
      .map((roomId) => asFiniteNumber(roomId, Number.NaN))
      .filter((roomId) => Number.isInteger(roomId) && roomId >= LODGING_EXTRA_ROOM_BASE);
  }
  return result;
}

function asExtraPeople(value: unknown): LodgingExtraPerson[] {
  if (!Array.isArray(value)) return [];
  const people: LodgingExtraPerson[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id) continue;
    people.push({
      id: row.id,
      name: typeof row.name === "string" ? row.name : "",
      cpf: typeof row.cpf === "string" ? row.cpf : "",
      paid: typeof row.paid === "string" ? row.paid : "",
      role: typeof row.role === "string" ? row.role : "acompanhante",
      sex: typeof row.sex === "string" ? row.sex : "feminino",
      birthDate: typeof row.birthDate === "string" ? row.birthDate : "",
      photoPath: typeof row.photoPath === "string" && row.photoPath ? row.photoPath : null,
      choir: typeof row.choir === "string" ? row.choir : "",
      roomKey: typeof row.roomKey === "string" && row.roomKey ? row.roomKey : null,
    });
  }
  return people;
}

/** Reads a stored plan defensively: a broken row must never break the screen. */
export function parseLodgingPlan(row: unknown): LodgingPlan {
  if (!row || typeof row !== "object") return emptyLodgingPlan();
  const source = row as Record<string, unknown>;
  const plan = emptyLodgingPlan();
  const capacity = asFiniteNumber(source.room_capacity, plan.roomCapacity);
  plan.roomsAvailable = Math.max(0, Math.trunc(asFiniteNumber(source.rooms_available, 0)));
  plan.roomCapacity = capacity > 0 ? Math.trunc(capacity) : plan.roomCapacity;
  plan.noLodgingIds = asStringList(source.no_lodging_registration_ids);
  plan.assignments = asStringRecord(source.assignments);
  plan.extraRooms = asExtraRooms(source.extra_rooms);
  plan.hiddenRoomKeys = asStringList(source.hidden_rooms);
  plan.extraPeople = asExtraPeople(source.extra_people);
  const counter = asFiniteNumber(source.extra_room_counter, plan.extraRoomCounter);
  plan.extraRoomCounter = Math.max(
    LODGING_EXTRA_ROOM_BASE,
    Math.trunc(counter),
  );
  return plan;
}

/**
 * Builds the numeric room layout of the current roster and maps it to the
 * stable room keys used by the stored plan.
 */
export function buildLodgingRoomLayout(input: {
  choirNames: string[];
  roomsByChoir: Record<string, number>;
  extraRooms: Record<string, number[]>;
}): LodgingRoomLayout {
  const choirs = new Map<string, { base: number; rooms: number }>();
  const keyByRoomId = new Map<number, string>();
  const roomIdByKey = new Map<string, number>();
  let offset = 0;
  for (const choirName of input.choirNames) {
    const rooms = Math.max(0, Math.trunc(input.roomsByChoir[choirName] ?? 0));
    const extra = input.extraRooms[choirName] ?? [];
    choirs.set(choirName, { base: offset, rooms });
    for (let index = 0; index < rooms; index += 1) {
      const roomId = offset + index;
      const key = lodgingRoomKey(choirName, index);
      keyByRoomId.set(roomId, key);
      roomIdByKey.set(key, roomId);
    }
    // The manually added rooms also advance the offset of the next choir, so
    // the layout stays identical to the one the screen renders.
    offset += rooms + extra.length;
    for (const roomId of extra) {
      const key = lodgingExtraRoomKey(choirName, roomId);
      keyByRoomId.set(roomId, key);
      roomIdByKey.set(key, roomId);
    }
  }
  return { choirs, keyByRoomId, roomIdByKey };
}
