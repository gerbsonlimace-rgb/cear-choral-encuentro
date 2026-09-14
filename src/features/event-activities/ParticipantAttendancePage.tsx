import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, LocateFixed, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getParticipantAttendanceDashboard,
  prepareParticipantAttendance,
  recordParticipantAttendance,
} from "@/lib/event-activity.functions";
import { scanAttendanceQr } from "./attendanceQrScanner";
import type { AttendanceLocationInput, ParticipantAttendanceDashboard } from "./eventActivity.domain";
import type { AttendanceCheckInResult, AttendancePreparation } from "./eventActivity.server";
import { requestParticipantPosition } from "./participantGeolocation";

type DataFn<T, R> = (input: { data: T }) => Promise<R>;

type Props = {
  token: string;
  prepare?: DataFn<{ token: string }, AttendancePreparation>;
  checkIn?: DataFn<{ token: string; location: AttendanceLocationInput | null }, AttendanceCheckInResult>;
  loadDashboard?: () => Promise<ParticipantAttendanceDashboard>;
  requestPosition?: () => Promise<AttendanceLocationInput>;
  onBack(): void;
};

export function ParticipantAttendancePage({
  token,
  prepare = prepareParticipantAttendance,
  checkIn = recordParticipantAttendance,
  loadDashboard = getParticipantAttendanceDashboard,
  requestPosition = requestParticipantPosition,
  onBack,
}: Props) {
  const [status, setStatus] = useState<"idle" | "reading" | "checking" | "success" | "error">(token ? "checking" : "idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AttendanceCheckInResult | null>(null);
  const [dashboard, setDashboard] = useState<ParticipantAttendanceDashboard | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const dashboardRequest = useRef(0);

  const refreshDashboard = useCallback(async () => {
    const request = ++dashboardRequest.current;
    try {
      const updated = await loadDashboard();
      if (request === dashboardRequest.current) setDashboard(updated);
    } catch { /* Check-in stays usable if the summary is temporarily unavailable. */ }
  }, [loadDashboard]);

  const confirm = useCallback(async (signedToken: string) => {
    setStatus("checking"); setMessage(""); setResult(null);
    try {
      const activity = await prepare({ data: { token: signedToken } });
      let location: AttendanceLocationInput | null = null;
      if (activity.verifyLocation) {
        setMessage("Esta atividade verifica se você está no local. Autorize a localização para continuar.");
        location = await requestPosition();
      }
      const checked = await checkIn({ data: { token: signedToken, location } });
      setResult(checked);
      setMessage("");
      setStatus("success");
      await refreshDashboard();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível confirmar sua presença.");
      setStatus("error");
    }
  }, [checkIn, prepare, refreshDashboard, requestPosition]);

  useEffect(() => { void refreshDashboard(); }, [refreshDashboard]);
  useEffect(() => { if (token) void confirm(token); }, [confirm, token]);
  useEffect(() => () => abort.current?.abort(), []);

  const scan = async () => {
    if (!video.current) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus("reading"); setMessage("");
    try { await confirm(await scanAttendanceQr(video.current, abort.current.signal)); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível ler o QR Code."); setStatus("error"); }
  };

  return (
    <main className="chorister-app min-h-svh bg-white px-4 py-6 text-zinc-950">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center gap-3">
          <Button size="icon" variant="ghost" aria-label="Voltar ao portal" onClick={onBack}><ArrowLeft className="size-5" /></Button>
          <div><h1 className="text-2xl font-semibold tracking-[-0.02em]">Confirmar presença</h1><p className="mt-1 text-sm text-zinc-600">Leia o código exibido na entrada da atividade.</p></div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-3">
          <video ref={video} muted playsInline className="aspect-square w-full rounded-xl bg-zinc-900 object-cover" aria-label="Imagem da câmera para leitura do QR Code" />
          {!token && <Button className="mt-3 w-full" variant="secondary" disabled={status === "reading" || status === "checking"} onClick={() => void scan()}><Camera className="size-4" />{status === "reading" ? "Lendo QR Code…" : "Abrir câmera"}</Button>}
        </section>

        {(status === "checking" || status === "reading") && <div role="status" className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-4 text-sm"><RefreshCw className="size-5 animate-spin" />{message || (status === "reading" ? "Aponte a câmera para o QR Code." : "Validando sua presença…")}</div>}
        {status === "error" && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{message}<Button className="mt-3 w-full" variant="outline" onClick={() => token ? void confirm(token) : void scan()}>Tentar novamente</Button></div>}
        {status === "success" && result && <section className="rounded-2xl bg-emerald-50 p-5 text-emerald-950"><CheckCircle2 className="size-8" /><h2 className="mt-3 text-xl font-semibold">Presença confirmada</h2><p className="mt-1 text-sm">{result.activityTitle}</p>{result.distanceMeters !== null && <p className="mt-2 flex items-center gap-1 text-xs"><LocateFixed className="size-4" />Registro realizado a {Math.round(result.distanceMeters)} m do local.</p>}{result.status === "already_recorded" && <Badge className="mt-3" variant="secondary">Já registrada anteriormente</Badge>}</section>}

        {dashboard && <section aria-labelledby="attendance-summary" className="space-y-4 rounded-2xl border border-zinc-200 p-5"><div className="flex items-end justify-between gap-4"><div><h2 id="attendance-summary" className="font-semibold">Sua participação</h2><p className="mt-1 text-sm text-zinc-600">{dashboard.attended} de {dashboard.required} atividades com presença</p></div><strong className="text-3xl tabular-nums">{dashboard.percentage}%</strong></div><Progress value={dashboard.percentage} aria-label={`${dashboard.percentage}% de participação`} /><div className="divide-y">{dashboard.activities.map((activity) => <div key={activity.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{activity.title}</span><Badge variant={activity.attended ? "default" : "secondary"}>{activity.attended ? "Presente" : "Pendente"}</Badge></div>)}</div></section>}
      </div>
    </main>
  );
}
