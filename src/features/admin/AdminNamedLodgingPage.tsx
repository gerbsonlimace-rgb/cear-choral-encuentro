import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileDown, LoaderCircle, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deliverFile } from "@/lib/file-download";
import { exportAdminLodgingPdf } from "@/lib/admin.functions";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import {
  validateNamedLodgingPlan,
  type LodgingPlan,
  type LodgingRosterEntry,
} from "./admin-lodging.domain";
import { AdminNamedLodgingPrintSheet } from "./AdminNamedLodgingPrintSheet";

export type NamedLodgingRegistration = LodgingRosterEntry;

const roomCollator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const knownLocationOrder = ["Centro Pastoral", "Seminário", "Casa dos Professores"];

function compareRoomLocations(left: string, right: string) {
  const leftRank = knownLocationOrder.indexOf(left);
  const rightRank = knownLocationOrder.indexOf(right);
  if (leftRank >= 0 && rightRank >= 0) return leftRank - rightRank;
  if (leftRank >= 0) return -1;
  if (rightRank >= 0) return 1;
  return roomCollator.compare(left, right);
}

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
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [printLayout, setPrintLayout] = useState<"list" | null>(null);
  const [preparedPdf, setPreparedPdf] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportLodgingPdf = useServerFn(exportAdminLodgingPdf);
  const rooms = plan.namedRooms ?? [];
  const orderedRooms = [...rooms].sort(
    (left, right) =>
      compareRoomLocations(left.location, right.location) ||
      roomCollator.compare(left.name, right.name),
  );
  const locations = [...new Set(rooms.map((room) => room.location))].sort(compareRoomLocations);
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

  useEffect(() => {
    const finishPrint = () => setPrintLayout(null);
    window.addEventListener("afterprint", finishPrint);
    return () => window.removeEventListener("afterprint", finishPrint);
  }, []);

  const save = async (next: LodgingPlan) => {
    try {
      validateNamedLodgingPlan(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Confira os quartos e tente novamente.");
      return;
    }
    setPlan(next);
    setPreparedPdf(null);
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
      aria-label={`Atribuir ou alterar quarto de ${name}`}
      value={value}
      disabled={saving}
      onChange={(event) => {
        move(id, event.target.value);
        setEditingPersonId(null);
      }}
      className="h-9 w-36 max-w-[65vw] min-w-0 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden sm:w-44 sm:max-w-44"
    >
      <option value="">Sem quarto</option>
      {orderedRooms.map((room) => (
        <option key={room.key} value={room.key}>
          {room.name}
        </option>
      ))}
    </select>
  );

  const removeAssociation = (id: string, name: string, roomKey: string) => {
    const roomName = rooms.find((room) => room.key === roomKey)?.name;
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={saving}
        aria-label={`Excluir ${name} do quarto ${roomName ?? "atual"}`}
        title="Excluir do quarto"
        onClick={() => {
          move(id, "");
          setEditingPersonId(null);
        }}
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive print:hidden"
      >
        <X />
      </Button>
    );
  };

  const personBadge = ({
    id,
    name,
    roomKey,
    title,
    star = false,
    editable = true,
  }: {
    id: string;
    name: string;
    roomKey: string;
    title: string;
    star?: boolean;
    editable?: boolean;
  }) => {
    const isEditing = editingPersonId === id;
    return (
      <Popover
        key={id}
        open={isEditing}
        onOpenChange={(open) => setEditingPersonId(open ? id : null)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={saving || !editable}
            aria-label={`${name}${star ? ", não solicitou quarto" : ""}. Opções de hospedagem`}
            title={title}
            className="inline-flex h-8 max-w-[48vw] items-center rounded-full border bg-muted/40 px-2.5 text-left text-xs font-semibold uppercase leading-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 sm:max-w-[12rem] print:hidden"
          >
            <span className="truncate">
              {name}
              {star ? " *" : ""}
            </span>
          </button>
        </PopoverTrigger>
        {editable && (
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-2">
            <div className="flex items-center gap-1">
              {destinationSelect(id, name, roomKey)}
              {roomKey && removeAssociation(id, name, roomKey)}
            </div>
          </PopoverContent>
        )}
      </Popover>
    );
  };

  const participant = (row: NamedLodgingRegistration) => {
    const name = row.badgeName?.trim() || row.name;
    return personBadge({
      id: row.id,
      name,
      roomKey: plan.assignments[row.id] ?? "",
      title: `${row.name}${row.choirName ? ` · ${row.choirName}` : ""}`,
      star: row.registrationPriceCents === 8000,
      editable: !row.cancelledAt,
    });
  };

  const extraParticipant = (person: LodgingPlan["extraPeople"][number]) => {
    return personBadge({
      id: person.id,
      name: person.name,
      roomKey: person.roomKey ?? "",
      title: `${person.name} · ${person.role}`,
    });
  };

  const pendingSection = (title: string, rows: NamedLodgingRegistration[], open = false) => (
    <details className="rounded-xl border bg-card p-4 print:break-before-page" open={open}>
      <summary className="cursor-pointer text-sm font-semibold">
        {title} · {rows.length}
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows
          .filter((row) => matches(`${row.name} ${row.badgeName} ${row.choirName}`))
          .map(participant)}
      </div>
    </details>
  );

  const printMap = () => {
    flushSync(() => setPrintLayout("list"));
    window.print();
  };

  const prepareLodgingPdf = async () => {
    if (exportingPdf || saving || dirty) return;
    setExportingPdf(true);
    setPreparedPdf(null);
    setError("");
    try {
      const file = await exportLodgingPdf();
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      setPreparedPdf({
        blob: new Blob([bytes], { type: "application/pdf" }),
        fileName: file.fileName,
      });
    } catch {
      setError("Não foi possível preparar a relação em PDF. Tente novamente.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <main
      className={`internal-app named-lodging min-h-svh bg-background text-foreground px-4 pb-16 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6 ${printLayout ? "lodging-print-list" : ""}`}
    >
      <style>{`@page { size: A4 portrait; margin: 8mm 9mm; }
        @media print {
          .named-lodging { padding: 0 !important; margin: 0 !important; background: #fff !important; color: #111 !important; }
          .named-lodging nav, .named-lodging aside { display: none !important; }
          .named-lodging.lodging-print-list > div { display: none !important; }
          .named-lodging.lodging-print-list > .lodging-print-sheet { display: block !important; }
          .lodging-print-sheet { color: #111 !important; background: #fff !important; font: 7.5pt/1.12 Arial, sans-serif !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .lodging-print-heading { margin: 3mm 0 9mm; text-align: center; }
          .lodging-print-sheet h1 { margin: 0 0 4mm; font-size: 15pt; font-weight: 700; line-height: 1.1; }
          .lodging-print-heading p { margin: 0 0 2mm; font-size: 11pt; font-weight: 600; }
          .lodging-print-heading .lodging-print-legend { margin: 3mm 0 0; font-size: 8pt; font-weight: 700; }
          .lodging-print-map-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .lodging-print-map-table th, .lodging-print-map-table td { border: 0.25mm solid #666; padding: 0.8mm 1.1mm; text-align: left; vertical-align: middle; }
          .lodging-print-map-table thead { display: table-header-group; }
          .lodging-print-map-table > thead > tr:first-child th { background: #e8e8e8; text-align: center; font-size: 10pt; font-weight: 700; }
          .lodging-print-map-table > thead > tr:nth-child(2) th { background: #f4f4f4; font-size: 9pt; font-weight: 700; }
          .lodging-print-map-table > thead > tr:nth-child(2) th:nth-child(1), .lodging-print-map-table > thead > tr:nth-child(2) th:nth-child(3) { width: 8%; }
          .lodging-print-map-table > thead > tr:nth-child(2) th:nth-child(2), .lodging-print-map-table > thead > tr:nth-child(2) th:nth-child(4) { width: 42%; }
          .lodging-print-map-table > tbody > tr { break-inside: avoid; page-break-inside: avoid; }
          .lodging-print-room-number { width: 8%; font-size: 8.5pt; font-weight: 500; text-align: left !important; white-space: nowrap; }
          .lodging-print-occupants { width: 42%; font-size: 7.5pt; overflow-wrap: anywhere; }
          .lodging-print-blocked { background: #333 !important; color: #fff !important; }
          .lodging-print-unconfirmed { font-style: italic; }
          .lodging-print-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 7mm; }
          .lodging-print-section { break-inside: avoid; page-break-inside: avoid; }
          .lodging-print-section h2 { margin: 0 0 3mm; font-size: 11pt; font-weight: 700; }
          .lodging-print-section ul { margin: 0; padding: 0; list-style: none; }
          .lodging-print-section li { margin: 0 0 1.5mm; font-size: 9.5pt; line-height: 1.3; }
        }`}</style>
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
            <Button size="sm" variant="outline" onClick={printMap}>
              <Printer className="size-4" />
              Imprimir mapa
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={exportingPdf || saving || dirty}
              title={dirty ? "Salve a alocação antes de preparar o PDF." : undefined}
              onClick={() => void prepareLodgingPdf()}
            >
              {exportingPdf ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              {exportingPdf ? "Preparando PDF…" : "Exportar relação (PDF)"}
            </Button>
            {preparedPdf && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void deliverFile(preparedPdf.blob, preparedPdf.fileName)}
              >
                <Download className="size-4" />
                Baixar PDF pronto
              </Button>
            )}
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
        {locations.map((location) => {
          const visibleRooms = rooms
            .filter(
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
            )
            .sort(
              (left, right) =>
                roomCollator.compare(left.name, right.name) ||
                roomCollator.compare(left.key, right.key),
            );
          if (!visibleRooms.length) return null;
          return (
            <section key={location} className="space-y-3" aria-label={location}>
              <h2 className="text-lg font-bold">{location}</h2>
              <div className="rounded-lg border bg-card">
                {visibleRooms.map((room) => {
                  const people = allocated
                    .filter((row) => plan.assignments[row.id] === room.key)
                    .sort((left, right) =>
                      roomCollator.compare(
                        left.badgeName?.trim() || left.name,
                        right.badgeName?.trim() || right.name,
                      ),
                    );
                  const guests = plan.extraPeople
                    .filter((person) => person.roomKey === room.key)
                    .sort((left, right) => roomCollator.compare(left.name, right.name));
                  const count = people.length + guests.length;
                  return (
                    <section
                      key={room.key}
                      role="region"
                      aria-label={`Quarto ${room.name}`}
                      className="lodging-room grid min-w-0 gap-x-3 gap-y-1.5 border-b px-2.5 py-2 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center"
                    >
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold uppercase tabular-nums">{room.name}</h3>
                          {room.floor && (
                            <p className="text-xs text-muted-foreground">{room.floor}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {people.map(participant)}
                        {guests.map(extraParticipant)}
                        {count === 0 && (
                          <p className="self-center py-1 text-xs text-muted-foreground">
                            Sem ocupantes. Confirme a disponibilidade.
                          </p>
                        )}
                      </div>
                      {room.notes && (
                        <p className="text-xs text-muted-foreground sm:col-start-2">{room.notes}</p>
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
            <div className="flex flex-wrap gap-2">
              {plan.extraPeople
                .filter((person) => !person.roomKey && matches(person.name))
                .map(extraParticipant)}
            </div>
          </section>
        )}
        {pendingSection("Inscrições canceladas", cancelled)}
      </div>
      <AdminNamedLodgingPrintSheet registrations={registrations} plan={plan} />
    </main>
  );
}
