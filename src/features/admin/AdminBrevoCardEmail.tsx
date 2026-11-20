import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Pause, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

type BrevoStatus = {
  phase: string; busy: boolean; configured: boolean; testEmailConfigured: boolean; testSent: boolean; testEmail?: string;
  total: number; completed: number; sent: number; review: number; failed: number; skipped: number; missingEmail?: number; error?: string;
};
const endpoint = "http://127.0.0.1:4320";
const initial: BrevoStatus = { phase: "idle", busy: false, configured: false, testEmailConfigured: false, testSent: false, total: 0, completed: 0, sent: 0, review: 0, failed: 0, skipped: 0 };

async function localRequest(route: string, body?: unknown): Promise<BrevoStatus> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Entre na administração para enviar os cartões.");
  const response = await fetch(`${endpoint}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível controlar o envio pelo Brevo.");
  return result;
}

export function AdminBrevoCardEmail({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmReview, setConfirmReview] = useState(false);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = await localRequest("/status");
      if (mounted.current) { setStatus(next); setConnected(true); }
    } catch {
      if (mounted.current) setConnected(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = enabled;
    if (!enabled) { setConnected(false); setStatus(initial); return; }
    void refresh();
    return () => { mounted.current = false; };
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !connected) return;
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [enabled, connected, refresh]);
  const command = useCallback(async (mode: "test" | "all" | "review" | "pause") => {
    if (requesting) return;
    setRequesting(true); setError("");
    try { await localRequest(mode === "pause" ? "/pause" : "/jobs", mode === "pause" ? {} : { mode }); await refresh(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o envio."); }
    finally { if (mounted.current) setRequesting(false); }
  }, [refresh, requesting]);
  const phaseLabels: Record<string, string> = {
    idle: "Pronto para enviar", preparing: "Conferindo inscrições e imagens…", sending: "Enviando uma imagem por e-mail…",
    complete: "Envio concluído", paused: "Envio pausado", error: "Envio interrompido",
  };

  return <section aria-label="Envio de cartões por e-mail" className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4" aria-hidden="true" />Cartões por e-mail · Brevo</h2>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Cada participante recebe somente o próprio PNG com QR code, em mensagem individual. O teste envia o cartão de Gerbson para {status.testEmail || "o e-mail de teste configurado"}; confira-o antes de iniciar o lote.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void refresh()} disabled={requesting}>
          <RefreshCw className="size-4" aria-hidden="true" />{connected ? "Atualizar Brevo" : "Conectar serviço"}
        </Button>
        {status.busy ? <Button type="button" variant="outline" className="min-h-11" onClick={() => void command("pause")} disabled={requesting}>
          <Pause className="size-4" aria-hidden="true" />Pausar após este e-mail
        </Button> : <>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void command("test")} disabled={!connected || !status.configured || requesting || !status.testEmailConfigured}>
            <Send className="size-4" aria-hidden="true" />{status.testSent ? "Teste aceito pelo Brevo" : "Enviar teste para Gerbson"}
          </Button>
          <Button type="button" className="min-h-11" onClick={() => setConfirmAll(true)} disabled={!connected || !status.configured || !status.testSent || requesting}>
            <Mail className="size-4" aria-hidden="true" />Enviar todos os cartões
          </Button>
          {status.review > 0 && <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmReview(true)} disabled={!connected || !status.configured || requesting}>
            Rever envio incerto ({status.review})
          </Button>}
        </>}
      </div>
    </div>
    {!connected && <p className="text-xs text-muted-foreground">Abra <strong>scripts/iniciar-brevo-cartoes.cmd</strong> neste computador e depois clique em “Conectar serviço”. Configure as variáveis de acesso do Brevo em <strong>.env.local</strong>; a chave fica somente no serviço local.</p>}
    {connected && !status.configured && <p className="text-xs text-amber-800">O serviço local está ativo, mas ainda faltam configurações do Brevo em .env.local. A tela não recebe nem exibe a chave.</p>}
    {connected && status.busy && <div role="status" aria-live="polite" className="space-y-1 text-xs text-muted-foreground">
      <p>{phaseLabels[status.phase] || "Acompanhando envios"} · {status.completed} de {status.total} processados · {status.sent} aceitos pelo Brevo{status.review ? ` · ${status.review} para conferir` : ""}{status.skipped ? ` · ${status.skipped} já enviados, ignorados` : ""}</p>
      {status.total > 0 && <progress aria-label="Progresso dos e-mails" className="h-2 w-full max-w-md accent-primary" max={status.total} value={status.completed} />}
    </div>}
    {connected && status.testSent && !status.busy && <p role="status" className="text-xs text-muted-foreground">O teste foi aceito pelo Brevo e enviado para {status.testEmail}. Confira a caixa de entrada antes de iniciar o lote.</p>}
    {connected && !status.busy && status.phase !== "idle" && <p role="status" className="text-xs text-muted-foreground">{phaseLabels[status.phase] || status.phase}{status.sent ? ` · ${status.sent} aceitos pelo Brevo` : ""}{status.failed ? ` · ${status.failed} rejeitados` : ""}{status.review ? ` · ${status.review} para conferir` : ""}{status.skipped ? ` · ${status.skipped} ignorados por já terem sido enviados` : ""}{status.missingEmail ? ` · ${status.missingEmail} sem e-mail ou imagem válida` : ""}</p>}
    {(error || status.error) && <p role="alert" className="text-sm text-destructive">{error || status.error}</p>}
    <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Enviar os cartões individuais por e-mail?</AlertDialogTitle>
          <AlertDialogDescription>O sistema vai enviar um e-mail separado a cada inscrição paga e não cancelada com endereço válido, anexando apenas a imagem PNG daquela pessoa. Envio de teste e envios anteriores não serão repetidos automaticamente.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={requesting || status.busy} onClick={() => void command("all")}>Iniciar envio</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmReview} onOpenChange={setConfirmReview}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Reenviar as tentativas em revisão?</AlertDialogTitle>
          <AlertDialogDescription>O Brevo não confirmou {status.review} tentativa(s). Confira os logs do Brevo para evitar duplicatas antes de reenviar essas imagens.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={requesting || status.busy} onClick={() => void command("review")}>Reenviar tentativas em revisão</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
