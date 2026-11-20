import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCheck, ChevronRight, Pause, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicAttendanceActivities, recordPublicAttendance } from "@/lib/public-attendance.functions";
import { createAttendanceScanQueue, type ScanQueueSnapshot } from "./attendanceScanQueue";
import { startContinuousQrScanner } from "./continuousQrScanner";
import { extractParticipantCardToken, mergeAttendanceProgress, type PublicAttendanceActivity, type PublicAttendanceResult } from "./publicAttendance.domain";

type Props = {
  loadActivities?: () => Promise<PublicAttendanceActivity[]>;
  record?: (input: { data: {activityId: string; token: string} }) => Promise<PublicAttendanceResult>;
  startScanner?: typeof startContinuousQrScanner;
};
const emptyQueue: ScanQueueSnapshot = {pending:0,failed:0,active:0,queued:0};
const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));

function Progress({activity}: {activity: PublicAttendanceActivity}) {
  const percent=activity.totalConfirmed ? Math.min(100,Math.round(activity.attended/activity.totalConfirmed*100)) : 0;
  return <div>
    <div className="flex items-baseline justify-between gap-3"><p className="font-semibold tabular-nums">{activity.attended} de {activity.totalConfirmed} presentes</p><span className="text-sm tabular-nums text-zinc-600">{percent}%</span></div>
    <progress className="mt-2 h-2 w-full overflow-hidden rounded bg-zinc-200 accent-zinc-950 [&::-webkit-progress-bar]:bg-zinc-200 [&::-webkit-progress-value]:bg-zinc-950" aria-label={`Progresso de ${activity.title}`} max={Math.max(1,activity.totalConfirmed)} value={activity.attended}/>
  </div>;
}

