import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import type { AdminRegistrationRow } from "./admin.domain";

type Status = {
  phase: string;
  busy: boolean;
  total: number;
  completed: number;
  registrationId?: string;
  pauseRequested?: boolean;
  error?: string;
  registrations: Record<string, "pending" | "sent" | "review">;
};
const endpoint = "http://127.0.0.1:4319";
const initial: Status = { phase: "idle", busy: false, total: 0, completed: 0, registrations: {} };

async function localRequest(route: string, body?: unknown): Promise<Status> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Entre na administração para enviar os cartões.");
  const response = await fetch(`${endpoint}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível controlar o envio.");
  return result;
}

export function canSelectWhatsAppRegistration(row: AdminRegistrationRow, registrations: Status["registrations"]) {
  return row.paymentStatus === "paid" && !row.cancelledAt && !["sent", "review"].includes(registrations[row.id]);
}

const noRows: AdminRegistrationRow[] = [];
export function useAdminWhatsApp(enabled: boolean, visibleRows: AdminRegistrationRow[] = noRows) {
  const [status, setStatus] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const mounted = useRef(false);
  const activeRequest = useRef(false);
  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    activeRequest.current = true;
    try {
      const next = await localRequest("/status");
      if (mounted.current) { setStatus(next); setConnected(true); }
    } catch {
      if (mounted.current) setConnected(false);
    } finally { activeRequest.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = enabled;
    if (!enabled) { setConnected(false); setStatus(initial); return; }
    void refresh();
    return () => { mounted.current = false; };
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !connected) return;
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(timer);
  }, [enabled, connected, refresh]);
  useEffect(() => {
    setSelectedIds((current) => {
      const visibleById = new Map(visibleRows.map((row) => [row.id, row]));
      const next = enabled ? current.filter((id) => {
        const row = visibleById.get(id);
        return !["sent", "review"].includes(status.registrations[id]) && (!row || canSelectWhatsAppRegistration(row, status.registrations));
      }) : [];
      return next.length === current.length ? current : next;
    });
  }, [enabled, visibleRows, status.registrations]);
  const command = useCallback(async (route: string, body: unknown) => {
    if (requesting) return;
    setRequesting(true);
    setError("");
    try { await localRequest(route, body); await refresh(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o envio."); }
    finally { if (mounted.current) setRequesting(false); }
  }, [refresh, requesting]);
  return { status, connected, requesting, error, refresh,
    selectedIds,
    toggleSelected: (row: AdminRegistrationRow, checked: boolean) => {
      if (!canSelectWhatsAppRegistration(row, status.registrations) || status.busy || requesting) return;
      setSelectedIds((current) => checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id));
    },
    selectPage: (rows: AdminRegistrationRow[], checked: boolean) => {
      if (status.busy || requesting) return;
      const ids = rows.filter((row) => canSelectWhatsAppRegistration(row, status.registrations)).map((row) => row.id);
      setSelectedIds((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
    },
    clearSelection: () => setSelectedIds([]),
    sendSelected: () => selectedIds.length ? command("/jobs", { registrationIds: selectedIds }) : Promise.resolve(),
    send: (registrationId?: string) => command("/jobs", registrationId ? { registrationId } : { scope: "all" }),
    pause: () => command("/pause", {}),
  };
}

export type AdminWhatsAppController = ReturnType<typeof useAdminWhatsApp>;

export function AdminWhatsAppToolbar({ controller, rows = noRows }: { controller: AdminWhatsAppController; rows?: AdminRegistrationRow[] }) {
  const { status, connected, requesting, error } = controller;
  const eligibleRows = rows.filter((row) => canSelectWhatsAppRegistration(row, status.registrations));
  const selectedOnPage = eligibleRows.filter((row) => controller.selectedIds.includes(row.id)).length;
  const phaseLabels: Record<string, string> = {
    idle: "Pronto para enviar", connecting: "Abrindo o WhatsApp no Chrome…",
    preparing: "Preparando o próximo cartão…", sending: "Enviando cartão…",
    sent: "Cartão enviado", complete: "Envios concluídos", paused: "Envio pausado", error: "Envio interrompido",
  };
  return (
    <section aria-label="Envio de cartões pelo WhatsApp" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4" aria-hidden="true" />Cartões pelo WhatsApp</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Imagem com a mensagem completa. Hospedagem incluída no texto somente para quem tem acomodação. “Enviar todos” percorre todas as inscrições confirmadas e não canceladas, independentemente dos filtros.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void controller.refresh()} disabled={requesting}>
            <RefreshCw className="size-4" aria-hidden="true" />{connected ? "Atualizar envios" : "Conectar serviço"}
          </Button>
          {status.busy ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void controller.pause()} disabled={requesting || status.pauseRequested}>
              <Pause className="size-4" aria-hidden="true" />{status.pauseRequested ? "Pausando…" : "Pausar após este cartão"}
            </Button>
          ) : (<>
            <Button type="button" className="min-h-11" onClick={() => void controller.sendSelected()} disabled={!connected || requesting || !controller.selectedIds.length}>
              <MessageCircle className="size-4" aria-hidden="true" />Enviar selecionados ({controller.selectedIds.length})
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void controller.send()} disabled={!connected || requesting}>
              <MessageCircle className="size-4" aria-hidden="true" />{requesting ? "Iniciando…" : "Enviar todos"}
            </Button>
          </>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
          <Checkbox className="size-5" checked={selectedOnPage === 0 ? false : selectedOnPage === eligibleRows.length ? true : "indeterminate"}
            disabled={!eligibleRows.length || status.busy || requesting}
            onCheckedChange={(checked) => controller.selectPage(rows, checked === true)} />
          Selecionar elegíveis desta página
        </label>
        <span aria-live="polite">{controller.selectedIds.length} selecionado(s). A seleção é mantida entre páginas.</span>
        {controller.selectedIds.length > 0 && <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={status.busy || requesting} onClick={controller.clearSelection}>Limpar seleção</Button>}
      </div>
      {!connected && <p className="text-xs text-muted-foreground">Neste computador, abra <strong>scripts/iniciar-whatsapp-inscricoes.cmd</strong> e clique em “Conectar serviço”. Se o Chrome pedir acesso à rede local, permita para conectar ao serviço deste computador.</p>}
      {connected && <div role="status" aria-live="polite" className="space-y-1 text-xs text-muted-foreground">
        <p>{phaseLabels[status.phase] || "Acompanhando envios"}{status.total > 0 ? ` · ${status.completed} de ${status.total} enviados nesta execução` : ""}. Os cartões já enviados são pulados; tentativas inconclusivas exigem revisão.</p>
        {status.total > 0 && <progress aria-label="Progresso dos envios" className="h-2 w-full max-w-md accent-primary" max={status.total} value={status.completed} />}
      </div>}
      {(error || status.error) && <p role="alert" className="text-sm text-destructive">{error || status.error}</p>}
    </section>
  );
}

export function AdminWhatsAppSelection({ row, controller }: { row: AdminRegistrationRow; controller: AdminWhatsAppController }) {
  return <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center" onClick={(event) => event.stopPropagation()}>
    <Checkbox className="size-5" aria-label={`Selecionar ${row.name} para envio por WhatsApp`}
      checked={controller.selectedIds.includes(row.id)}
      disabled={!canSelectWhatsAppRegistration(row, controller.status.registrations) || controller.status.busy || controller.requesting}
      onCheckedChange={(checked) => controller.toggleSelected(row, checked === true)} />
  </label>;
}

export function AdminRegistrationWhatsAppButton({ row, controller }: { row: AdminRegistrationRow; controller: AdminWhatsAppController }) {
  const state = controller.status.registrations[row.id];
  const eligible = row.paymentStatus === "paid" && !row.cancelledAt;
  const sending = controller.status.busy && controller.status.registrationId === row.id;
  return <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11"
    disabled={!eligible || !controller.connected || controller.status.busy || controller.requesting || state === "sent" || state === "review"}
    title={!eligible ? "Disponível para inscrições confirmadas e não canceladas" : state === "review" ? "Confira a conversa antes de repetir esta tentativa" : !controller.connected ? "Conecte o serviço local acima da lista" : undefined}
    aria-label={`Enviar cartão pelo WhatsApp para ${row.name}`} onClick={() => void controller.send(row.id)}>
    <MessageCircle className="size-4" aria-hidden="true" />{sending ? "Enviando…" : state === "sent" ? "Enviado" : state === "review" ? "Revisar envio" : "Enviar cartão"}
  </Button>;
}
