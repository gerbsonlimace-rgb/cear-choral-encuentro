import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, ClipboardList, ChevronRight, Pause, RefreshCw, Volume2, VolumeX, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicAttendanceActivities, getPublicAttendanceConfirmation, recordPublicAttendance } from "@/lib/public-attendance.functions";
import { AttendanceReportsPanel } from "./AttendanceReportsPanel";
import { AttendanceNameSearch } from "./AttendanceNameSearch";
import { lockEventManagement } from "@/lib/public-attendance.functions";
import "./attendanceApp.css";
import { createAttendanceScanQueue, type ScanQueueSnapshot } from "./attendanceScanQueue";
import { startContinuousQrScanner } from "./continuousQrScanner";
import { dietaryRestrictionOptions, extractParticipantCardToken, mergeAttendanceProgress, type DietaryRestrictionKey, type PublicAttendanceActivity, type PublicAttendanceConfirmation, type PublicAttendanceLogisticsInput, type PublicAttendanceLogisticsResult, type PublicAttendanceResult } from "./publicAttendance.domain";

type Props = {
  canScan?: boolean;
  canReport?: boolean;
  loadActivities?: () => Promise<PublicAttendanceActivity[]>;
  record?: (input: { data: {activityId: string; token: string} }) => Promise<PublicAttendanceResult>;
  saveLogistics?: (input: {data: PublicAttendanceLogisticsInput}) => Promise<PublicAttendanceLogisticsResult>;
  startScanner?: typeof startContinuousQrScanner;
};
const emptyQueue: ScanQueueSnapshot = {pending:0,failed:0,active:0,queued:0};
const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
type ScanFeedback = { id: string; token: string; result: PublicAttendanceResult; details?: PublicAttendanceConfirmation; detailsPending?: boolean };

