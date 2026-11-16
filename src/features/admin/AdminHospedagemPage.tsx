import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAccessState, AdminHospedagemBootstrap } from "@/lib/admin.functions";
import { getAdminAccess, getAdminRegistrationPhotos } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

export type AdminHospedagemPageProps = {
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminHospedagemBootstrap>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

type Gate = "checking" | "authorized" | "forbidden" | "error" | "leaving";

type ChoirRow = {
  name: string;
  men: string;
  women: string;
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

export function AdminHospedagemPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: AdminHospedagemPageProps) {
  const [gate, setGate] = useState<Gate>("checking");
  const [roomsAvailable, setRoomsAvailable] = useState("0");
  const [roomCapacity, setRoomCapacity] = useState("3");
  const [totalRegistrants, setTotalRegistrants] = useState("");
  const [menCount, setMenCount] = useState("");
  const [womenCount, setWomenCount] = useState("");
  const [choirs, setChoirs] = useState<ChoirRow[]>([{ name: "", men: "", women: "" }]);
  const [registrations, setRegistrations] = useState<Array<{ id: string; name: string; badgeName: string | null; choirName: string; voicePart: string | null }>>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [roomCount, setRoomCount] = useState(0);
  const [extraRoomIds, setExtraRoomIds] = useState<Record<string, number[]>>({});
  const [extraRoomCounter, setExtraRoomCounter] = useState(100000);
  const [extraPeople, setExtraPeople] = useState<Array<{ id: string; name: string; cpf: string; paid: string; role: string; sex: string; birthDate: string; photo: string | null; roomId: number | null }>>([]);
  const [extraName, setExtraName] = useState("");
  const [extraCpf, setExtraCpf] = useState("");
  const [extraPaid, setExtraPaid] = useState("");
  const [extraRole, setExtraRole] = useState("acompanhante");
  const [extraSex, setExtraSex] = useState("feminino");
  const [extraBirthDate, setExtraBirthDate] = useState("");
  const [extraPhoto, setExtraPhoto] = useState<string | null>(null);
  const [extraChoir, setExtraChoir] = useState("");
  const [extraRoomId, setExtraRoomId] = useState("");
  const [saving, setSaving] = useState(false);
  const hymnSnippet = "Louvado seja o Senhor, que nos reúne em comunhão e alegria.";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);

  const isMenVoice = (voicePart: string | null) =>
    voicePart === "tenor" || voicePart === "baixo";
  const isWomenVoice = (voicePart: string | null) =>
    voicePart === "soprano" || voicePart === "contralto";

  const applyRegistrations = (
    rows: Array<{ id: string; name: string; badgeName: string | null; choirName: string; voicePart: string | null }>,
  ) => {
    setRegistrations(rows);
    setTotalRegistrants(String(rows.length));
    let men = 0;
    let women = 0;
    const groups = new Map<string, { men: number; women: number }>();
    for (const row of rows) {
      const choir = row.choirName || "Sem coro";
      const current = groups.get(choir) ?? { men: 0, women: 0 };
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

    const capacityValue = toNumber(roomCapacity) || 3;
    const needed = [...groups.values()].reduce(
      (sum, counts) => sum + roomsNeeded(counts.men, capacityValue) + roomsNeeded(counts.women, capacityValue),
      0,
    );
    const totalNeededValue = needed || roomsNeeded(rows.length, capacityValue);
    setRoomCount(totalNeededValue);

    const nextAssignments: Record<string, number | null> = {};
    let roomIndex = 0;
    let inRoom = 0;
    for (const row of rows) {
      if (inRoom >= capacityValue) {
        roomIndex += 1;
        inRoom = 0;
      }
      if (roomIndex >= totalNeededValue) roomIndex = totalNeededValue - 1;
      nextAssignments[row.id] = roomIndex;
      inRoom += 1;
    }
    setAssignments(nextAssignments);

    void getAdminRegistrationPhotos({ data: { registrationIds: rows.map((row) => row.id) } })
      .then((urls) => setPhotoUrls(urls))
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
            }>,
          );
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

  const addChoir = () => setChoirs((previous) => [...previous, { name: "", men: "", women: "" }]);
  const removeChoir = (index: number) =>
    setChoirs((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

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
      const men = members.filter((row) => isMenVoice(row.voicePart)).length;
      const women = members.filter((row) => isWomenVoice(row.voicePart)).length;
      const cap = toNumber(roomCapacity) || 3;
      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
      const base = offset;
      offset += rooms + (extraRoomIds[choirName]?.length || 0);
      const roomsHtml = Array.from({ length: rooms }).map((_, roomIndex) => {
        const globalRoom = base + roomIndex;
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
            <div class="avatar">${person.name.slice(0, 2).toUpperCase()}</div>
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
            <div class="avatar">${person.name.slice(0, 2).toUpperCase()}</div>
            <span>${person.name}</span>
          </div>
        `)].join("");
        return `<div class="room"><div class="room-title">${roomLabel}</div><div class="people">${peopleHtml}</div></div>`;
      }).join("");
      return `<section class="choir"><h2>${choirName}</h2><div class="rooms">${roomsHtml}${extraHtml}</div></section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mapa de quartos</title><style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .choir { margin-bottom: 24px; }
      .choir h2 { margin-bottom: 10px; }
      .rooms { display: flex; flex-wrap: wrap; gap: 12px; }
      .room { border: 1px solid #ccc; border-radius: 12px; padding: 10px; min-width: 180px; }
      .room-title { font-weight: bold; margin-bottom: 8px; }
      .people { display: flex; flex-wrap: wrap; gap: 8px; }
      .person { width: 70px; text-align: center; font-size: 10px; }
      .person img, .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin: 0 auto 4px; display: block; background: #eee; line-height: 40px; }
    </style></head><body><h1>Mapa de quartos</h1>${roomCards}</body></html>`;
    openPrintableHtml(html);
  };
    const exportPlaquesPdf = () => {
    const plaques: Array<{ roomLabel: string; name: string; photo: string | null }> = [];
    const names = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
    let offset = 0;
    for (const choirName of names) {
      const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
      const men = members.filter((row) => isMenVoice(row.voicePart)).length;
      const women = members.filter((row) => isWomenVoice(row.voicePart)).length;
      const cap = toNumber(roomCapacity) || 3;
      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
      const base = offset;
      offset += rooms + (extraRoomIds[choirName]?.length || 0);
      for (let roomIndex = 0; roomIndex < rooms; roomIndex++) {
        const globalRoom = base + roomIndex;
        const occupants = registrations.filter((row) => assignments[row.id] === globalRoom);
        const extraOccupants = extraPeople.filter((person) => person.roomId === globalRoom);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(roomIndex + 1).padStart(2, "0")}`;
        for (const row of occupants) plaques.push({ roomLabel, name: row.badgeName || row.name, photo: photoUrls[row.id] || null });
        for (const person of extraOccupants) plaques.push({ roomLabel, name: person.name, photo: null });
      }
      for (const [index, roomId] of (extraRoomIds[choirName] || []).entries()) {
        const occupants = registrations.filter((row) => assignments[row.id] === roomId);
        const extraOccupants = extraPeople.filter((person) => person.roomId === roomId);
        const roomLabel = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(rooms + index + 1).padStart(2, "0")}`;
        for (const row of occupants) plaques.push({ roomLabel, name: row.badgeName || row.name, photo: photoUrls[row.id] || null });
        for (const person of extraOccupants) plaques.push({ roomLabel, name: person.name, photo: null });
      }
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Plaquinas</title><style>
      body { font-family: Arial, sans-serif; margin: 0; }
      .plaque { page-break-after: always; padding: 40px; text-align: center; }
      .room { font-size: 32px; font-weight: bold; margin-bottom: 20px; }
      .photo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto 20px; display: block; background: #eee; }
      .name { font-size: 24px; margin-bottom: 20px; }
      .hymn { font-size: 12px; color: #555; }
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

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">Hospedagem</h1>
          </div>
          {gate === "authorized" && (
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
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
                <div className="grid gap-4 md:grid-cols-3">
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
                <div className="grid gap-4 md:grid-cols-2">
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
                <div className="grid gap-4 md:grid-cols-2">
                  {(() => {
                    const names = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
                    let offset = 0;
                    return names.map((choirName) => {
                      const members = registrations.filter((row) => (row.choirName || "Sem coro") === choirName);
                      const men = members.filter((row) => isMenVoice(row.voicePart)).length;
                      const women = members.filter((row) => isWomenVoice(row.voicePart)).length;
                      const cap = toNumber(roomCapacity) || 3;
                      const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
                      const extra = (extraRoomIds[choirName] || []).length;
                      const base = offset;
                      offset += rooms + extra;
                      return (
                        <div key={choirName} className="rounded-xl border p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold">{choirName}</p>
                              <p className="text-xs text-muted-foreground">
                                Total: {members.length} · Homens: {men} · Mulheres: {women} · Quartos: {rooms + (extraRoomIds[choirName]?.length || 0)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
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
                          <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              {Array.from({ length: rooms }).map((_, roomIndex) => {
                                const globalRoom = base + roomIndex;
                                const occupants = registrations.filter((row) => assignments[row.id] === globalRoom);
                                const extraOccupants = extraPeople.filter((person) => person.roomId === globalRoom);
                                return (
                                  <div
                                    key={globalRoom}
                                    className="rounded-lg border bg-muted/20 p-2 min-h-16"
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
                                        setAssignments((previous) => ({ ...previous, [id]: globalRoom }));
                                      }
                                    }}
                                  >
                                    <p className="text-[0.65rem] font-medium mb-1">
                                      {choirName.trim().split(/\s+/).pop()?.toUpperCase()}-{String(roomIndex + 1).padStart(2, "0")} ({occupants.length + extraOccupants.length}/{cap})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {occupants.map((row) => (
                                        <div
                                          key={row.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                          className="flex flex-col items-center gap-1 cursor-move"
                                        >
                                          {photoUrls[row.id] ? (
                                            <img
                                              src={photoUrls[row.id]}
                                              alt={row.name}
                                              className="h-8 w-8 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                                              {row.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-[0.6rem] text-muted-foreground max-w-14 truncate">
                                            {row.badgeName || row.name}
                                          </span>
                                        </div>
                                      ))}
                                      {extraOccupants.map((person) => (
                                        <div
                                          key={person.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                                          className="flex flex-col items-center gap-1 cursor-move"
                                        >
                                          {person.photo ? (
                                            <img src={person.photo} alt={person.name} className="h-8 w-8 rounded-full object-cover" />
                                          ) : (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                                              {person.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-[0.6rem] text-muted-foreground max-w-14 truncate">
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
                                    className="rounded-lg border bg-muted/20 p-2 min-h-16"
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
                                        setAssignments((previous) => ({ ...previous, [id]: roomId }));
                                      }
                                    }}
                                  >
                                    <p className="text-[0.65rem] font-medium mb-1">
                                      {choirName.trim().split(/\s+/).pop()?.toUpperCase()}-{String(rooms + index + 1).padStart(2, "0")} ({occupants.length + extraOccupants.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {occupants.map((row) => (
                                        <div
                                          key={row.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                                          className="flex flex-col items-center gap-1 cursor-move"
                                        >
                                          {photoUrls[row.id] ? (
                                            <img
                                              src={photoUrls[row.id]}
                                              alt={row.name}
                                              className="h-8 w-8 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                                              {row.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-[0.6rem] text-muted-foreground max-w-14 truncate">
                                            {row.badgeName || row.name}
                                          </span>
                                        </div>
                                      ))}
                                      {extraOccupants.map((person) => (
                                        <div
                                          key={person.id}
                                          draggable
                                          onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                                          className="flex flex-col items-center gap-1 cursor-move"
                                        >
                                          {person.photo ? (
                                            <img src={person.photo} alt={person.name} className="h-8 w-8 rounded-full object-cover" />
                                          ) : (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                                              {person.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-[0.6rem] text-muted-foreground max-w-14 truncate">
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
                <div className="grid gap-3 md:grid-cols-4 items-end">
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
                        const men = members.filter((row) => isMenVoice(row.voicePart)).length;
                        const women = members.filter((row) => isWomenVoice(row.voicePart)).length;
                        const cap = toNumber(roomCapacity) || 3;
                        const rooms = roomsNeeded(men, cap) + roomsNeeded(women, cap);
                        let offset = 0;
                        // compute base offset
                        const allNames = [...new Set(registrations.map((row) => row.choirName || "Sem coro"))];
                        const idx = allNames.indexOf(choirName);
                        for (let i = 0; i < idx; i++) {
                          const m = registrations.filter((row) => (row.choirName || "Sem coro") === allNames[i]);
                          const mm = m.filter((row) => isMenVoice(row.voicePart)).length;
                          const ww = m.filter((row) => isWomenVoice(row.voicePart)).length;
                          offset += roomsNeeded(mm, cap) + roomsNeeded(ww, cap) + (extraRoomIds[allNames[i]]?.length || 0);
                        }
                        const base = offset;
                        const opts = Array.from({ length: rooms }).map((_, ri) => {
                          const id = base + ri;
                          const label = `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(ri + 1).padStart(2, "0")}`;
                          return { id, label };
                        });
                        const extraOpts = (extraRoomIds[choirName] || []).map((id, ri) => ({
                          id,
                          label: `${choirName.trim().split(/\s+/).pop()?.toUpperCase()}-${String(rooms + ri + 1).padStart(2, "0")}`,
                        }));
                        return [...opts, ...extraOpts].map((o) => (
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
                  onClick={() => {
                    if (!extraName.trim()) return;
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
                        photo: extraPhoto,
                        roomId: extraRoomId ? Number(extraRoomId) : null,
                      },
                    ]);
                    setExtraName("");
                    setExtraCpf("");
                    setExtraPaid("");
                    setExtraPhoto(null);
                  }}
                >
                  Adicionar pessoa avulsa
                </Button>
                <div className="flex flex-wrap gap-2">
                  {extraPeople.map((person) => (
                    <div
                      key={person.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", person.id)}
                      className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 p-2 cursor-move"
                    >
                      {person.photo ? (
                        <img src={person.photo} alt={person.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-semibold text-primary">
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[0.6rem] text-muted-foreground max-w-14 truncate">{person.name}</span>
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
