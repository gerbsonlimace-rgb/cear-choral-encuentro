import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, LoaderCircle, Save } from "lucide-react";
import type { AdminAccessState, AdminHospedagemBootstrap } from "@/lib/admin.functions";
import {
  getAdminAccess,
  getAdminRegistrationPhotos,
  saveAdminLodgingPlan,
  uploadAdminLodgingPhoto,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { AdminNamedLodgingPage } from "./AdminNamedLodgingPage";
import {
  buildLodgingRoomLayout,
  emptyLodgingPlan,
  lodgingExtraRoomKey,
  type LodgingExtraPerson,
  type LodgingPlan,
} from "./admin-lodging.domain";

export type AdminHospedagemPageProps = {
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminHospedagemBootstrap>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (to: AdminNavigationPath) => void;
  /** Test seam that records the plan instead of writing it to the server. */
  persistPlan?: (plan: LodgingPlan) => Promise<void>;
  /** Test seam that stores the photo of a person added by hand. */
  storePhoto?: (input: { base64: string; mimeType: string }) => Promise<{ path: string }>;
};

type Gate = "checking" | "authorized" | "forbidden" | "error" | "leaving";

type ChoirRow = {
  name: string;
  men: string;
  women: string;
};

type LodgingRegistration = {
  cancelledAt?: string | null;
  id: string;
  name: string;
  badgeName: string | null;
  choirName: string;
  voicePart: string | null;
  registrationPriceCents: number | null;
};

type ExtraPerson = Omit<LodgingExtraPerson, "roomKey"> & {
  roomId: number | null;
  /** Signed URL shown on the screen. */
  photo: string | null;
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roomsNeeded(people: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.ceil(people / capacity);
}

function isMenVoice(voicePart: string | null) {
  return voicePart === "tenor" || voicePart === "baixo";
}

function isWomenVoice(voicePart: string | null) {
  return voicePart === "soprano" || voicePart === "contralto";
}

function choirNameOf(row: { choirName: string }) {
  return row.choirName || "Sem coro";
}

/**
 * Room layout of a roster: the numeric room ids every choir owns and the
 * stable keys the stored plan uses.
 */
function layoutFor(
  rows: LodgingRegistration[],
  excludedIds: Set<string>,
  capacity: number,
  extraRooms: Record<string, number[]>,
) {
  const choirNames = [...new Set(rows.map(choirNameOf))];
  const roomsByChoir: Record<string, number> = {};
  for (const choirName of choirNames) {
    const members = rows.filter((row) => choirNameOf(row) === choirName);
    const men = members.filter((row) => !excludedIds.has(row.id) && isMenVoice(row.voicePart)).length;
    const women = members.filter((row) => !excludedIds.has(row.id) && isWomenVoice(row.voicePart)).length;
    roomsByChoir[choirName] = roomsNeeded(men, capacity) + roomsNeeded(women, capacity);
  }
  return buildLodgingRoomLayout({ choirNames, roomsByChoir, extraRooms });
}

export function AdminHospedagemPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
  persistPlan,
  storePhoto,
}: AdminHospedagemPageProps) {
  const [gate, setGate] = useState<Gate>("checking");
  const [namedPlan, setNamedPlan] = useState<LodgingPlan | null>(null);
  const [roomsAvailable, setRoomsAvailable] = useState("0");
  const [roomCapacity, setRoomCapacity] = useState("3");
  const [totalRegistrants, setTotalRegistrants] = useState("");
  const [menCount, setMenCount] = useState("");
  const [womenCount, setWomenCount] = useState("");
  const [choirs, setChoirs] = useState<ChoirRow[]>([{ name: "", men: "", women: "" }]);
  const [registrations, setRegistrations] = useState<LodgingRegistration[]>([]);
  const [noLodgingIds, setNoLodgingIds] = useState<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [roomCount, setRoomCount] = useState(0);
  const [extraRoomIds, setExtraRoomIds] = useState<Record<string, number[]>>({});
  const [extraRoomCounter, setExtraRoomCounter] = useState(100000);
  const [extraPeople, setExtraPeople] = useState<ExtraPerson[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraCpf, setExtraCpf] = useState("");
  const [extraPaid, setExtraPaid] = useState("");
  const [extraRole, setExtraRole] = useState("acompanhante");
  const [extraSex, setExtraSex] = useState("feminino");
  const [extraBirthDate, setExtraBirthDate] = useState("");
  const [extraPhoto, setExtraPhoto] = useState<string | null>(null);
  const [extraChoir, setExtraChoir] = useState("");
  const [extraRoomId, setExtraRoomId] = useState("");
  const [hiddenRooms, setHiddenRooms] = useState<Set<number>>(new Set());
  const [expandedChoirs, setExpandedChoirs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const hymnSnippet = "Louvado seja o Senhor, que nos reúne em comunhão e alegria.";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);
  const hydrated = useRef(false);
  const lastSavedSignature = useRef<string | null>(null);

  const syncLodgingCounts = (
    rows: LodgingRegistration[],
    excludedIds: Set<string>,
    capacityOverride?: number,
  ) => {
    let men = 0;
    let women = 0;
    const groups = new Map<string, { men: number; women: number }>();
    for (const row of rows) {
      const choir = row.choirName || "Sem coro";
      const current = groups.get(choir) ?? { men: 0, women: 0 };
      if (excludedIds.has(row.id)) {
        groups.set(choir, current);
        continue;
      }
      if (isMenVoice(row.voicePart)) {
        current.men += 1;
        men += 1;
      } else if (isWomenVoice(row.voicePart)) {
        current.women += 1;
        women += 1;
      }
      groups.set(choir, current);
    }
    setMenCount(String(men));
    setWomenCount(String(women));
    setChoirs(
      [...groups.entries()].map(([name, counts]) => ({
        name,
        men: String(counts.men),
        women: String(counts.women),
      })),
    );
    if (groups.size === 0) setChoirs([{ name: "", men: "", women: "" }]);

    const capacityValue = capacityOverride ?? (toNumber(roomCapacity) || 3);
    const needed = [...groups.values()].reduce(
      (sum, counts) => sum + roomsNeeded(counts.men, capacityValue) + roomsNeeded(counts.women, capacityValue),
      0,
    );
    const totalNeededValue = needed || roomsNeeded(rows.filter((row) => !excludedIds.has(row.id)).length, capacityValue);
    setRoomCount(totalNeededValue);
  };

  const applyRegistrations = (
    rows: LodgingRegistration[],
    plan?: LodgingPlan | null,
    extraPhotoUrls: Record<string, string> = {},
  ) => {
    // A plan that was never configured leaves the R$ 80 registrations without
    // lodging; a stored plan is the administrator's own decision. A plan without
    // any allocation content is treated as the never-configured default.
    const stored = plan ?? emptyLodgingPlan();
    setNamedPlan(stored.namedRooms?.length ? stored : null);
    const hasStoredPlan =
      Boolean(plan) &&
      (stored.roomsAvailable > 0 ||
        Object.keys(stored.assignments).length > 0 ||
        stored.noLodgingIds.length > 0 ||
        Object.keys(stored.extraRooms).length > 0 ||
        stored.extraPeople.length > 0);
    const excludedIds = hasStoredPlan
      ? new Set(stored.noLodgingIds)
      : new Set(rows.filter((row) => row.registrationPriceCents === 8000).map((row) => row.id));
    const capacity = stored.roomCapacity || 3;
    const extraRooms = stored.extraRooms;
    setRegistrations(rows);
    setNoLodgingIds(excludedIds);
    setTotalRegistrants(String(rows.length));
    setRoomCapacity(String(capacity));
    setRoomsAvailable(String(stored.roomsAvailable));
    setExtraRoomIds(extraRooms);
    setExtraRoomCounter(stored.extraRoomCounter);
    syncLodgingCounts(rows, excludedIds, capacity);

    // The stored plan addresses rooms by a stable key, so the allocation
    // survives a new session even when the roster or the capacity changed.
    const layout = layoutFor(rows, excludedIds, capacity, extraRooms);
    const nextAssignments: Record<string, number | null> = {};
    for (const row of rows) {
      nextAssignments[row.id] = null;
    }
    for (const [registrationId, key] of Object.entries(stored.assignments)) {
      if (!(registrationId in nextAssignments)) continue;
      const roomId = layout.roomIdByKey.get(key);
      if (roomId !== undefined) nextAssignments[registrationId] = roomId;
    }
    setAssignments(nextAssignments);

    const hidden = new Set<number>();
    for (const key of stored.hiddenRoomKeys) {
      const roomId = layout.roomIdByKey.get(key);
      if (roomId !== undefined) hidden.add(roomId);
    }
    setHiddenRooms(hidden);

    const extra: ExtraPerson[] = stored.extraPeople.map((person) => ({
      ...person,
      roomId: person.roomKey ? (layout.roomIdByKey.get(person.roomKey) ?? null) : null,
      photo: person.photoPath ? (extraPhotoUrls[person.photoPath] ?? null) : null,
    }));
    setExtraPeople(extra);

    // The server rejects more than 100 ids per call, so sign in chunks and merge.
    const ids = [...new Set(rows.map((row) => row.id))];
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += 100) {
      chunks.push(ids.slice(index, index + 100));
    }
    void Promise.all(
      chunks.map((registrationIds) =>
        getAdminRegistrationPhotos({ data: { registrationIds } }).catch(
          () => ({}) as Record<string, string>,
        ),
      ),
    )
      .then((results) => {
        const merged: Record<string, string> = {};
        for (const urls of results) Object.assign(merged, urls);
        setPhotoUrls(merged);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (loadInitialData) {
      let active = true;
      setGate("checking");
      setError("");
      void loadInitialData()
        .then((bootstrap) => {
          if (!active) return;
          if (bootstrap.access.status !== "authorized" || !bootstrap.data) {
            setGate(bootstrap.access.status);
            return;
          }
          applyRegistrations(
            bootstrap.data.registrations as Array<{
              id: string;
              name: string;
              badgeName: string | null;
              choirName: string;
              voicePart: string | null;
              registrationPriceCents: number | null;
            }>,
            bootstrap.data.plan,
            bootstrap.data.extraPhotoUrls,
          );
          hydrated.current = true;
          setBootstrapDataReady(true);
          setGate("authorized");
        })
        .catch(async () => {
          if (!active) return;
          try {
            const session = await getSession();
            if (!active) return;
            if (!session.error && !session.data.session) {
              onMissingSession();
              return;
            }
          } catch {
            /* ignore */
          }
          setGate("error");
        });
      return () => {
        active = false;
      };
    }
    let active = true;
    void (async () => {
      try {
        const session = await getSession();
        if (!session.data.session) {
          if (active) onMissingSession();
          return;
        }
        const access = await checkAdmin();
        if (!active) return;
        setGate(access.status === "authorized" ? "authorized" : "forbidden");
      } catch {
        if (active) setGate("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [checkAdmin, getSession, loadInitialData, onMissingSession]);

  const logout = async () => {
    setGate("leaving");
    const result = await signOut();
    if (result.error) {
      setGate("authorized");
      setError("Não foi possível sair.");
      return;
    }
    onSignedOut();
  };

  const capacity = toNumber(roomCapacity);
  const available = toNumber(roomsAvailable);
  const totalMen = toNumber(menCount);
  const totalWomen = toNumber(womenCount);
  const derivedTotal = totalMen + totalWomen;
  const effectiveTotal = totalRegistrants.trim() === "" ? derivedTotal : toNumber(totalRegistrants);

  const choirRows = choirs.map((choir) => {
    const men = toNumber(choir.men);
    const women = toNumber(choir.women);
    return {
      ...choir,
      men,
      women,
      menRooms: roomsNeeded(men, capacity),
      womenRooms: roomsNeeded(women, capacity),
      totalRooms: roomsNeeded(men, capacity) + roomsNeeded(women, capacity),
    };
  });

  const totalNeededByGender = roomsNeeded(totalMen, capacity) + roomsNeeded(totalWomen, capacity);
  const totalNeededByChoir = choirRows.reduce((sum, row) => sum + row.totalRooms, 0);
  const totalNeeded = choirs.some((choir) => choir.name.trim() || choir.men || choir.women)
    ? totalNeededByChoir
    : totalNeededByGender;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      setMessage(
        totalNeeded <= available
          ? `Quartos suficientes: ${totalNeeded} necessários de ${available} disponíveis.`
          : `Faltam ${totalNeeded - available} quartos (${totalNeeded} necessários, ${available} disponíveis).`,
      );
    } catch {
      setError("Não foi possível calcular a hospedagem.");
    } finally {
      setSaving(false);
    }
  };

  /** Reads the current screen state as the plan stored on the server. */
  const buildPlan = useCallback((): LodgingPlan => {
    const roomLimit = toNumber(roomCapacity) || 3;
    const layout = layoutFor(registrations, noLodgingIds, roomLimit, extraRoomIds);
    const storedAssignments: Record<string, string> = {};
    for (const [registrationId, roomId] of Object.entries(assignments)) {
      if (roomId === null) continue;
      const key = layout.keyByRoomId.get(roomId);
      if (key) storedAssignments[registrationId] = key;
    }
    const hiddenRoomKeys: string[] = [];
    for (const roomId of hiddenRooms) {
      const key = layout.keyByRoomId.get(roomId);
      if (key) hiddenRoomKeys.push(key);
    }
    return {
      roomsAvailable: toNumber(roomsAvailable),
      roomCapacity: roomLimit,
      noLodgingIds: [...noLodgingIds],
      assignments: storedAssignments,
      extraRooms: extraRoomIds,
      hiddenRoomKeys,
      extraPeople: extraPeople.map((person) => ({
        id: person.id,
        name: person.name,
        cpf: person.cpf,
        paid: person.paid,
        role: person.role,
        sex: person.sex,
        birthDate: person.birthDate,
        photoPath: person.photoPath,
        choir: person.choir,
        roomKey: person.roomId === null ? null : (layout.keyByRoomId.get(person.roomId) ?? null),
      })),
      extraRoomCounter,
    };
  }, [
    assignments,
    extraPeople,
    extraRoomCounter,
    extraRoomIds,
    hiddenRooms,
    noLodgingIds,
    registrations,
    roomCapacity,
    roomsAvailable,
  ]);

  const planSignature = useMemo(() => JSON.stringify(buildPlan()), [buildPlan]);

  const persist = useCallback(async () => {
    const plan = buildPlan();
    const signature = JSON.stringify(plan);
    setSaveState("saving");
    try {
      if (persistPlan) await persistPlan(plan);
      else await saveAdminLodgingPlan({ data: plan });
      lastSavedSignature.current = signature;
      setDirty(false);
      setSaveState("saved");
      setError("");
    } catch (persistError) {
      setSaveState("error");
      setError(
        persistError instanceof Error && persistError.message
          ? persistError.message
          : "Não foi possível salvar a alocação de quartos.",
      );
    }
  }, [buildPlan, persistPlan]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  /** Adds a person who has no registration, storing her photo out of the row. */
  const addExtraPerson = async () => {
    if (!extraName.trim()) return;
    setSaving(true);
    setError("");
    try {
      let photoPath: string | null = null;
      if (extraPhoto) {
        const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(extraPhoto);
        if (match) {
          const mimeType = match[1] as "image/jpeg" | "image/png" | "image/webp";
          const stored = storePhoto
            ? await storePhoto({ base64: match[2], mimeType })
            : await uploadAdminLodgingPhoto({ data: { base64: match[2], mimeType } });
          photoPath = stored.path;
        }
      }
      const id = `extra-${Date.now()}`;
      setExtraPeople((previous) => [
        ...previous,
        {
          id,
          name: extraName.trim(),
          cpf: extraCpf.trim(),
          paid: extraPaid.trim(),
          role: extraRole,
          sex: extraSex,
          birthDate: extraBirthDate,
          photoPath,
          photo: extraPhoto,
          choir: extraChoir,
          roomId: extraRoomId ? Number(extraRoomId) : null,
        },
      ]);
      setExtraName("");
      setExtraCpf("");
      setExtraPaid("");
      setExtraPhoto(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : "Não foi possível adicionar a pessoa avulsa.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Every change of the allocation is stored shortly after it happens, so
  // leaving the screen never loses the rooms the administrator defined.
  useEffect(() => {
    if (namedPlan) return;
    if (!hydrated.current) return;
    if (lastSavedSignature.current === null) {
      lastSavedSignature.current = planSignature;
      return;
    }
    if (planSignature === lastSavedSignature.current) return;
    setDirty(true);
    const timer = setTimeout(() => {
      void persistRef.current();
    }, 1200);
    return () => clearTimeout(timer);
  }, [planSignature, namedPlan]);

  const addChoir = () => setChoirs((previous) => [...previous, { name: "", men: "", women: "" }]);
  const removeChoir = (index: number) =>
    setChoirs((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

  const resetRooms = () => {
    const nextAssignments: Record<string, number | null> = {};
    for (const row of registrations) {
      nextAssignments[row.id] = null;
    }
    setAssignments(nextAssignments);
    setExtraRoomIds({});
    setExtraRoomCounter(100000);
    setExtraPeople([]);
    setHiddenRooms(new Set());
    setNoLodgingIds(new Set(registrations.filter((row) => row.registrationPriceCents === 8000).map((row) => row.id)));
    setError("");
    setMessage("Todos desalocados. Quartos resetados.");
  };

  /**
   * Finds the first free room of the choir of a participant who is coming back
   * to lodging, so the drag and drop never leaves a person without a room.
   */
  const findAvailableLodgingRoom = (id: string): number | null => {
    const capacity = toNumber(roomCapacity) || 3;
    const choirName = registrations.find((row) => row.id === id)?.choirName || "Sem coro";
    const excludedIds = new Set(noLodgingIds);
    excludedIds.delete(id);
    const layout = layoutFor(registrations, excludedIds, capacity, extraRoomIds);
    const range = layout.choirs.get(choirName);
    if (!range) return null;
    const isTaken = (roomId: number) =>
      extraPeople.some((person) => person.roomId === roomId) ||
      registrations.some(
        (row) => row.id !== id && assignments[row.id] === roomId && !noLodgingIds.has(row.id),
      );
    for (let index = 0; index < range.rooms; index += 1) {
      const roomId = range.base + index;
      if (isTaken(roomId)) continue;
      return roomId;
    }
    for (const roomId of extraRoomIds[choirName] || []) {
      if (!isTaken(roomId)) return roomId;
    }
    return null;
  };

  const setNoLodgingForRegistration = (id: string, withoutLodging: boolean) => {
    const row = registrations.find((item) => item.id === id);
    if (!row) return;
    // Only people who paid for lodging may opt in; the R$ 80 ones stay without it.
    if (!withoutLodging && row.registrationPriceCents === 8000) return;

    const nextNoLodgingIds = new Set(noLodgingIds);
    if (withoutLodging) nextNoLodgingIds.add(id);
    else nextNoLodgingIds.delete(id);

    if (withoutLodging) {
      // Opting out releases the room so somebody else can take it.
      setAssignments((current) => ({ ...current, [id]: null }));
    } else {
      // Opting back in takes a room of the choir again.
      setAssignments((current) => ({ ...current, [id]: findAvailableLodgingRoom(id) }));
    }
    setNoLodgingIds(nextNoLodgingIds);
    syncLodgingCounts(registrations, nextNoLodgingIds);
  };

  const openPrintableHtml = (html: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const exportRoomMapPdf = () => {
    const names = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
    let offset = 0;
    const roomCards = names.map((choirName) => {
      const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
      const men = members.filter((row) => !noLodgingIds.has(row.id) && isMenVoice(row.voicePart)).length;
      const women = members.filter((row) => !noLodgingIds.has(row.id) && isWomenVoice(row.voicePart)).length;
      const cap = toNumber(roomCapacity) || 3;
      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
      const base = offset;
      offset += rooms + (extraRoomIds[choirName]?.length || 0);
      const roomsHtml = Array.from({ length: rooms }).map((_, roomIndex) => {
        const globalRoom = base + roomIndex;
        if (hiddenRooms.has(globalRoom)) return "";
        const occupants = registrations.filter((row) => assignments[row.id] === globalRoom);
        const extraOccupants = extraPeople.filter((person) => person.roomId === globalRoom);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(roomIndex + 1).padStart(2, "0")}`;
        const peopleHtml = [...occupants.map((row) => `
          <div class="person">
            ${photoUrls[row.id] ? `<img src="${photoUrls[row.id]}" alt="${row.name}" />` : `<div class="avatar">${row.name.slice(0, 2).toUpperCase()}</div>`}
            <span>${row.badgeName || row.name}</span>
          </div>
        `), ...extraOccupants.map((person) => `
          <div class="person">
            ${person.photo ? `<img src="${person.photo}" alt="${person.name}" />` : `<div class="avatar">${person.name.slice(0, 2).toUpperCase()}</div>`}
            <span>${person.name}</span>
          </div>
        `)].join("");
        return `<div class="room"><div class="room-title">${roomLabel}</div><div class="people">${peopleHtml}</div></div>`;
      }).join("");
      const extraHtml = (extraRoomIds[choirName] || []).map((roomId, index) => {
        const occupants = registrations.filter((row) => assignments[row.id] === roomId);
        const extraOccupants = extraPeople.filter((person) => person.roomId === roomId);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(rooms + index + 1).padStart(2, "0")}`;
        const peopleHtml = [...occupants.map((row) => `
          <div class="person">
            ${photoUrls[row.id] ? `<img src="${photoUrls[row.id]}" alt="${row.name}" />` : `<div class="avatar">${row.name.slice(0, 2).toUpperCase()}</div>`}
            <span>${row.badgeName || row.name}</span>
          </div>
        `), ...extraOccupants.map((person) => `
          <div class="person">
            ${person.photo ? `<img src="${person.photo}" alt="${person.name}" />` : `<div class="avatar">${person.name.slice(0, 2).toUpperCase()}</div>`}
            <span>${person.name}</span>
          </div>
        `)].join("");
        return `<div class="room"><div class="room-title">${roomLabel}</div><div class="people">${peopleHtml}</div></div>`;
      }).join("");
      return `<section class="choir"><h2>${choirName}</h2><div class="rooms">${roomsHtml}${extraHtml}</div></section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mapa de quartos</title><style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      .choir { margin-bottom: 32px; }
      .choir h2 { margin-bottom: 12px; font-size: 20px; }
      .rooms { display: flex; flex-wrap: wrap; gap: 16px; }
      .room { border: 1px solid #ccc; border-radius: 14px; padding: 14px; min-width: 240px; }
      .room-title { font-weight: bold; margin-bottom: 12px; font-size: 15px; }
      .people { display: flex; flex-wrap: wrap; gap: 14px; }
      .person { width: 96px; text-align: center; font-size: 12px; }
      .person img, .avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin: 0 auto 6px; display: block; background: #eee; line-height: 64px; }
    </style></head><body><h1>Mapa de quartos</h1>${roomCards}</body></html>`;
    openPrintableHtml(html);
  };
    const exportPlaquesPdf = () => {
    const plaques: Array<{ roomLabel: string; name: string; photo: string | null }> = [];
    const names = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
    let offset = 0;
    for (const choirName of names) {
      const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
      const men = members.filter((row) => !noLodgingIds.has(row.id) && isMenVoice(row.voicePart)).length;
      const women = members.filter((row) => !noLodgingIds.has(row.id) && isWomenVoice(row.voicePart)).length;
      const cap = toNumber(roomCapacity) || 3;
      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
      const base = offset;
      offset += rooms + (extraRoomIds[choirName]?.length || 0);
      for (let roomIndex = 0; roomIndex < rooms; roomIndex++) {
        const globalRoom = base + roomIndex;
        if (hiddenRooms.has(globalRoom)) continue;
        const occupants = registrations.filter((row) => assignments[row.id] === globalRoom);
        const extraOccupants = extraPeople.filter((person) => person.roomId === globalRoom);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(roomIndex + 1).padStart(2, "0")}`;
        for (const row of occupants) plaques.push({ roomLabel, name: row.badgeName || row.name, photo: photoUrls[row.id] || null });
        for (const person of extraOccupants) plaques.push({ roomLabel, name: person.name, photo: person.photo ?? null });
      }
      for (const [index, roomId] of (extraRoomIds[choirName] || []).entries()) {
        const occupants = registrations.filter((row) => assignments[row.id] === roomId);
        const extraOccupants = extraPeople.filter((person) => person.roomId === roomId);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(rooms + index + 1).padStart(2, "0")}`;
        for (const row of occupants) plaques.push({ roomLabel, name: row.badgeName || row.name, photo: photoUrls[row.id] || null });
        for (const person of extraOccupants) plaques.push({ roomLabel, name: person.name, photo: person.photo ?? null });
      }
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Plaquinas</title><style>
      body { font-family: Arial, sans-serif; margin: 0; }
      .plaque { page-break-after: always; padding: 60px; text-align: center; }
      .room { font-size: 40px; font-weight: bold; margin-bottom: 28px; }
      .photo { width: 180px; height: 180px; border-radius: 50%; object-fit: cover; margin: 0 auto 28px; display: block; background: #eee; }
      .name { font-size: 32px; margin-bottom: 24px; }
      .hymn { font-size: 15px; color: #555; }
    </style></head><body>
      ${plaques.map((plaque) => `
        <div class="plaque">
          <div class="room">${plaque.roomLabel}</div>
          ${plaque.photo ? `<img class="photo" src="${plaque.photo}" alt="${plaque.name}" />` : `<div class="photo"></div>`}
          <div class="name">${plaque.name}</div>
          <div class="hymn">${hymnSnippet}</div>
        </div>
      `).join("")}
    </body></html>`;
    openPrintableHtml(html);
  };

  if (gate === "authorized" && namedPlan) {
    return <AdminNamedLodgingPage
      registrations={registrations}
      initialPlan={namedPlan}
      photoUrls={photoUrls}
      persistPlan={persistPlan ?? (async (plan) => { await saveAdminLodgingPlan({ data: plan }); })}
      onSignOut={() => void logout()}
      navigateTo={navigateTo}
    />;
  }

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="w-full space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-xl sm:text-2xl">Hospedagem</h1>
          </div>
          {gate === "authorized" && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs ${
                  saveState === "error" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {saveState === "saving"
                  ? "Salvando a alocação…"
                  : saveState === "error"
                    ? "Não foi possível salvar a alocação."
                    : dirty
                      ? "Alterações de quarto ainda não salvas."
                      : "Alocação de quartos salva."}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={saveState === "saving"}
                onClick={() => void persist()}
              >
                {saveState === "saving" ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Save aria-hidden="true" className="size-4" />
                )}
                Salvar alocação
              </Button>
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                Sair
              </Button>
            </div>
          )}
        </header>
        {gate === "authorized" && <AdminNavigation current="hospedagem" navigateTo={navigateTo} />}
        <div aria-live="polite" className="text-sm text-muted-foreground">{message}</div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {gate === "checking" && <Skeleton className="h-40 w-full" />}
        {gate === "forbidden" && <p role="alert">Acesso não autorizado.</p>}
        {gate === "error" && <p role="alert">Não foi possível verificar seu acesso.</p>}
        {gate === "authorized" && (
          <form onSubmit={onSubmit} className="space-y-5">
            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-xl">Capacidade e disponibilidade</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="rooms-available">Quartos disponíveis</Label>
                    <Input
                      id="rooms-available"
                      inputMode="numeric"
                      value={roomsAvailable}
                      onChange={(event) => setRoomsAvailable(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-capacity">Capacidade por quarto</Label>
                    <Input
                      id="room-capacity"
                      inputMode="numeric"
                      value={roomCapacity}
                      onChange={(event) => setRoomCapacity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total-registrants">Total de inscritos</Label>
                    <Input
                      id="total-registrants"
                      inputMode="numeric"
                      placeholder={String(derivedTotal)}
                      value={totalRegistrants}
                      onChange={(event) => setTotalRegistrants(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="men-count">Homens</Label>
                    <Input
                      id="men-count"
                      inputMode="numeric"
                      value={menCount}
                      onChange={(event) => setMenCount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="women-count">Mulheres</Label>
                    <Input
                      id="women-count"
                      inputMode="numeric"
                      value={womenCount}
                      onChange={(event) => setWomenCount(event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-xl">Por coro</h2>
                <div className="grid gap-4">
                  {(() => {
                    const names = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
                    let offset = 0;
                    return names.map((choirName) => {
                      const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
                      const men = members.filter((row) => !noLodgingIds.has(row.id) && isMenVoice(row.voicePart)).length;
                      const women = members.filter((row) => !noLodgingIds.has(row.id) && isWomenVoice(row.voicePart)).length;
                      const cap = toNumber(roomCapacity) || 3;
                      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
                      const extra = (extraRoomIds[choirName] || []).length;
                      const base = offset;
                      offset += rooms + extra;
                      return (
                        <div key={choirName} className="rounded-xl border p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedChoirs((previous) => {
                                  const next = new Set(previous);
                                  if (next.has(choirName)) next.delete(choirName);
                                  else next.add(choirName);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-2 text-left"
                            >
                              {expandedChoirs.has(choirName) ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              <div>
                                <p className="font-semibold">{choirName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Total: {members.length} · Homens: {men} · Mulheres: {women} · Quartos: {rooms + (extraRoomIds[choirName]?.length || 0)}
                                </p>
                              </div>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                const newId = extraRoomCounter;
                                setExtraRoomCounter((value) => value + 1);
                                setExtraRoomIds((previous) => ({
                                  ...previous,
                                  [choirName]: [...(previous[choirName] || []), newId],
                                }));
                              }}
                            >
                              + Quarto
                            </Button>
                          </div>
                          {expandedChoirs.has(choirName) && (
                          <div className="grid gap-4 md:grid-cols-[minmax(300px,1fr)_2fr]">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold">Não alocados</p>
                              <div
                                role="region"
                                aria-label="Inscritos não alocados"
                                className="grid gap-2 grid-cols-4 min-h-24 rounded-xl border bg-muted/10 p-3"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const id = event.dataTransfer.getData("text/plain");
                                  if (!id) return;
                                  if (id.startsWith("extra-")) {
                                    setExtraPeople((previous) =>
                                      previous.map((person) =>
                                        person.id === id ? { ...person, roomId: null } : person,
                                      ),
                                    );
                                  } else {
                                    setNoLodgingForRegistration(id, false);
                                  }
                                }}
                              >
                                {registrations
                                  .filter((row) => (row.choirName || "Sem coro") === choirName && assignments[row.id] === null && !noLodgingIds.has(row.id))
                                  .map((row) => (
                                    <div
                                      key={row.id}
                                      draggable
                                      onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                      className="flex flex-col items-center gap-1 cursor-move"
                                    >
                                      {photoUrls[row.id] ? (
                                        <img src={photoUrls[row.id]} alt={row.name} className="h-10 w-10 rounded-full object-cover" />
                                      ) : (
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                          {row.name.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-[0.6rem] text-muted-foreground w-full text-center leading-tight break-words">
                                        {row.badgeName || row.name}
                                      </span>
                                    </div>
                                  ))}
                                {extraPeople
                                  .filter((person) => person.choir === choirName && person.roomId === null)
                                  .map((person) => (
                                    <div
                                      key={person.id}
                                      draggable
                                      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                                      className="flex flex-col items-center gap-1 cursor-move"
                                    >
                                      {person.photo ? (
                                        <img src={person.photo} alt={person.name} className="h-10 w-10 rounded-full object-cover" />
                                      ) : (
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                          {person.name.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-[0.6rem] text-muted-foreground w-full text-center leading-tight break-words">
                                        {person.name} ({person.role})
                                      </span>
                                    </div>
                                  ))}
                              </div>
                              <div className="space-y-2 mt-3">
                                <p className="text-sm font-semibold">Inscrição sem hospedagem</p>
                                <p className="text-xs text-muted-foreground">Arraste aqui quem vai se hospedar por conta própria.</p>
                                <div
                                  role="region"
                                  aria-label="Inscrições sem hospedagem"
                                  className="flex flex-wrap gap-3 min-h-12 rounded-xl border bg-muted/10 p-3"
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    const id = event.dataTransfer.getData("text/plain");
                                    const row = registrations.find((item) => item.id === id);
                                    if ((row?.choirName || "Sem coro") !== choirName) return;
                                    setNoLodgingForRegistration(id, true);
                                  }}
                                >
                                  {registrations
                                    .filter((row) => (row.choirName || "Sem coro") === choirName && noLodgingIds.has(row.id))
                                    .map((row) => (
                                      <div
                                        key={row.id}
                                        draggable={row.registrationPriceCents !== 8000}
                                        onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                        className="flex flex-col items-center gap-1"
                                      >
                                        {photoUrls[row.id] ? (
                                          <img src={photoUrls[row.id]} alt={row.name} className="h-10 w-10 rounded-full object-cover" />
                                        ) : (
                                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                            {row.name.slice(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                        <span className="text-[0.6rem] text-muted-foreground w-full text-center leading-tight break-words">
                                          {row.badgeName || row.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setNoLodgingForRegistration(row.id, !noLodgingIds.has(row.id))}
                                          className="text-[0.6rem] text-muted-foreground hover:text-primary"
                                        >
                                          {noLodgingIds.has(row.id) ? "Com hosp." : "Sem hosp."}
                                        </button>
                                      </div>
                                    ))}
                                  {registrations.filter((row) => (row.choirName || "Sem coro") === choirName && noLodgingIds.has(row.id)).length === 0 && (
                                    <p className="text-xs text-muted-foreground">Nenhum</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <p className="text-sm font-semibold">Quartos</p>
                              <div className="grid gap-3 sm:grid-cols-2">
                              {Array.from({ length: rooms }).map((_, roomIndex) => {
                                const globalRoom = base + roomIndex;
                                if (hiddenRooms.has(globalRoom)) return null;
                                const occupants = registrations.filter((row) => assignments[row.id] === globalRoom);
                                const extraOccupants = extraPeople.filter((person) => person.roomId === globalRoom);
                                return (
                                  <div
                                    key={globalRoom}
                                    className="rounded-xl border bg-muted/20 p-3 min-h-36"
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const id = event.dataTransfer.getData("text/plain");
                                      if (!id) return;
                                      if (id.startsWith("extra-")) {
                                        setExtraPeople((previous) =>
                                          previous.map((person) =>
                                            person.id === id ? { ...person, roomId: globalRoom } : person,
                                          ),
                                        );
                                      } else {
                                        setNoLodgingForRegistration(id, false);
                                        setAssignments((previous) => ({ ...previous, [id]: globalRoom }));
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-sm font-semibold">
                                        {choirName.trim().split(/\s+/).pop()?.toUpperCase()}-{String(roomIndex + 1).padStart(2, "0")} ({occupants.length + extraOccupants.length}/{cap})
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHiddenRooms((previous) => new Set(previous).add(globalRoom));
                                          setAssignments((previous) => {
                                            const next = { ...previous };
                                            for (const key of Object.keys(next)) {
                                              if (next[key] === globalRoom) next[key] = null;
                                            }
                                            return next;
                                          });
                                          setExtraPeople((previous) =>
                                            previous.map((person) =>
                                              person.roomId === globalRoom ? { ...person, roomId: null } : person,
                                            ),
                                          );
                                        }}
                                        className="text-xs text-muted-foreground hover:text-destructive"
                                        aria-label="Excluir quarto"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                      {occupants.map((row) => (
                                        <div
                                          key={row.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                          className="flex flex-col items-center gap-2 cursor-move"
                                        >
                                          {photoUrls[row.id] ? (
                                            <img
                                              src={photoUrls[row.id]}
                                              alt={row.name}
                                              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                              {row.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-xs text-muted-foreground w-20 sm:w-24 text-center leading-tight break-words">
                                            {row.badgeName || row.name}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setNoLodgingForRegistration(row.id, !noLodgingIds.has(row.id))}
                                            className="text-[0.6rem] text-muted-foreground hover:text-primary"
                                          >
                                            {noLodgingIds.has(row.id) ? "Com hosp." : "Sem hosp."}
                                          </button>
                                        </div>
                                      ))}
                                      {extraOccupants.map((person) => (
                                        <div
                                          key={person.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                                          className="flex flex-col items-center gap-2 cursor-move"
                                        >
                                          {person.photo ? (
                                            <img src={person.photo} alt={person.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover" />
                                          ) : (
                                            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                              {person.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-xs text-muted-foreground w-20 sm:w-24 text-center leading-tight break-words">
                                            {person.name} ({person.role})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {(extraRoomIds[choirName] || []).map((roomId, index) => {
                                const occupants = registrations.filter((row) => assignments[row.id] === roomId);
                                const extraOccupants = extraPeople.filter((person) => person.roomId === roomId);
                                return (
                                  <div
                                    key={roomId}
                                    className="rounded-xl border bg-muted/20 p-3 min-h-36"
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const id = event.dataTransfer.getData("text/plain");
                                      if (!id) return;
                                      if (id.startsWith("extra-")) {
                                        setExtraPeople((previous) =>
                                          previous.map((person) =>
                                            person.id === id ? { ...person, roomId } : person,
                                          ),
                                        );
                                      } else {
                                        setNoLodgingForRegistration(id, false);
                                        setAssignments((previous) => ({ ...previous, [id]: roomId }));
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-sm font-semibold">
                                        {choirName.trim().split(/\s+/).pop()?.toUpperCase()}-{String(rooms + index + 1).padStart(2, "0")} ({occupants.length + extraOccupants.length})
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExtraRoomIds((previous) => ({
                                            ...previous,
                                            [choirName]: (previous[choirName] || []).filter((id) => id !== roomId),
                                          }));
                                          setAssignments((previous) => {
                                            const next = { ...previous };
                                            for (const key of Object.keys(next)) {
                                              if (next[key] === roomId) next[key] = null;
                                            }
                                            return next;
                                          });
                                          setExtraPeople((previous) =>
                                            previous.map((person) =>
                                              person.roomId === roomId ? { ...person, roomId: null } : person,
                                            ),
                                          );
                                        }}
                                        className="text-xs text-muted-foreground hover:text-destructive"
                                        aria-label="Excluir quarto"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                      {occupants.map((row) => (
                                        <div
                                          key={row.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                          className="flex flex-col items-center gap-2 cursor-move"
                                        >
                                          {photoUrls[row.id] ? (
                                            <img
                                              src={photoUrls[row.id]}
                                              alt={row.name}
                                              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                              {row.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-xs text-muted-foreground w-20 sm:w-24 text-center leading-tight break-words">
                                            {row.badgeName || row.name}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setNoLodgingForRegistration(row.id, !noLodgingIds.has(row.id))}
                                            className="text-[0.6rem] text-muted-foreground hover:text-primary"
                                          >
                                            {noLodgingIds.has(row.id) ? "Com hosp." : "Sem hosp."}
                                          </button>
                                        </div>
                                      ))}
                                      {extraOccupants.map((person) => (
                                        <div
                                          key={person.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                                          className="flex flex-col items-center gap-2 cursor-move"
                                        >
                                          {person.photo ? (
                                            <img src={person.photo} alt={person.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover" />
                                          ) : (
                                            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                              {person.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-xs text-muted-foreground w-20 sm:w-24 text-center leading-tight break-words">
                                            {person.name} ({person.role})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-xl">Exportações</h2>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => void resetRooms()}>
                    Resetar quartos
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void exportRoomMapPdf()}>
                    Exportar mapa de quartos (PDF)
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void exportPlaquesPdf()}>
                    Exportar plaquinas (PDF)
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-xl">Pessoas avulsas</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="extra-name">Nome</Label>
                    <Input id="extra-name" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-cpf">CPF</Label>
                    <Input id="extra-cpf" value={extraCpf} onChange={(e) => setExtraCpf(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-paid">Valor pago</Label>
                    <Input id="extra-paid" value={extraPaid} onChange={(e) => setExtraPaid(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-role">Função</Label>
                    <select
                      id="extra-role"
                      value={extraRole}
                      onChange={(e) => setExtraRole(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="acompanhante">Acompanhante</option>
                      <option value="motorista">Motorista</option>
                      <option value="apoio">Apoio</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-sex">Sexo</Label>
                    <select
                      id="extra-sex"
                      value={extraSex}
                      onChange={(e) => setExtraSex(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="feminino">Feminino</option>
                      <option value="masculino">Masculino</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-birth">Data de nascimento</Label>
                    <Input id="extra-birth" type="date" value={extraBirthDate} onChange={(e) => setExtraBirthDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-photo">Foto</Label>
                    <Input
                      id="extra-photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setExtraPhoto(typeof reader.result === "string" ? reader.result : null);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-choir">Coro</Label>
                    <select
                      id="extra-choir"
                      value={extraChoir}
                      onChange={(e) => setExtraChoir(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      {[...new Set(registrations.map((row) => row.choirName || "Sem coro"))].map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-room">Quarto (opcional)</Label>
                    <select
                      id="extra-room"
                      value={extraRoomId}
                      onChange={(e) => setExtraRoomId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Não alocado</option>
                      {[...new Set(registrations.map((row) => row.choirName || "Sem coro"))].flatMap((choirName) => {
                        const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
                        const men = members.filter((row) => !noLodgingIds.has(row.id) && isMenVoice(row.voicePart)).length;
                        const women = members.filter((row) => !noLodgingIds.has(row.id) && isWomenVoice(row.voicePart)).length;
                        const cap = toNumber(roomCapacity) || 3;
                        const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
                        const extraOpts = (extraRoomIds[choirName] || []).map((id, ri) => ({
                          id,
                          label: `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(rooms + ri + 1).padStart(2, "0")}`,
                        }));
                        // Only the rooms created by the administrator can be picked for the
                        // people added by hand; the rooms derived from the roster are already
                        // covered by the capacity math.
                        return extraOpts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {choirName} - {o.label}
                          </option>
                        ));
                      })}
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    void addExtraPerson();
                  }}
                >
                  Adicionar pessoa avulsa
                </Button>
                <div className="flex flex-wrap gap-3">
                  {extraPeople.map((person) => (
                    <div
                      key={person.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                      className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3 cursor-move"
                    >
                      {person.photo ? (
                        <img src={person.photo} alt={person.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover" />
                      ) : (
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground w-20 sm:w-24 text-center leading-tight break-words">{person.name}</span>
                      <span className="text-[0.55rem] text-muted-foreground">{person.cpf}</span>
                      <span className="text-[0.55rem] text-muted-foreground">R$ {person.paid || "0"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </main>
  );
}

export const AdminAccommodationPage = AdminHospedagemPage;
