import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Download, MapPin, Pencil, QrCode, RotateCcw, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminNavigation, type AdminNavigationPath } from "@/features/admin/AdminNavigation";
import {
  createAdminEventActivity,
  deleteAdminEventActivity,
  downloadAdminActivityQrPdf,
  getAdminActivityAttendances,
  getAdminActivityQr,
  getAdminEventActivities,
  regenerateAdminActivityQr,
  updateAdminEventActivity,
} from "@/lib/event-activity.functions";
import { AdminActivityAttendancesDialog } from "./AdminActivityAttendancesDialog";
import {
  eventActivityCreateSchema,
  type AdminActivityAttendance,
  type AdminEventActivity,
  type EventActivityCreate,
  type EventActivityUpdate,
} from "./eventActivity.domain";
import type { QrCodeView } from "./eventActivity.server";

type Mutation<T, R = AdminEventActivity> = (input: { data: T }) => Promise<R>;
type DownloadFile = { base64: string; filename: string };

export type AdminEventActivitiesPageProps = {
  loadActivities?: () => Promise<AdminEventActivity[]>;
  createActivity?: Mutation<EventActivityCreate>;
  updateActivity?: Mutation<EventActivityUpdate>;
  deleteActivity?: Mutation<{ activityId: string }, void>;
  generateQr?: Mutation<{ activityId: string }, QrCodeView>;
  regenerateQr?: Mutation<{ activityId: string }, QrCodeView>;
  downloadQrPdf?: () => Promise<DownloadFile>;
  listAttendances?: (input: { data: { activityId: string } }) => Promise<AdminActivityAttendance[]>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

const emptyDraft: EventActivityCreate = {
  title: "",
  activityDate: "2026-11-20",
  startsAt: null,
  endsAt: null,
  location: null,
  description: null,
  category: "conference",
  sortOrder: 10,
  isActive: true,
  requiresQr: false,
  verifyLocation: false,
  latitude: null,
  longitude: null,
  radiusMeters: null,
};

const categoryLabels = {
  welcome: "Acolhimento",
  celebration: "Celebração",
  meal: "Refeição",
  conference: "Conferência",
  music: "Música",
  visit: "Visita",
} as const;

export function downloadBase64Pdf(file: DownloadFile) {
  const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = file.filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function AdminEventActivitiesPage({
  loadActivities = getAdminEventActivities,
  createActivity = createAdminEventActivity,
  updateActivity = updateAdminEventActivity,
  deleteActivity = deleteAdminEventActivity,
  generateQr = getAdminActivityQr,
  regenerateQr = regenerateAdminActivityQr,
  downloadQrPdf = downloadAdminActivityQrPdf,
  listAttendances = getAdminActivityAttendances,
  navigateTo,
}: AdminEventActivitiesPageProps) {
  const [activities, setActivities] = useState<AdminEventActivity[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEventActivity | null>(null);
  const [draft, setDraft] = useState<EventActivityCreate>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [qr, setQr] = useState<QrCodeView | null>(null);
  const [attendanceActivity, setAttendanceActivity] = useState<AdminEventActivity | null>(null);

  const load = useCallback(async () => {
    setError("");
    try { setActivities(await loadActivities()); }
    catch { setError("Não foi possível carregar a programação."); setActivities([]); }
  }, [loadActivities]);

  useEffect(() => { void load(); }, [load]);

  const printable = useMemo(
    () => activities?.some((activity) => activity.isActive && activity.requiresQr) ?? false,
    [activities],
  );

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, sortOrder: ((activities?.length ?? 0) + 1) * 10 });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (activity: AdminEventActivity) => {
    setEditing(activity);
    const { id: _id, qrVersion: _qrVersion, attendanceCount: _count, createdAt: _created, updatedAt: _updated, ...values } = activity;
    setDraft(values);
    setFormError("");
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = eventActivityCreateSchema.safeParse(draft);
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Revise os campos da atividade."); return; }
    setBusy(true); setFormError(""); setMessage("");
    try {
      const saved = editing
        ? await updateActivity({ data: { id: editing.id, ...parsed.data } })
        : await createActivity({ data: parsed.data });
      setActivities((current) => [...(current ?? []).filter((item) => item.id !== saved.id), saved]
        .sort((a, b) => a.activityDate.localeCompare(b.activityDate) || a.sortOrder - b.sortOrder));
      setFormOpen(false);
      setMessage(editing ? "Atividade atualizada." : "Atividade cadastrada.");
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Não foi possível salvar a atividade."); }
    finally { setBusy(false); }
  };

  const remove = async (activity: AdminEventActivity) => {
    if (!window.confirm(`Excluir a atividade “${activity.title}”?`)) return;
    setBusy(true); setError("");
    try {
      await deleteActivity({ data: { activityId: activity.id } });
      setActivities((current) => current?.filter((item) => item.id !== activity.id) ?? []);
      setMessage("Atividade excluída.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir a atividade."); }
    finally { setBusy(false); }
  };

  const showQr = async (activity: AdminEventActivity, regenerate = false) => {
    if (regenerate && !window.confirm("Regenerar este QR Code? O código impresso anteriormente deixará de funcionar.")) return;
    setBusy(true); setError("");
    try {
      const result = await (regenerate ? regenerateQr : generateQr)({ data: { activityId: activity.id } });
      setQr(result);
      if (regenerate) { await load(); setMessage("QR Code regenerado. Imprima o novo código."); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível gerar o QR Code."); }
    finally { setBusy(false); }
  };

  const download = async () => {
    setBusy(true); setError("");
    try { downloadBase64Pdf(await downloadQrPdf()); setMessage("PDF gerado para download."); }
    catch { setError("Não foi possível gerar o PDF dos QR Codes."); }
    finally { setBusy(false); }
  };

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl tracking-[-0.02em]">Programação</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Cadastre a agenda oficial, escolha quais atividades controlam presença e gere os códigos para impressão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!printable || busy} onClick={() => void download()}><Download className="size-4" />Baixar PDF dos QR Codes</Button>
            <Button onClick={openCreate}><CalendarDays className="size-4" />Cadastrar atividade</Button>
          </div>
        </header>
        <AdminNavigation current="activities" navigateTo={navigateTo} />
        <div aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{message}</div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        {activities === null && <Skeleton className="h-64 w-full" />}
        {activities?.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma atividade cadastrada.</div>}
        {activities && activities.length > 0 && (
          <section className="divide-y rounded-2xl border bg-card">
            {activities.map((activity) => (
              <article key={activity.id} className="grid gap-4 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:p-5">
                <div className="tabular-nums">
                  <p className="font-semibold">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${activity.activityDate}T12:00:00Z`))}</p>
                  <p className="text-sm text-muted-foreground">{activity.startsAt ?? "Sem horário"}{activity.endsAt ? `–${activity.endsAt}` : ""}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{activity.title}</h2><Badge variant={activity.isActive ? "default" : "secondary"}>{activity.isActive ? "Ativa" : "Inativa"}</Badge>{activity.requiresQr && <Badge variant="outline"><QrCode className="mr-1 size-3" />QR</Badge>}{activity.verifyLocation && <Badge variant="outline"><MapPin className="mr-1 size-3" />Local</Badge>}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{categoryLabels[activity.category]}{activity.location ? ` · ${activity.location}` : ""} · {activity.attendanceCount} presença{activity.attendanceCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAttendanceActivity(activity)}><Users className="size-4" />Presenças</Button>
                  {activity.isActive && activity.requiresQr && <Button size="sm" variant="outline" disabled={busy} onClick={() => void showQr(activity)}><QrCode className="size-4" />Ver QR</Button>}
                  {activity.isActive && activity.requiresQr && <Button size="icon" variant="ghost" aria-label={`Regenerar QR de ${activity.title}`} disabled={busy} onClick={() => void showQr(activity, true)}><RotateCcw className="size-4" /></Button>}
                  <Button size="icon" variant="ghost" aria-label={`Editar ${activity.title}`} onClick={() => openEdit(activity)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Excluir ${activity.title}`} disabled={busy} onClick={() => void remove(activity)}><Trash2 className="size-4" /></Button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar atividade" : "Cadastrar atividade"}</DialogTitle><DialogDescription>Os campos de geocerca aparecem somente quando a verificação de local está ativa.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="activity-title">Título</Label><Input id="activity-title" required maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="activity-date">Data</Label><Input id="activity-date" type="date" min="2026-11-20" max="2026-11-22" required value={draft.activityDate} onChange={(e) => setDraft({ ...draft, activityDate: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="activity-start">Início</Label><Input id="activity-start" type="time" value={draft.startsAt ?? ""} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value || null })} /></div>
              <div className="space-y-2"><Label htmlFor="activity-end">Fim</Label><Input id="activity-end" type="time" value={draft.endsAt ?? ""} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value || null })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="activity-category">Categoria</Label><select id="activity-category" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as keyof typeof categoryLabels })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="activity-order">Ordem</Label><Input id="activity-order" type="number" min={0} max={999} required value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="activity-location">Local</Label><Input id="activity-location" maxLength={500} value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value || null })} /></div>
            <div className="space-y-2"><Label htmlFor="activity-description">Descrição</Label><Textarea id="activity-description" maxLength={500} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} /></div>
            <div className="space-y-4 rounded-xl bg-muted/60 p-4">
              <label className="flex items-center justify-between gap-4"><span><strong className="block text-sm">Atividade ativa</strong><small className="text-muted-foreground">Aparece na programação pública.</small></span><Switch aria-label="Atividade ativa" checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} /></label>
              <label className="flex items-center justify-between gap-4"><span><strong className="block text-sm">Controlar presença por QR Code</strong><small className="text-muted-foreground">Exige horários inicial e final.</small></span><Switch aria-label="Controlar presença por QR Code" checked={draft.requiresQr} onCheckedChange={(checked) => setDraft(checked ? { ...draft, requiresQr: true } : { ...draft, requiresQr: false, verifyLocation: false, latitude: null, longitude: null, radiusMeters: null })} /></label>
              {draft.requiresQr && <label className="flex items-center justify-between gap-4"><span><strong className="block text-sm">Verificar local</strong><small className="text-muted-foreground">Solicita e registra a posição do participante.</small></span><Switch aria-label="Verificar local" checked={draft.verifyLocation} onCheckedChange={(checked) => setDraft(checked ? { ...draft, verifyLocation: true } : { ...draft, verifyLocation: false, latitude: null, longitude: null, radiusMeters: null })} /></label>}
            </div>
            {draft.requiresQr && draft.verifyLocation && <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3"><legend className="px-2 text-sm font-semibold">Geocerca</legend><div className="space-y-2"><Label htmlFor="activity-latitude">Latitude</Label><Input id="activity-latitude" aria-label="Latitude" type="number" step="any" required value={draft.latitude ?? ""} onChange={(e) => setDraft({ ...draft, latitude: e.target.value === "" ? null : Number(e.target.value) })} /></div><div className="space-y-2"><Label htmlFor="activity-longitude">Longitude</Label><Input id="activity-longitude" aria-label="Longitude" type="number" step="any" required value={draft.longitude ?? ""} onChange={(e) => setDraft({ ...draft, longitude: e.target.value === "" ? null : Number(e.target.value) })} /></div><div className="space-y-2"><Label htmlFor="activity-radius">Raio permitido em metros</Label><Input id="activity-radius" aria-label="Raio permitido em metros" type="number" min={10} max={5000} required value={draft.radiusMeters ?? ""} onChange={(e) => setDraft({ ...draft, radiusMeters: e.target.value === "" ? null : Number(e.target.value) })} /></div></fieldset>}
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar atividade"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={qr !== null} onOpenChange={(open) => !open && setQr(null)}><DialogContent><DialogHeader><DialogTitle>{qr?.activityTitle}</DialogTitle><DialogDescription>Este código continua válido até ser regenerado.</DialogDescription></DialogHeader>{qr && <><div className="mx-auto w-full max-w-sm rounded-xl bg-white p-4" dangerouslySetInnerHTML={{ __html: qr.svg }} /><p className="break-all text-xs text-muted-foreground">{qr.scanUrl}</p></>}</DialogContent></Dialog>
      <AdminActivityAttendancesDialog open={attendanceActivity !== null} activity={attendanceActivity} onOpenChange={(open) => !open && setAttendanceActivity(null)} loadAttendances={listAttendances} />
    </main>
  );
}
