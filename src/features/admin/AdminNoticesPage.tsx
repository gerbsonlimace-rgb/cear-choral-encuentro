import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, Megaphone, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  eventNoticeCreateSchema,
  formatNoticeDate,
  sortEventNotices,
  type EventNotice,
  type EventNoticeCreate,
  type EventNoticeUpdate,
} from "@/features/event-notices/eventNotice.domain";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminEventNotice,
  getAdminEventNoticeBootstrap,
  updateAdminEventNotice,
  type AdminEventNoticeBootstrap,
} from "@/lib/event-notice.functions";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

export type AdminNoticesPageProps = {
  loadBootstrap?: () => Promise<AdminEventNoticeBootstrap>;
  createNotice?: (input: { data: EventNoticeCreate }) => Promise<EventNotice>;
  updateNotice?: (input: { data: EventNoticeUpdate }) => Promise<EventNotice>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  onMissingSession: () => void;
  navigateTo?: (to: AdminNavigationPath) => void;
};

// Stable identity prevents form state changes from reloading the administrative bootstrap.
const getDefaultSession = () => supabase.auth.getSession();

export function AdminNoticesPage({
  loadBootstrap = getAdminEventNoticeBootstrap,
  createNotice = createAdminEventNotice,
  updateNotice = updateAdminEventNotice,
  getSession = getDefaultSession,
  onMissingSession,
  navigateTo,
}: AdminNoticesPageProps) {
  const [data, setData] = useState<AdminEventNoticeBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventNotice | null>(null);
  const [eventId, setEventId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;
        if (session.error || !session.data.session) {
          onMissingSession();
          return;
        }
        const loaded = await loadBootstrap();
        if (active) setData(loaded);
      } catch {
        if (active)
          setError("Não foi possível carregar os avisos. Verifique seu acesso e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getSession, loadBootstrap, onMissingSession, revision]);

  function openEditor(notice?: EventNotice) {
    setEditing(notice ?? null);
    setEventId(notice?.eventId ?? data?.events[0]?.eventId ?? "");
    setTitle(notice?.title ?? "");
    setBody(notice?.body ?? "");
    setDialogError("");
    setMessage("");
    setDialogOpen(true);
  }

  function acceptSaved(saved: EventNotice) {
    setData((previous) =>
      previous
        ? {
            ...previous,
            notices: sortEventNotices([
              saved,
              ...previous.notices.filter((notice) => notice.id !== saved.id),
            ]),
          }
        : previous,
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = eventNoticeCreateSchema.safeParse({
      eventId,
      title,
      body,
      isPublished: editing?.isPublished ?? true,
    });
    if (!parsed.success) {
      setDialogError(parsed.error.issues[0]?.message ?? "Revise os campos do aviso.");
      return;
    }
    setSaving(true);
    setDialogError("");
    setError("");
    try {
      const saved = editing
        ? await updateNotice({ data: { ...parsed.data, id: editing.id } })
        : await createNotice({ data: parsed.data });
      acceptSaved(saved);
      setDialogOpen(false);
      setMessage(editing ? "Aviso atualizado." : "Aviso publicado.");
    } catch (caught) {
      setDialogError(caught instanceof Error ? caught.message : "Não foi possível salvar o aviso.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublication(notice: EventNotice) {
    if (busyId) return;
    setBusyId(notice.id);
    setError("");
    setMessage("");
    try {
      const saved = await updateNotice({
        data: {
          id: notice.id,
          eventId: notice.eventId,
          title: notice.title,
          body: notice.body,
          isPublished: !notice.isPublished,
        },
      });
      acceptSaved(saved);
      setMessage(saved.isPublished ? "Aviso publicado." : "Aviso retirado da home.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o aviso.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Encontro de Coros · Administração
          </p>
          <h1 className="mt-2 font-display text-2xl">Avisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Publique orientações e novidades na home dos participantes.
          </p>
        </header>
        {data && <AdminNavigation current="notices" navigateTo={navigateTo} />}
        {message && (
          <p role="status" className="text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading && <Skeleton className="h-64 w-full" />}
        {!loading && !data && error && (
          <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
            Tentar novamente
          </Button>
        )}
        {data && !loading && (
          <section aria-label="Gestão de avisos" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.notices.filter((notice) => notice.isPublished).length} aviso(s) publicado(s)
              </p>
              <Button onClick={() => openEditor()} disabled={!data.events.length || !!busyId}>
                <Plus aria-hidden="true" /> Novo aviso
              </Button>
            </div>
            {!data.events.length && (
              <p role="alert" className="rounded-xl border border-dashed p-4 text-sm">
                Configure primeiro um evento em Configurações.
              </p>
            )}
            {data.notices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
                <Megaphone aria-hidden="true" className="mx-auto mb-3 size-6 text-zinc-400" />
                <p className="font-semibold">Nenhum aviso cadastrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie o primeiro aviso para orientar os participantes.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {sortEventNotices(data.notices).map((notice) => (
                  <article
                    key={notice.id}
                    className="flex min-w-0 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 break-words text-xs font-medium text-zinc-500">
                        {notice.eventName}
                      </p>
                      <Badge variant={notice.isPublished ? "default" : "secondary"}>
                        {notice.isPublished ? "Publicado" : "Retirado"}
                      </Badge>
                    </div>
                    <h2 className="break-words text-lg font-semibold leading-snug">
                      {notice.title}
                    </h2>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600 [overflow-wrap:anywhere]">
                      {notice.body}
                    </p>
                    <time dateTime={notice.createdAt} className="text-xs text-zinc-500">
                      {formatNoticeDate(notice.createdAt)}
                    </time>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={!!busyId}
                        aria-label={`Editar ${notice.title}`}
                        onClick={() => openEditor(notice)}
                      >
                        <Pencil aria-hidden="true" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={!!busyId}
                        aria-label={`${notice.isPublished ? "Retirar" : "Publicar"} ${notice.title}`}
                        onClick={() => void togglePublication(notice)}
                      >
                        {busyId === notice.id ? (
                          <LoaderCircle aria-hidden="true" className="animate-spin" />
                        ) : notice.isPublished ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                        {notice.isPublished ? "Retirar da home" : "Publicar"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
      >
        <DialogContent className="internal-app max-h-[90svh] overflow-y-auto bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize a mensagem para os participantes."
                : "O aviso ficará visível na home dos participantes do encontro."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={saving} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notice-event">Evento</Label>
                <select
                  id="notice-event"
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  required
                  className="flex min-h-11 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione um evento</option>
                  {data?.events.map((source) => (
                    <option key={source.eventId} value={source.eventId}>
                      {source.eventName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-title">Título</Label>
                <Input
                  id="notice-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Ex.: Orientações para o ensaio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-body">Mensagem</Label>
                <Textarea
                  id="notice-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                  maxLength={5000}
                  rows={7}
                  placeholder="Escreva o que os participantes precisam saber…"
                  aria-describedby="notice-body-count"
                />
                <p id="notice-body-count" className="text-right text-xs text-muted-foreground">
                  {body.length}/5000
                </p>
              </div>
            </fieldset>
            {dialogError && (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle aria-hidden="true" className="animate-spin" />}
                {editing ? "Salvar alterações" : "Publicar aviso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
