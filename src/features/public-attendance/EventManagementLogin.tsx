import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEventManagementAccess, unlockEventManagement } from "@/lib/public-attendance.functions";
import type { EventManagementAccess } from "./eventManagement.domain";
import "./attendanceApp.css";
export function EventManagementGate({ children }: { children:(access:EventManagementAccess)=>ReactNode }) {
 const [access,setAccess]=useState<EventManagementAccess|null>(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false);
 const [cpf,setCpf]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;void getEventManagementAccess().then(next=>{if(active)setAccess(next.canReport||next.canScan||next.canArchive?next:null);}).catch(()=>{}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
 async function unlock(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{const next=await unlockEventManagement({data:{cpf:cpf.replace(/\D/g,"")}});setCpf("");setAccess(next);}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível desbloquear.");}finally{setBusy(false);}}
 if(checking)return <main className="grid min-h-dvh place-items-center bg-[#f7f7f5]"><p role="status">Verificando acesso…</p></main>;
 if(access)return <>{children(access)}</>;
 return <main className="internal-app attendance-theme flex min-h-dvh items-center justify-center bg-[#f7f7f5] p-4 text-zinc-950"><form className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-5" onSubmit={event=>void unlock(event)}>
  <h1 className="text-xl font-bold">Gerenciamento do evento</h1><p className="text-sm text-zinc-600">Informe seu CPF para desbloquear. O acesso deve estar habilitado na sua inscrição.</p>
  <div className="space-y-2"><Label htmlFor="event-cpf">CPF de acesso</Label><Input id="event-cpf" type="password" inputMode="numeric" autoComplete="off" maxLength={14} required value={cpf} onChange={e=>setCpf(e.target.value)} /></div>
  {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}<Button className="min-h-11 w-full" disabled={busy||cpf.replace(/\D/g,"").length!==11}>{busy?"Desbloqueando…":"Desbloquear"}</Button>
 </form></main>;
}
