import { useEffect, useState, type FormEvent } from "react";
import { Link2, LoaderCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CoroAppEventSource } from "@/features/coroapp-integration/coroAppEventSource.domain";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess, type AdminAccessState } from "@/lib/admin.functions";
import {
  getAdminCoroAppEventSources,
  replaceAdminCoroAppEventSources,
} from "@/lib/coroapp-event-source.functions";

import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

type SaveInput = { data: { publicUrls: string[] } };

type Props = {
  embedded?: boolean;
  loadSources?: () => Promise<CoroAppEventSource[]>;
  saveSources?: (input: SaveInput) => Promise<CoroAppEventSource[]>;
  navigateTo?: (to: AdminNavigationPath) => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  onMissingSession?: () => void;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
};

export function AdminCoroAppIntegrationPage({
  embedded = false,
  loadSources = getAdminCoroAppEventSources,
  saveSources = replaceAdminCoroAppEventSources,
  navigateTo,
  checkAdmin = getAdminAccess,
  onMissingSession,
  getSession = () => supabase.auth.getSession(),
}: Props) {
  const [sources, setSources] = useState<CoroAppEventSource[]>([]);
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;
        if (session.error || !session.data.session) {
          onMissingSession?.();
          if (!onMissingSession) setError("Acesso administrativo necessário.");
          return;
        }
        const access = await checkAdmin();
        if (!active) return;
        if (access.status !== "authorized") {
          onMissingSession?.();
          if (!onMissingSession) setError("Acesso administrativo necessário.");
          return;
        }
        const result = await loadSources();
        if (!active) return;
        setSources(result);
        setUrls(result.map(({ publicUrl }) => publicUrl).join("\n"));
      } catch {
        if (active) setError("Não foi possível carregar os eventos configurados.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [checkAdmin, getSession, loadSources, onMissingSession]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const publicUrls = urls
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await saveSources({ data: { publicUrls } });
      setSources(updated);
      setUrls(updated.map(({ publicUrl }) => publicUrl).join("\n"));
      setMessage("Eventos atualizados com sucesso.");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Não foi possível atualizar os eventos.",
      );
    } finally {
      setSaving(false);
    }
  };

  const Container = embedded ? "section" : "main";

  return (
    <Container
      className={
        embedded
          ? "space-y-5"
          : "mx-auto w-full max-w-4xl space-y-5 p-4 pb-24 sm:p-6 md:pb-6"
      }
    >
      {!embedded && <AdminNavigation current="settings" navigateTo={navigateTo} />}
      <div>
        <Badge variant="secondary" className="mb-2 gap-1">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Sincronização automática
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">Eventos do CoroApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe uma URL pública por linha. A ordem abaixo será a ordem do app do participante.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fonte oficial dos cantos</CardTitle>
          <CardDescription>
            As músicas, áudios e partituras continuam vindo do CoroApp; nenhum repertório é copiado
            para o Encontro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="coroapp-event-urls">URLs públicas dos eventos</Label>
              <Textarea
                id="coroapp-event-urls"
                value={urls}
                onChange={(event) => setUrls(event.target.value)}
                rows={Math.max(4, urls.split(/\r?\n/).length + 1)}
                placeholder="https://coroapp.lovable.app/.../events/..."
                spellCheck={false}
                disabled={loading || saving}
              />
              <p className="text-xs text-muted-foreground">
                Somente URLs HTTPS do domínio oficial são aceitas. O evento também precisa estar
                publicado no CoroApp.
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm font-medium text-emerald-700">
                {message}
              </p>
            )}
            <Button type="submit" disabled={loading || saving || !urls.trim()}>
              {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Salvar eventos
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="configured-events-title" className="space-y-2">
        <h2 id="configured-events-title" className="text-base font-semibold">
          Eventos configurados
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando eventos…</p>
        ) : sources.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum evento configurado.
          </p>
        ) : (
          <ol className="space-y-2">
            {sources.map((source) => (
              <li key={source.eventId} className="flex gap-3 rounded-xl border bg-card p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {source.sortOrder + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{source.eventName}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Link2 className="size-3 shrink-0" aria-hidden="true" />
                    {source.publicUrl}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Container>
  );
}