export function PublicAttendancePage({loadActivities=getPublicAttendanceActivities,record=recordPublicAttendance,startScanner=startContinuousQrScanner}: Props) {
  const [activities,setActivities]=useState<PublicAttendanceActivity[]|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [running,setRunning]=useState(false),[cameraReady,setCameraReady]=useState(false);
  const [error,setError]=useState(""),[refreshing,setRefreshing]=useState(false);
  const [pending,setPending]=useState(emptyQueue),[sound,setSound]=useState(true);
  const [feedback,setFeedback]=useState<PublicAttendanceResult[]>([]);
  const video=useRef<HTMLVideoElement>(null);
  const queue=useRef<ReturnType<typeof createAttendanceScanQueue<PublicAttendanceResult>>|null>(null);
  const audio=useRef<AudioContext|null>(null), soundEnabled=useRef(sound);
  const lastInvalid=useRef("");
  soundEnabled.current=sound;
  const selected=activities?.find(a=>a.id===selectedId);

  const refresh=useCallback(async()=>{
    setRefreshing(true);
    try {
      const next=await loadActivities();
      setActivities(current=>next.map(row=>{const previous=current?.find(item=>item.id===row.id);return previous?mergeAttendanceProgress(previous,row):row;}));
      setError("");
    } catch { setError("Não foi possível atualizar a chamada. Confira a internet e tente novamente."); }
    finally { setRefreshing(false); }
  },[loadActivities]);
  useEffect(()=>{void refresh();const interval=window.setInterval(()=>void refresh(),10000);
    const focus=()=>void refresh();window.addEventListener("focus",focus);
    return()=>{window.clearInterval(interval);window.removeEventListener("focus",focus);};},[refresh]);

  useEffect(()=>{
    if(!selectedId) return;
    const current=createAttendanceScanQueue<PublicAttendanceResult>({
      submit:token=>record({data:{activityId:selectedId,token}}),onChange:setPending,
      onResult:result=>{
        setFeedback(items=>[result,...items].slice(0,4));
        if(result.status==="recorded"||result.status==="already_recorded") {
          setActivities(items=>items?.map(item=>mergeAttendanceProgress(item,result.activity))??null);
          if(soundEnabled.current&&audio.current?.state==="running") {
            const oscillator=audio.current.createOscillator(),gain=audio.current.createGain();
            oscillator.connect(gain);gain.connect(audio.current.destination);
            oscillator.frequency.value=result.status==="recorded"?1046:523;
            gain.gain.setValueAtTime(0.12,audio.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001,audio.current.currentTime+0.09);
            oscillator.start();oscillator.stop(audio.current.currentTime+0.1);
          }
        }
      },
    });
    queue.current=current;setPending(emptyQueue);setFeedback([]);lastInvalid.current="";
    return()=>{current.dispose();if(queue.current===current)queue.current=null;};
  },[selectedId,record]);
  useEffect(()=>{
    if(!running||!selectedId||!video.current) return;
    const abort=new AbortController();let stop:(()=>void)|undefined;
    setCameraReady(false);setError("");
    void startScanner(video.current,raw=>{
      let token: string;
      try {token=extractParticipantCardToken(raw);lastInvalid.current="";}
      catch {if(lastInvalid.current!==raw){lastInvalid.current=raw;setError("Este QR não é um cartão de participante. Apresente o cartão individual do evento.");}return;}
      const state=queue.current?.enqueue(token);
      if(state==="full") {setRunning(false);setError("Há muitas leituras aguardando a internet. Confirme as pendentes e apresente este cartão novamente.");}
      else if(state==="queued")setError("");
    },abort.signal,undefined,caught=>{setError(caught.message);setRunning(false);})
      .then(cleanup=>{stop=cleanup;if(abort.signal.aborted)cleanup();else setCameraReady(true);})
      .catch(caught=>{if(abort.signal.aborted)return;setRunning(false);setError(caught?.name==="NotAllowedError"?"Permita o acesso à câmera no navegador e toque em Retomar câmera.":"Não foi possível abrir a câmera. Confira a permissão e tente novamente.");});
    return()=>{abort.abort();stop?.();setCameraReady(false);};
  },[running,selectedId,startScanner]);
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(queue.current?.snapshot().pending){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard);
  },[]);
  useEffect(()=>()=>{void audio.current?.close().catch(()=>{});},[]);

  const enableAudio=()=>{if(!sound)return;try{if(!audio.current&&typeof AudioContext!=="undefined")audio.current=new AudioContext();void audio.current?.resume().catch(()=>{});}catch{/* Sound is optional. */}};
  const choose=(id:string)=>{enableAudio();setSelectedId(id);setRunning(true);};
  const back=()=>{if(queue.current?.snapshot().pending&&!window.confirm("Ainda há leituras sem confirmação. Sair descarta essas pendências deste aparelho. Deseja sair?"))return;setRunning(false);setSelectedId(null);setFeedback([]);setPending(emptyQueue);void refresh();};

  return <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 py-5 text-zinc-950 sm:py-8">
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {selectedId&&<Button variant="ghost" size="icon" aria-label="Voltar às atividades" onClick={back}><ArrowLeft className="size-5"/></Button>}
          <div><h1 className="text-2xl font-bold tracking-tight">{selected?.title??"Chamada do encontro"}</h1>
            <p className="mt-1 text-sm text-zinc-600">{selected?`${dateLabel(selected.activityDate)} · ${selected.startsAt??"Sem horário"}`:"Escolha a atividade e leia os cartões dos participantes."}</p></div>
        </div>
        <Button size="icon" variant="outline" aria-label="Atualizar contagem" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw className={`size-4 ${refreshing?"animate-spin":""}`}/></Button>
      </header>
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {activities===null&&<p role="status" className="py-8 text-sm text-zinc-600">Carregando atividades…</p>}
      {!selectedId&&activities&&<section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-label="Atividades com presença">
        {activities.length===0&&<p className="p-5 text-sm text-zinc-600">Nenhuma atividade está com presença habilitada.</p>}
        {activities.map(activity=><button key={activity.id} type="button" onClick={()=>choose(activity.id)} className="block w-full border-b border-zinc-200 p-4 text-left transition-colors last:border-0 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#d5a900] sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-4"><div><h2 className="font-semibold leading-snug">{activity.title}</h2><p className="mt-1 text-sm text-zinc-600">{dateLabel(activity.activityDate)} · {activity.startsAt??"Sem horário"}{activity.endsAt?`–${activity.endsAt}`:""}</p></div><ChevronRight className="mt-1 size-5 shrink-0 text-zinc-500"/></div>
          <Progress activity={activity}/>
        </button>)}
      </section>}
      {selected&&<>
        <section className="rounded-xl border border-zinc-200 bg-white p-4" aria-label="Progresso da chamada">
          <Progress activity={selected}/><div className="mt-3 flex justify-between gap-4 text-sm text-zinc-600"><span className="tabular-nums">{Math.max(0,selected.totalConfirmed-selected.attended)} faltantes</span><span>Somente inscrições confirmadas</span></div>
        </section>
        <section className="overflow-hidden rounded-xl bg-zinc-950">
          <div className="relative"><video ref={video} muted playsInline autoPlay className="aspect-[4/3] max-h-[44svh] w-full object-cover" aria-label="Câmera para leitura contínua de QR Codes"/>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><div className="aspect-square w-[58%] rounded-xl border-2 border-white/80"/></div>
            <p role="status" className="absolute bottom-0 left-0 right-0 bg-black/75 px-3 py-2 text-center text-sm text-white">{running?(cameraReady?"Leitura contínua · apresente o próximo cartão":"Abrindo câmera…"):"Câmera pausada"}</p>
          </div>
          <div className="flex gap-2 p-3"><Button className="flex-1 bg-white text-zinc-950 hover:bg-zinc-200" onClick={()=>{enableAudio();setRunning(value=>!value);}}>{running?<Pause className="size-4"/>:<Camera className="size-4"/>}{running?"Pausar câmera":"Retomar câmera"}</Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-800 hover:text-white" aria-label={sound?"Desligar som":"Ligar som"} aria-pressed={sound} onClick={()=>{setSound(value=>!value);if(!sound){try{if(!audio.current&&typeof AudioContext!=="undefined")audio.current=new AudioContext();void audio.current?.resume().catch(()=>{});}catch{}}}}>{sound?<Volume2 className="size-5"/>:<VolumeX className="size-5"/>}</Button></div>
        </section>
        {pending.pending>0&&<section className={`rounded-lg p-3 text-sm ${pending.failed?"bg-amber-50 text-amber-950":"bg-zinc-200 text-zinc-800"}`} aria-live="polite"><p>{pending.pending} leitura{pending.pending===1?"":"s"} aguardando confirmação{pending.failed?` · ${pending.failed} com falha de conexão`:"…"}</p>{pending.failed>0&&<Button className="mt-2" variant="outline" onClick={()=>queue.current?.retryFailed()}>Tentar pendentes novamente</Button>}</section>}
        <section aria-label="Últimas leituras" aria-live="polite" className="space-y-2">
          {feedback.map((item,index)=>{const success=item.status==="recorded",duplicate=item.status==="already_recorded";return <div key={`${index}-${"checkedInAt" in item?item.checkedInAt:item.status}`} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${success?"bg-emerald-100 text-emerald-950":duplicate?"bg-amber-100 text-amber-950":"bg-red-50 text-red-800"}`}>
            {success?<Check className="size-6 shrink-0"/>:duplicate?<CheckCheck className="size-6 shrink-0"/>:null}<div>{"participantName" in item?<><p className="font-semibold">{item.participantName}</p><p className="text-sm">{success?"Presença confirmada":"Já registrado · não conta novamente"}</p></>:<p className="text-sm">{item.message}</p>}</div></div>;})}
          {feedback.length===0&&<p className="text-center text-sm text-zinc-600">Aproxime o QR Code do cartão. A câmera continua aberta após cada leitura.</p>}
        </section>
      </>}
      {selectedId&&!selected&&activities!==null&&<div className="space-y-3"><p>Esta atividade não está mais disponível.</p><Button onClick={back}>Voltar às atividades</Button></div>}
    </div>
  </main>;
}
