import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventAttendanceReport } from "@/lib/public-attendance.functions";
import { deliverFile } from "@/lib/file-download";
import type { PublicAttendanceActivity } from "./publicAttendance.domain";
import type { AttendanceReport } from "./eventManagement.domain";

type PreparedReport = { report: AttendanceReport; file: { fileName: string; base64: string } };
type Group = "choirs"|"attended"|"absent"|"van"|"dietary"|"vanUnknown"|"dietaryUnknown";
export function AttendanceReportsPanel({ activities, initialActivityId, loadReport=getEventAttendanceReport }: {
  activities: PublicAttendanceActivity[]; initialActivityId?: string|null;
  loadReport?: (input:{data:{activityId:string}})=>Promise<PreparedReport>;
}) {
  const [activityId,setActivityId]=useState(initialActivityId || activities[0]?.id || "");
  const [group,setGroup]=useState<Group>("choirs"),[data,setData]=useState<PreparedReport|null>(null);
  const [file,setFile]=useState<File|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const revision=useRef(0);
  const load=useCallback(async()=>{
    if(!activityId)return;const current=++revision.current;setLoading(true);setFile(null);setData(null);setError("");setNotice("");
    try{const next=await loadReport({data:{activityId}});if(current!==revision.current)return;
      const bytes=Uint8Array.from(atob(next.file.base64),c=>c.charCodeAt(0));
      setFile(new File([bytes],next.file.fileName,{type:"application/pdf"}));setData(next);
    }catch{if(current===revision.current)setError("Não foi possível preparar o relatório. Confira seu acesso e tente novamente.");}
    finally{if(current===revision.current)setLoading(false);}
  },[activityId,loadReport]);
  useEffect(()=>{void load();return()=>{revision.current++;};},[load]);
  async function share(){
    if(!file)return;setNotice("");
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:"Relatório do encontro"});return;}
      catch(cause){if((cause as DOMException).name==="AbortError")return;setNotice("O compartilhamento não abriu. Baixe o PDF e anexe no WhatsApp.");return;}
    }
    await deliverFile(file,file.name);setNotice("PDF baixado. Anexe esse arquivo na conversa do WhatsApp.");
  }
  const report=data?.report;
  const lists=report?{
    attended:report.people.filter(p=>p.checkedInAt),absent:report.people.filter(p=>!p.checkedInAt),van:report.people.filter(p=>p.usesEventVan===true),
    dietary:report.people.filter(p=>p.dietaryRestriction===true),vanUnknown:report.people.filter(p=>p.usesEventVan===null),dietaryUnknown:report.people.filter(p=>p.dietaryRestriction===null),
  }:null;
  return <section className="attendance-reports" aria-label="Relatórios do evento">
    <div className="attendance-report-controls">
      <label className="min-w-0 flex-1 text-xs font-medium">Atividade
        <select aria-label="Atividade do relatório" className="mt-1 h-11 w-full rounded-md border bg-white px-2 text-sm" value={activityId} onChange={event=>setActivityId(event.target.value)}>
          {activities.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </label>
      <Button variant="outline" className="min-h-11" aria-label="Atualizar relatório" disabled={loading||!activityId} onClick={()=>void load()}><RefreshCw className="size-4"/></Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11 flex-1" disabled={!file||loading} onClick={()=>void share()}><Share2 className="size-4"/>Compartilhar PDF</Button>
      <Button variant="outline" className="min-h-11" disabled={!file||loading} onClick={()=>{if(file)void deliverFile(file,file.name);}}><Download className="size-4"/>Baixar PDF</Button>
    </div>
    <p className="text-xs text-zinc-600">No celular, escolha WhatsApp no menu de compartilhamento. O PDF inclui todas as listas da atividade.</p>
    {loading&&<p role="status" className="text-sm text-zinc-600">Preparando relatório e PDF completos…</p>}
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="text-xs text-zinc-600">{notice}</p>}
    {report&&<>
      <dl className="attendance-report-metrics">
        {[["Confirmados",report.total],["Presentes",report.attended],["Ausentes",report.absent],["Van",report.van],["Restrição alimentar",report.dietary]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <label className="text-xs font-medium">Exibir lista
        <select aria-label="Lista do relatório" className="mt-1 h-11 w-full rounded-md border bg-white px-2 text-sm" value={group} onChange={e=>setGroup(e.target.value as Group)}>
          <option value="choirs">Totais por coro ({report.choirs.length})</option><option value="attended">Presentes ({report.attended})</option><option value="absent">Ausentes ({report.absent})</option>
          <option value="van">Usarão a van ({report.van})</option><option value="dietary">Restrições alimentares ({report.dietary})</option>
          <option value="vanUnknown">Van não informada ({report.vanUnknown})</option><option value="dietaryUnknown">Alimentação não informada ({report.dietaryUnknown})</option>
        </select>
      </label>
      <div className="attendance-report-list" tabIndex={0} aria-label="Conteúdo do relatório">
        {group==="choirs"?<table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white"><tr><th className="p-2">Coro</th><th className="p-2">Total</th><th className="p-2">Pres.</th><th className="p-2">Aus.</th></tr></thead><tbody>{report.choirs.map(c=><tr key={c.name} className="border-t"><td className="p-2">{c.name}</td><td className="p-2 tabular-nums">{c.total}</td><td className="p-2 tabular-nums">{c.attended}</td><td className="p-2 tabular-nums">{c.absent}</td></tr>)}</tbody></table>
          :<ul className="divide-y">{lists?.[group].map(p=><li key={p.id} className="p-3"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-zinc-600">{p.choirName}</p>{group==="dietary"&&<p className="mt-1 text-xs">{p.dietaryDescription}</p>}{group==="attended"&&p.checkedInAt&&<p className="text-xs text-zinc-600">{new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short",timeStyle:"short"}).format(new Date(p.checkedInAt))}</p>}</li>)}{lists?.[group].length===0&&<li className="p-3 text-sm text-zinc-600">Nenhum participante nesta lista.</li>}</ul>}
      </div>
      <p className="text-xs text-zinc-500">Atualizado às {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",hour:"2-digit",minute:"2-digit"}).format(new Date(report.generatedAt))}. Van e alimentação consideram todos os confirmados, presentes ou ausentes.</p>
    </>}
  </section>;
}
