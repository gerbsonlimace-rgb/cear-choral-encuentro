import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { searchEventAttendanceParticipants } from "@/lib/public-attendance.functions";
import type { AttendanceSearchPerson } from "./attendanceSearch.server";

export function AttendanceNameSearch({activityId,onOpenChange,onSelect,search=searchEventAttendanceParticipants}:{
 activityId:string;onOpenChange:(open:boolean)=>void;onSelect:(token:string)=>void;
 search?:(input:{data:{activityId:string;query:string}})=>Promise<AttendanceSearchPerson[]>;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[people,setPeople]=useState<AttendanceSearchPerson[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
 function changeOpen(value:boolean){setOpen(value);onOpenChange(value);if(!value){setQuery("");setPeople([]);setError("");}}
 useEffect(()=>{
  if(!open||query.trim().length<2){setPeople([]);setLoading(false);return;}
  let active=true;setLoading(true);setError("");setPeople([]);
  const timer=setTimeout(()=>{void search({data:{activityId,query:query.trim()}}).then(rows=>{if(active)setPeople(rows);}).catch(()=>{if(active)setError("Não foi possível buscar. Tente novamente.");}).finally(()=>{if(active)setLoading(false);});},250);
  return()=>{active=false;clearTimeout(timer);};
 },[query,open,activityId,search]);
 return <><Button variant="outline" className="min-h-11 shrink-0" onClick={()=>changeOpen(true)}><Search className="size-4"/>Buscar nome</Button>
  <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="internal-app attendance-theme flex max-h-[85dvh] flex-col overflow-hidden bg-white">
   <DialogHeader><DialogTitle>Buscar participante</DialogTitle><DialogDescription>Digite pelo menos 2 letras do nome. A presença será registrada nesta atividade.</DialogDescription></DialogHeader>
   <Input aria-label="Nome do participante" placeholder="Nome do participante" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)} className="min-h-11 shrink-0"/>
   {loading&&<p role="status" className="text-sm">Buscando…</p>}{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
   {!loading&&!error&&query.trim().length>=2&&!people.length&&<p role="status" className="text-sm">Nenhum participante confirmado encontrado.</p>}
   <ul className="min-h-0 overflow-y-auto divide-y">{people.map(person=><li key={person.token} className="flex flex-wrap items-center gap-2 py-3">
    <div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-semibold">{person.name}</p><p className="text-xs text-zinc-600">{person.choirName}</p></div>
    <Button disabled={person.attended||loading} className="min-h-11" onClick={()=>{onSelect(person.token);changeOpen(false);}}>{person.attended?"Já presente":"Marcar presença"}</Button>
   </li>)}</ul>
   {people.length===30&&<p className="text-xs text-zinc-600">Exibindo os primeiros 30. Digite mais partes do nome para refinar.</p>}
  </DialogContent></Dialog>
 </>;
}
