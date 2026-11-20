import { useState } from "react";
import { LoaderCircle, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { validateNamedLodgingPlan, type LodgingPlan } from "./admin-lodging.domain";

export type NamedLodgingRegistration = {
  id: string;
  name: string;
  badgeName: string | null;
  choirName: string;
  registrationPriceCents: number | null;
  cancelledAt?: string | null;
};

type Props = {
  registrations: NamedLodgingRegistration[];
  initialPlan: LodgingPlan;
  photoUrls: Record<string, string>;
  persistPlan: (plan: LodgingPlan) => Promise<void>;
  onSignOut: () => void;
  navigateTo?: (to: AdminNavigationPath) => void;
};

export function AdminNamedLodgingPage({
  registrations,
  initialPlan,
  photoUrls,
  persistPlan,
  onSignOut,
  navigateTo,
}: Props) {
  // Cancelled/deleted registrations release their bed before the next edit.
  // Hydration remains read-only; the reconciled assignments are saved with an action.
  const activeIds = new Set(registrations.filter((row) => !row.cancelledAt).map((row) => row.id));
  const [plan, setPlan] = useState(() => ({
    ...initialPlan,
    assignments: Object.fromEntries(
      Object.entries(initialPlan.assignments).filter(([id]) => activeIds.has(id)),
    ),
  }));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(() =>
    Object.keys(initialPlan.assignments).some((id) => !activeIds.has(id)),
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const rooms = plan.namedRooms ?? [];
  const capacity = Math.min(plan.roomCapacity, 3);
  const active = registrations.filter((row) => !row.cancelledAt);
  const cancelled = registrations.filter((row) => row.cancelledAt);
  const allocated = active.filter((row) => plan.assignments[row.id]);
  const unallocated = active.filter(
    (row) => !plan.assignments[row.id] && !plan.noLodgingIds.includes(row.id),
  );
  const withoutLodging = active.filter(
    (row) => !plan.assignments[row.id] && plan.noLodgingIds.includes(row.id),
  );
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  const term = normalize(search.trim());
  const matches = (text: string) => !term || normalize(text).includes(term);

  const save = async (next: LodgingPlan) => {
    try {
      validateNamedLodgingPlan(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Confira os quartos e tente novamente.");
      return;
    }
    setPlan(next);
    setDirty(true);
    setSaving(true);
    setError("");
    try {
      await persistPlan(next);
      setDirty(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  const move = (id: string, roomKey: string) => {
    const row = registrations.find((person) => person.id === id);
    if (row?.cancelledAt) return;
    const next = { ...plan, assignments: { ...plan.assignments } };
    if (row) {
      if (roomKey) next.assignments[id] = roomKey;
      else delete next.assignments[id];
      next.noLodgingIds = plan.noLodgingIds.filter((item) => item !== id);
      if (!roomKey && row.registrationPriceCents === 8000) next.noLodgingIds.push(id);
    } else {
      next.extraPeople = plan.extraPeople.map((person) =>
        person.id === id ? { ...person, roomKey: roomKey || null } : person,
      );
    }
    void save(next);
  };

  const destinationSelect = (id: string, name: string, value: string) => (
    <select
      aria-label={`Quarto de ${name}`}
      value={value}
      disabled={saving}
      onChange={(event) => move(id, event.target.value)}
      className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary print:hidden"
    >
      <option value="">Sem quarto</option>
      {rooms.map((room) => (
        <option key={room.key} value={room.key}>
          {room.name} · {room.location}
        </option>
      ))}
    </select>
  );

  const participant = (row: NamedLodgingRegistration) => (
    <div key={row.id} className="min-w-0 py-2">
      <div className="flex items-start gap-2">
        {photoUrls[row.id] && (
          <img
            src={photoUrls[row.id]}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold uppercase">
            {row.badgeName || row.name}
            {row.registrationPriceCents === 8000 ? " *" : ""}
          </p>
          {row.badgeName && row.badgeName !== row.name && (
            <p className="break-words text-xs text-muted-foreground">{row.name}</p>
          )}
          <p className="break-words text-xs text-muted-foreground">{row.choirName || "Sem coro"}</p>
        </div>
      </div>
      {!row.cancelledAt &&
        destinationSelect(row.id, row.badgeName || row.name, plan.assignments[row.id] ?? "")}
    </div>
  );

  const pendingSection = (title: string, rows: NamedLodgingRegistration[], open = false) => (
    <details className="rounded-xl border bg-card p-4 print:break-before-page" open={open}>
      <summary className="cursor-pointer text-sm font-semibold">
        {title} · {rows.length}
      </summary>
      <div className="mt-3 grid gap-x-5 divide-y sm:grid-cols-2 lg:grid-cols-3">
        {rows
          .filter((row) => matches(`${row.name} ${row.badgeName} ${row.choirName}`))
          .map(participant)}
      </div>
    </details>
  );

  return (
    <main className="internal-app named-lodging min-h-svh bg-background text-foreground px-4 pb-16 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <style>{`@media print { .named-lodging { padding: 0 !important; } .named-lodging nav, .named-lodging aside { display: none !important; } .lodging-room { break-inside: avoid; } }`}</style>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Hospedagem</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quartos do mapa · até {capacity} pessoas por quarto
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span role="status" className="text-xs text-muted-foreground">
              {saving ? "Salvando…" : dirty ? "Alterações não salvas" : "Alocação salva"}
            </span>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void save(plan)}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar alocação
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              Imprimir mapa
            </Button>
            <Button size="sm" variant="outline" onClick={onSignOut}>
              Sair
            </Button>
          </div>
        </header>
        <div className="print:hidden">
          <AdminNavigation current="hospedagem" navigateTo={navigateTo} />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card p-4 text-sm tabular-nums">
          <span>
            <strong>{rooms.length}</strong> quartos
          </span>
          <span>
            <strong>{allocated.length}</strong> inscritos alocados
          </span>
          <span>
            <strong>{plan.extraPeople.filter((person) => person.roomKey).length}</strong> avulsos
            alocados
          </span>
          <span>
            <strong>{unallocated.length}</strong> aguardando quarto
          </span>
          <span>
            <strong>{withoutLodging.length}</strong> sem solicitação de quarto
          </span>
          <span>
            <strong>{cancelled.length}</strong> cancelado(s)
          </span>
        </div>
        <p className="text-sm font-medium">* Não solicitou inscrição com quarto</p>
        <Input
          aria-label="Buscar quarto ou pessoa"
          placeholder="Buscar quarto, nome ou coro"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-lg print:hidden"
        />
        {[...new Set(rooms.map((room) => room.location))].map((location) => {
          const visibleRooms = rooms.filter(
            (room) =>
              room.location === location &&
              matches(
                `${room.name} ${room.location} ${room.notes} ${registrations
                  .filter((row) => plan.assignments[row.id] === room.key)
                  .map((row) => `${row.name} ${row.badgeName} ${row.choirName}`)
                  .join(" ")} ${plan.extraPeople
                  .filter((person) => person.roomKey === room.key)
                  .map((person) => person.name)
                  .join(" ")}`,
              ),
          );
          if (!visibleRooms.length) return null;
          return (
            <section key={location} className="space-y-3" aria-label={location}>
              <h2 className="text-lg font-bold">{location}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleRooms.map((room) => {
                  const people = allocated.filter((row) => plan.assignments[row.id] === room.key);
                  const guests = plan.extraPeople.filter((person) => person.roomKey === room.key);
                  const count = people.length + guests.length;
                  return (
                    <section
                      key={room.key}
                      role="region"
                      aria-label={`Quarto ${room.name}`}
                      className="lodging-room min-w-0 rounded-xl border bg-card p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold uppercase">{room.name}</h3>
                          {room.floor && (
                            <p className="text-xs text-muted-foreground">{room.floor}</p>
                          )}
                        </div>
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums">
                          {count}/{capacity}
                        </span>
                      </div>
                      <div className="divide-y">
                        {people.map(participant)}
                        {guests.map((person) => (
                          <div key={person.id} className="py-2">
                            <p className="text-sm font-semibold uppercase">{person.name}</p>
                            <p className="text-xs text-muted-foreground">Avulso · {person.role}</p>
                            {destinationSelect(person.id, person.name, person.roomKey ?? "")}
                          </div>
                        ))}
                      </div>
                      {count === 0 && (
                        <p className="py-2 text-xs text-muted-foreground">
                          Sem ocupante cadastrado. Confirme a disponibilidade.
                        </p>
                      )}
                      {room.notes && (
                        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                          {room.notes}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
        {pendingSection("Aguardando definição de quarto", unallocated, true)}
        {pendingSection("Sem solicitação de quarto", withoutLodging)}
        {plan.extraPeople.some((person) => !person.roomKey) && (
          <section className="rounded-xl border bg-card p-4" aria-label="Avulsos aguardando quarto">
            <h2 className="text-sm font-semibold">Avulsos aguardando definição de quarto</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plan.extraPeople
                .filter((person) => !person.roomKey && matches(person.name))
                .map((person) => (
                  <div key={person.id} className="py-2">
                    <p className="text-sm font-semibold">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.role}</p>
                    {destinationSelect(person.id, person.name, "")}
                  </div>
                ))}
            </div>
          </section>
        )}
        {pendingSection("Inscrições canceladas", cancelled)}
      </div>
    </main>
  );
}
