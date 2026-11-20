import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { searchEventAttendanceParticipants } from "@/lib/public-attendance.functions";
import type { AttendanceSearchPerson } from "./attendanceSearch.server";

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
export function AttendanceNameSearch({activityId,onOpenChange,onSelect,attendedTokens=[],search=searchEventAttendanceParticipants}:{
 activityId:string;onOpenChange:(open:boolean)=>void;onSelect:(token:string)=>void;
 attendedTokens?:string[];
 search?:(input:{data:{activityId:string;query:string}})=>Promise<AttendanceSearchPerson[]>;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[directory,setDirectory]=useState<AttendanceSearchPerson[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const revision=useRef(0),loadedAt=useRef(0);
 const load=useCallback(async()=>{
  const current=++revision.current;setLoading(true);setError("");
  try{const rows=await search({data:{activityId,query:""}});if(current===revision.current){setDirectory(rows);loadedAt.current=Date.now();}}
  catch{if(current===revision.current)setError("Não foi possível buscar. Tente novamente.");}
  finally{if(current===revision.current)setLoading(false);}
 },[activityId,search]);
 const indexed=useMemo(()=>(directory??[]).map(person=>({...person,searchName:normalize(`${person.name} ${person.badgeName??""}`)})),[directory]);
 const words=normalize(query.trim()).split(/\s+/);
 const people=query.trim().length<2?[]:indexed.filter(person=>words.every(word=>person.searchName.includes(word))).slice(0,30);
 function changeOpen(value:boolean){setOpen(value);onOpenChange(value);if(value&&directory&&Date.now()-loadedAt.current>10000)void load();if(!value)setQuery("");}
 useEffect(()=>{
  setDirectory(null);loadedAt.current=0;void load();return()=>{revision.current++;};
 },[load]);
 return <><Button variant="outline" className="min-h-11 shrink-0" onClick={()=>changeOpen(true)}><Search className="size-4"/>Buscar nome</Button>
  <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="internal-app attendance-theme flex max-h-[85dvh] flex-col overflow-hidden bg-white">
   <DialogHeader><DialogTitle>Buscar participante</DialogTitle><DialogDescription>Digite pelo menos 2 letras do nome. A presença será registrada nesta atividade.</DialogDescription></DialogHeader>
   <Input aria-label="Nome do participante" placeholder="Nome do participante" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)} className="min-h-11 shrink-0"/>
   {loading&&!directory&&<p role="status" className="text-sm">Preparando busca…</p>}{error&&<div><p role="alert" className="text-sm text-red-800">{error}</p><Button variant="outline" className="mt-2 min-h-11" onClick={()=>void load()}>Tentar novamente</Button></div>}
   {!loading&&!error&&query.trim().length>=2&&!people.length&&<p role="status" className="text-sm">Nenhum participante confirmado encontrado.</p>}
   <ul className="min-h-0 overflow-y-auto divide-y">{people.map(person=><li key={person.token} className="flex flex-wrap items-center gap-2 py-3">
    <div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-semibold">{person.name}</p><p className="text-xs text-zinc-600">{person.choirName}</p></div>
    <Button disabled={person.attended||attendedTokens.includes(person.token)} className="min-h-11" onClick={()=>{onSelect(person.token);changeOpen(false);}}>{person.attended||attendedTokens.includes(person.token)?"Já presente":"Marcar presença"}</Button>
   </li>)}</ul>
   {people.length===30&&<p className="text-xs text-zinc-600">Exibindo os primeiros 30. Digite mais partes do nome para refinar.</p>}
  </DialogContent></Dialog>
 </>;
}
