import { useState } from "react";
import { ArrowLeft, Download, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventAttendanceReport } from "@/lib/public-attendance.functions";
import { deliverFile } from "@/lib/file-download";
import type { PublicAttendanceActivity } from "./publicAttendance.domain";
import { buildAttendanceWhatsAppMessage, type AttendanceReport } from "./eventManagement.domain";

type PreparedReport = { report: AttendanceReport; file: { fileName: string; base64: string } };
type ChoirGroup = { name: string; attended: AttendanceReport["people"]; absent: AttendanceReport["people"] };

export function AttendanceReportsPanel({ activities, initialActivityId, loadReport=getEventAttendanceReport }: {
  activities: PublicAttendanceActivity[]; initialActivityId?: string|null;
  loadReport?: (input:{data:{activityId:string}})=>Promise<PreparedReport>;
}) {
  const [activityId,setActivityId]=useState<string|null>(null);
  const [data,setData]=useState<PreparedReport|null>(null),[file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [recipient,setRecipient]=useState("");
  const selected=activities.find(activity=>activity.id===activityId);

  async function openActivity(id:string){
    setActivityId(id);setData(null);setFile(null);setError("");setNotice("");setLoading(true);
    try{
      const next=await loadReport({data:{activityId:id}});
      const bytes=Uint8Array.from(atob(next.file.base64),character=>character.charCodeAt(0));
      setFile(new File([bytes],next.file.fileName,{type:"application/pdf"}));setData(next);
    }catch{setError("Não foi possível carregar esta chamada. Confira seu acesso e tente novamente.");}
    finally{setLoading(false);}
  }
  function backToActivities(){setActivityId(null);setData(null);setFile(null);setError("");setNotice("");}
  async function sharePdf(){
    if(!file)return;setNotice("");
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:"Relatório de presença"});return;}
      catch(cause){if((cause as DOMException).name==="AbortError")return;setNotice("Não foi possível abrir o compartilhamento. Baixe o PDF para anexá-lo.");return;}
    }
    await deliverFile(file,file.name);setNotice("PDF baixado.");
  }
  function shareAttendanceOnWhatsApp(){
    if(!data)return;
    const digits=recipient.replace(/\D/g,"");
    if(digits&&(digits.length<10||digits.length>15)){setNotice("Informe o telefone com DDD (até 15 dígitos) ou deixe o campo vazio para escolher o contato no WhatsApp.");return;}
    const url=new URL(digits?`https://wa.me/${digits}`:"https://wa.me/");
    url.searchParams.set("text",buildAttendanceWhatsAppMessage(data.report));
    const opened=window.open(url.toString(),"_blank","noopener,noreferrer");
    if(!opened)setNotice("O navegador bloqueou o WhatsApp. Permita a abertura da janela e tente novamente.");
  }

  if(!activityId)return <section className="attendance-reports" aria-label="Chamadas">
    <h2 className="text-sm font-semibold">Relatórios de presença</h2>
    <div className="attendance-report-list" aria-label="Atividades e presenças">
      {activities.map(activity=>{
        const percent=activity.totalConfirmed?Math.min(100,Math.round(activity.attended/activity.totalConfirmed*100)):0;
        return <button key={activity.id} type="button" onClick={()=>void openActivity(activity.id)} className="w-full border-b border-zinc-200 bg-white px-3 py-3 text-left last:border-b-0 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-600">
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{activity.title}</span><span className="text-xs text-zinc-500">{new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",day:"2-digit",month:"2-digit"}).format(new Date(`${activity.activityDate}T12:00:00Z`))}</span></div>
          <p className="mt-1 text-sm tabular-nums"><strong>{activity.attended}</strong> presentes <span className="text-zinc-500">· {activity.totalConfirmed} total</span></p>
          <progress className="mt-2 block h-1 w-full overflow-hidden rounded bg-zinc-200 accent-zinc-800 [&::-webkit-progress-bar]:bg-zinc-200 [&::-webkit-progress-value]:bg-zinc-800" aria-label={`${percent}% presentes em ${activity.title}`} max={Math.max(1,activity.totalConfirmed)} value={activity.attended}/>
        </button>;
      })}
      {activities.length===0&&<p className="p-4 text-sm text-zinc-600">Nenhuma atividade com chamada disponível.</p>}
    </div>
    {initialActivityId&&<p className="text-xs text-zinc-500">Selecione uma atividade para ver as presenças detalhadas.</p>}
  </section>;

  const report=data?.report;
  const groups:ChoirGroup[]=report?report.choirs.map(choir=>{
    const people=report.people.filter(person=>person.choirName===choir.name);
    return {name:choir.name,attended:people.filter(person=>Boolean(person.checkedInAt)),absent:people.filter(person=>!person.checkedInAt)};
  }):[];

  return <section className="attendance-reports" aria-label="Detalhes da chamada">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Voltar para os relatórios" className="min-h-9 min-w-9" onClick={backToActivities}><ArrowLeft className="size-4"/></Button>
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{selected?.title??report?.activity.title??"Relatório de presença"}</h2>{report&&<p className="text-xs text-zinc-600">{report.attended} presentes · {report.absent} faltantes · {report.total} confirmados</p>}</div>
      <Button variant="outline" size="icon" className="min-h-9 min-w-9" aria-label="Atualizar relatório" disabled={loading||!activityId} onClick={()=>void openActivity(activityId)}><RefreshCw className={`size-4 ${loading?"animate-spin":""}`}/></Button>
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs font-medium" htmlFor="attendance-whatsapp-recipient">WhatsApp de destino (opcional)
        <input id="attendance-whatsapp-recipient" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="DDD + telefone; vazio para escolher contato" value={recipient} onChange={event=>setRecipient(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal"/>
      </label>
      <Button className="min-h-10" disabled={!report||loading} onClick={shareAttendanceOnWhatsApp}><MessageCircle className="size-4"/>Compartilhar no WhatsApp</Button>
    </div>
    <div className="flex gap-2">
      <Button variant="outline" className="min-h-10 flex-1" disabled={!file||loading} onClick={()=>void sharePdf()}><Share2 className="size-4"/>Compartilhar PDF</Button>
      <Button variant="outline" className="min-h-10" disabled={!file||loading} onClick={()=>{if(file)void deliverFile(file,file.name);}}><Download className="size-4"/>Baixar PDF</Button>
    </div>
    {loading&&<p role="status" className="text-sm text-zinc-600">Carregando lista detalhada…</p>}
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="text-xs text-zinc-600">{notice}</p>}
    {report&&<div className="attendance-report-list" aria-label="Participantes agrupados por coro">
      {groups.map(group=><section key={group.name} className="border-b border-zinc-200 bg-white p-3 last:border-b-0">
        <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{group.name}</h3><span className="text-xs tabular-nums text-zinc-600">{group.attended.length} presentes · {group.absent.length} faltantes</span></div>
        <ul className="space-y-1.5">{[...group.attended.map(person=>({...person,status:"Presente"})),...group.absent.map(person=>({...person,status:"Faltante"}))].map(person=><li key={person.id} className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-1.5 text-sm"><span className="min-w-0 truncate">{person.name}</span><span className={`shrink-0 text-xs ${person.status==="Presente"?"text-emerald-700":"text-zinc-500"}`}>{person.status}</span></li>)}</ul>
      </section>)}
    </div>}
  </section>;
}