function QuickQuestion({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <fieldset className="min-w-0 rounded-lg border border-black/10 bg-white/70 px-3 py-2">
    <legend className="px-1 text-xs font-semibold">{label}</legend>
    <div className="flex gap-2">
      {([true, false] as const).map(answer => <label key={String(answer)} className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-sm font-medium ${value===answer?"border-zinc-800 bg-zinc-100":"border-zinc-200 bg-white"}`}>
        <input className="accent-zinc-900" type="radio" name={id} value={String(answer)} checked={value===answer} onChange={()=>onChange(answer)}/>
        {answer?"Sim":"Não"}
      </label>)}
    </div>
  </fieldset>;
}

function LogisticsAnswers({ id, token, loaded, loading, initialDietaryRestriction, initialDietaryRestrictionTypes, initialDietaryRestrictionOther, initialUsesEventVan, save }: {
  id: string;
  token: string;
  loaded: boolean;
  loading: boolean;
  initialDietaryRestriction: boolean | null;
  initialDietaryRestrictionTypes: DietaryRestrictionKey[];
  initialDietaryRestrictionOther: string | null;
  initialUsesEventVan: boolean | null;
  save: NonNullable<Props["saveLogistics"]>;
}) {
  const [dietaryRestriction,setDietaryRestriction]=useState(false);
  const [dietaryRestrictionTypes,setDietaryRestrictionTypes]=useState<DietaryRestrictionKey[]>([]);
  const [dietaryRestrictionOther,setDietaryRestrictionOther]=useState("");
  const [usesEventVan,setUsesEventVan]=useState(false);
  const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const hydrated=useRef(false);
  const pendingDietaryRestriction=useRef<boolean|null>(null),pendingUsesEventVan=useRef<boolean|null>(null);
  const pendingTypes=useRef<DietaryRestrictionKey[]|null>(null),pendingOther=useRef<string|null>(null);
  useEffect(()=>{
    if(!loaded||hydrated.current)return;
    setDietaryRestriction(pendingDietaryRestriction.current??(initialDietaryRestriction===true));
    setDietaryRestrictionTypes(pendingTypes.current??initialDietaryRestrictionTypes);
    setDietaryRestrictionOther(pendingOther.current??(initialDietaryRestrictionOther??""));
    setUsesEventVan(pendingUsesEventVan.current??(initialUsesEventVan===true));
    setSaved(initialDietaryRestriction!==null&&initialUsesEventVan!==null&&pendingDietaryRestriction.current===null&&pendingUsesEventVan.current===null&&pendingTypes.current===null&&pendingOther.current===null);
    hydrated.current=true;
  },[loaded,initialDietaryRestriction,initialDietaryRestrictionTypes,initialDietaryRestrictionOther,initialUsesEventVan]);
  const markDirty=()=>{setDirty(true);setSaved(false);setError("");};
  const changeDietary=(value:boolean)=>{
    markDirty();
    if(!hydrated.current){pendingDietaryRestriction.current=value;if(!value){pendingTypes.current=[];pendingOther.current="";}}
    setDietaryRestriction(value);
    if(!value){setDietaryRestrictionTypes([]);setDietaryRestrictionOther("");}
  };
  const changeType=(value:boolean,key:DietaryRestrictionKey)=>{
    markDirty();
    const next=value ? [...dietaryRestrictionTypes,key] : dietaryRestrictionTypes.filter(item=>item!==key);
    if(!hydrated.current){pendingTypes.current=next;if(!value&&key==="outra")pendingOther.current="";}
    setDietaryRestrictionTypes(next);
    if(!value&&key==="outra")setDietaryRestrictionOther("");
  };
  const changeOther=(value:string)=>{
    markDirty();
    if(!hydrated.current)pendingOther.current=value;
    setDietaryRestrictionOther(value);
  };
  const changeVan=(value:boolean)=>{
    markDirty();
    if(!hydrated.current)pendingUsesEventVan.current=value;
    setUsesEventVan(value);
  };
  const validationError=dietaryRestriction&&dietaryRestrictionTypes.length===0
    ? "Selecione ao menos uma restrição alimentar."
    : dietaryRestrictionTypes.includes("outra")&&!dietaryRestrictionOther.trim()
      ? "Descreva a outra restrição alimentar."
      : "";
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(validationError||!loaded)return;
    setSaving(true);setError("");
    const types=dietaryRestrictionOptions.map(option=>option.value).filter(value=>dietaryRestrictionTypes.includes(value));
    try{
      const response=await save({data:{token,dietaryRestriction,dietaryRestrictionTypes:types,dietaryRestrictionOther:types.includes("outra")?dietaryRestrictionOther.trim():null,usesEventVan}});
      setDietaryRestriction(response.dietaryRestriction);
      setDietaryRestrictionTypes(response.dietaryRestrictionTypes??[]);
      setDietaryRestrictionOther(response.dietaryRestrictionOther??"");
      setUsesEventVan(response.usesEventVan);
      setDirty(false);setSaved(true);
    }catch(cause){setError(cause instanceof Error&&cause.message.includes("migração")?cause.message:"Não foi possível salvar. Confira a conexão e tente novamente.");}
    finally{setSaving(false);}
  };
  const canSave=loaded&&!saving&&!validationError&&(dirty||!saved);
  return <form onSubmit={event=>void submit(event)} className="attendance-logistics mt-3 space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <QuickQuestion id={`food-${id}`} label="Tem restrição alimentar?" value={dietaryRestriction} onChange={changeDietary}/>
      <QuickQuestion id={`van-${id}`} label="Usará a van para traslado?" value={usesEventVan} onChange={changeVan}/>
    </div>
    {dietaryRestriction&&<fieldset className="rounded-lg border border-black/10 bg-white/70 px-3 py-2">
      <legend className="px-1 text-xs font-semibold">Quais restrições alimentares?</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {dietaryRestrictionOptions.map(option=><label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-sm">
          <input className="accent-zinc-900" type="checkbox" checked={dietaryRestrictionTypes.includes(option.value)} onChange={event=>changeType(event.target.checked,option.value)}/>
          {option.label}
        </label>)}
      </div>
      {dietaryRestrictionTypes.includes("outra")&&<label className="mt-2 block text-xs font-medium">
        Descreva a outra restrição
        <input className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-normal" value={dietaryRestrictionOther} maxLength={280} onChange={event=>changeOther(event.target.value)}/>
      </label>}
    </fieldset>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" variant="outline" disabled={!canSave}>{saving?"Salvando…":saved&&!dirty?"Respostas salvas":"Salvar respostas"}</Button>
      {!loaded&&loading&&<span className="text-xs text-zinc-600">Carregando respostas existentes…</span>}
      {!loaded&&!loading&&<span className="text-xs text-red-700">Não foi possível carregar os dados da inscrição.</span>}
      {saved&&!dirty&&<span role="status" className="text-xs text-zinc-600">Salvas na inscrição</span>}
      {validationError&&<span role="alert" className="text-xs text-red-700">{validationError}</span>}
      {error&&<span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  </form>;
}

function Progress({activity}: {activity: PublicAttendanceActivity}) {
  const percent=activity.totalConfirmed ? Math.min(100,Math.round(activity.attended/activity.totalConfirmed*100)) : 0;
  return <div>
    <div className="flex items-baseline justify-between gap-3"><p className="font-semibold tabular-nums">{activity.attended} de {activity.totalConfirmed} presentes</p><span className="text-sm tabular-nums text-zinc-600">{percent}%</span></div>
    <progress className="mt-2 h-2 w-full overflow-hidden rounded bg-zinc-200 accent-zinc-950 [&::-webkit-progress-bar]:bg-zinc-200 [&::-webkit-progress-value]:bg-zinc-950" aria-label={`Progresso de ${activity.title}`} max={Math.max(1,activity.totalConfirmed)} value={activity.attended}/>
  </div>;
}

export function PublicAttendancePage({canScan=true,canReport=true,loadActivities=getPublicAttendanceActivities,record=recordPublicAttendance,saveLogistics=async(input)=>(await import("@/lib/public-attendance.functions")).savePublicAttendanceLogistics(input),startScanner=startContinuousQrScanner}: Props) {
  const [tab,setTab]=useState<"scanner"|"reports">(canScan?"scanner":"reports");
  const [locking,setLocking]=useState(false);
  const [activities,setActivities]=useState<PublicAttendanceActivity[]|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [running,setRunning]=useState(false),[cameraReady,setCameraReady]=useState(false);
  const [error,setError]=useState(""),[refreshing,setRefreshing]=useState(false);
  const [pending,setPending]=useState(emptyQueue),[sound,setSound]=useState(true);
  const [feedback,setFeedback]=useState<ScanFeedback[]>([]);
  const video=useRef<HTMLVideoElement>(null);
  const feedbackSequence=useRef(0);
  const queue=useRef<ReturnType<typeof createAttendanceScanQueue<PublicAttendanceResult>>|null>(null);
  const audio=useRef<AudioContext|null>(null), soundEnabled=useRef(sound);
  const lastInvalid=useRef("");
  const resumeAfterSearch=useRef(false);
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
      onResult:(result,token)=>{
        const confirmed=result.status==="recorded"||result.status==="already_recorded";
        const feedbackId=String(++feedbackSequence.current);
        setFeedback(items=>[{id:feedbackId,token,result,detailsPending:confirmed},...items].slice(0,4));
        if(confirmed) void getPublicAttendanceConfirmation({data:{token}}).then(details=>{
          setFeedback(items=>items.map(item=>item.id===feedbackId?{...item,details,detailsPending:false}:item));
        }).catch(()=>{
          setFeedback(items=>items.map(item=>item.id===feedbackId?{...item,detailsPending:false}:item));
        });
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

  const enableAudio=(force=false)=>{if(!sound&&!force)return;try{if(!audio.current&&typeof AudioContext!=="undefined")audio.current=new AudioContext();void audio.current?.resume().catch(()=>{});}catch{/* Sound is optional. */}};
  const choose=(id:string)=>{enableAudio();setSelectedId(id);setRunning(true);};
  const back=()=>{if(queue.current?.snapshot().pending&&!window.confirm("Ainda há leituras sem confirmação. Sair descarta essas pendências deste aparelho. Deseja sair?"))return;setRunning(false);setSelectedId(null);setFeedback([]);setPending(emptyQueue);void refresh();};

  const currentFeedback=feedback[0];
  const switchTab=(next:"scanner"|"reports")=>{if(next===tab)return;setRunning(false);setTab(next);};
  return <main className="internal-app attendance-theme attendance-app">
    <div className="attendance-shell">
      <header className="attendance-header">
        <div className="flex min-w-0 items-center gap-1">
          {tab==="scanner"&&selectedId&&<Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Voltar às atividades" onClick={back}><ArrowLeft className="size-5"/></Button>}
          <div className="min-w-0"><h1>{tab==="scanner"&&selected?selected.title:"Gerenciamento do evento"}</h1><p className="text-xs text-zinc-600">{selected&&tab==="scanner"?`${dateLabel(selected.activityDate)} · ${selected.startsAt??"Sem horário"}`:"II Encontro de Coros"}</p></div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" className="min-h-11 min-w-11" aria-label="Atualizar contagem" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw className={`size-4 ${refreshing?"animate-spin":""}`}/></Button>
          <Button size="icon" variant="ghost" className="min-h-11 min-w-11" aria-label="Bloquear aplicativo" disabled={locking} onClick={()=>{if(queue.current?.snapshot().pending&&!window.confirm("Há leituras pendentes. Deseja bloquear mesmo assim?"))return;setRunning(false);setLocking(true);void lockEventManagement().then(()=>window.location.reload()).catch(()=>{setLocking(false);setError("Não foi possível bloquear. Tente novamente.");});}}><LockKeyhole className="size-4"/></Button>
        </div>
      </header>
      <div className="attendance-tabs" role="tablist" aria-label="Gerenciamento do evento">
        {canScan&&<button type="button" role="tab" id="attendance-scanner-tab" aria-label="Atividades e leitor QR" aria-selected={tab==="scanner"} aria-controls="attendance-scanner-panel" onClick={()=>switchTab("scanner")}><Camera aria-hidden="true" className="size-5"/><span>Leitor QR</span></button>}
        {canReport&&<button type="button" role="tab" id="attendance-reports-tab" aria-selected={tab==="reports"} aria-controls="attendance-reports-panel" onClick={()=>switchTab("reports")}><ClipboardList aria-hidden="true" className="size-5"/><span>Relatórios</span></button>}
      </div>
      {error&&<p role="alert" className="attendance-error">{error}</p>}
      {activities===null&&<p role="status" className="text-sm text-zinc-600">Carregando atividades…</p>}
      {tab==="reports"&&canReport&&activities&&<div role="tabpanel" id="attendance-reports-panel" aria-labelledby="attendance-reports-tab" className="attendance-view"><AttendanceReportsPanel activities={activities} initialActivityId={selectedId}/></div>}
      {tab==="scanner"&&canScan&&<div role="tabpanel" id="attendance-scanner-panel" aria-labelledby="attendance-scanner-tab" className="attendance-view">
        {!selectedId&&activities&&<section className="attendance-activities" aria-label="Atividades com presença">
          {activities.length===0&&<p className="p-4 text-sm text-zinc-600">Nenhuma atividade com presença habilitada.</p>}
          {activities.map(activity=><button key={activity.id} type="button" onClick={()=>choose(activity.id)} className="attendance-activity">
            <div className="mb-2 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{activity.title}</h2><p className="mt-1 text-xs text-zinc-600">{dateLabel(activity.activityDate)} · {activity.startsAt??"Sem horário"}</p></div><ChevronRight className="size-5 shrink-0"/></div>
            <Progress activity={activity}/>
          </button>)}
        </section>}
        {selected&&<>
          <section aria-label="Progresso da chamada" className="shrink-0 rounded-xl border bg-white px-3 py-2"><Progress activity={selected}/><p className="text-xs text-zinc-600">{Math.max(0,selected.totalConfirmed-selected.attended)} faltantes · inscrições confirmadas</p></section>
          <AttendanceNameSearch key={selected.id} activityId={selected.id} attendedTokens={feedback.filter(item=>item.result.status==="recorded"||item.result.status==="already_recorded").map(item=>item.token)} onOpenChange={open=>{if(open){resumeAfterSearch.current=running;setRunning(false);}else setRunning(resumeAfterSearch.current);}} onSelect={token=>{enableAudio();const state=queue.current?.enqueue(token);if(state==="full")setError("Há muitas leituras pendentes. Aguarde a confirmação e tente novamente.");}}/>
          <div className="attendance-scanner-workspace">
          <div className="attendance-scanner-capture">
          <section className="attendance-camera" aria-label="Leitor QR">
            <video ref={video} muted playsInline autoPlay aria-label="Câmera para leitura contínua de QR Codes"/>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><div className="attendance-target"/></div>
            <p role="status" className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1 text-center text-xs text-white">{running?(cameraReady?"Leitura contínua · próximo cartão":"Abrindo câmera…"):"Câmera pausada"}</p>
          </section>
          <div className="attendance-controls"><Button className="min-h-11 flex-1" onClick={()=>{enableAudio();setRunning(value=>!value);}}>{running?<Pause className="size-4"/>:<Camera className="size-4"/>}{running?"Pausar câmera":"Retomar câmera"}</Button>
            <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={sound?"Desligar som":"Ligar som"} aria-pressed={sound} onClick={()=>{setSound(value=>!value);if(!sound)enableAudio(true);}}>{sound?<Volume2 className="size-5"/>:<VolumeX className="size-5"/>}</Button></div>
          </div>
          <div className="attendance-scanner-results" role="region" aria-label="Identificação e perguntas do participante" tabIndex={0}>
          {pending.pending>0&&<section className="shrink-0 rounded-lg bg-amber-50 p-2 text-xs text-amber-950" aria-live="polite"><p>{pending.pending} leitura{pending.pending===1?"":"s"} aguardando confirmação{pending.failed?` · ${pending.failed} com falha`:"…"}</p>{pending.failed>0&&<Button className="mt-1 min-h-11" size="sm" variant="outline" onClick={()=>queue.current?.retryFailed()}>Tentar pendentes novamente</Button>}</section>}
          <section aria-label="Últimas leituras" aria-live="polite" className="attendance-latest-read">
            {currentFeedback?<div className="attendance-feedback" data-state={currentFeedback.result.status==="recorded"?"success":currentFeedback.result.status==="already_recorded"?"duplicate":"error"}>
              {"participantName" in currentFeedback.result?<>
                <div className="identity">{currentFeedback.details?.photoUrl?<img src={currentFeedback.details.photoUrl} alt={`Foto de ${currentFeedback.result.participantName}`}/>:<div className="attendance-avatar grid place-items-center text-sm font-bold" aria-label="Foto indisponível">{currentFeedback.result.participantName.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</div>}
                <div className="min-w-0 flex-1"><h2>{currentFeedback.details?.fullName??currentFeedback.result.participantName}</h2><p>{currentFeedback.result.status==="recorded"?"Presença confirmada":"Já registrado · não conta novamente"}</p><p>{currentFeedback.details?.choirName??(currentFeedback.detailsPending?"Carregando coro…":"Coro indisponível")}</p><p>{currentFeedback.details?.lodging?`Quarto: ${currentFeedback.details.lodging.room}`:currentFeedback.detailsPending?"Carregando acomodação…":"Sem quarto/apartamento atribuído"}</p></div></div>
                <LogisticsAnswers key={currentFeedback.id} id={currentFeedback.id} token={currentFeedback.token} loaded={currentFeedback.details!==undefined} loading={Boolean(currentFeedback.detailsPending)} initialDietaryRestriction={currentFeedback.details?.dietaryRestriction??null} initialDietaryRestrictionTypes={currentFeedback.details?.dietaryRestrictionTypes??[]} initialDietaryRestrictionOther={currentFeedback.details?.dietaryRestrictionOther??null} initialUsesEventVan={currentFeedback.details?.usesEventVan??null} save={saveLogistics}/>
              </>:<p>{currentFeedback.result.message}</p>}
            </div>:<p className="p-2 text-center text-xs text-zinc-600">Aproxime o QR do cartão. A câmera continua aberta após cada leitura.</p>}
          </section>
          </div>
          </div>
        </>}
        {selectedId&&!selected&&activities!==null&&<div><p className="text-sm">Atividade indisponível.</p><Button onClick={back}>Voltar às atividades</Button></div>}
      </div>}
    </div>
  </main>;
}
