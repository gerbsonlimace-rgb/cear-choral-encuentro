import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { setRegistrationEventReportAccess } from "@/lib/public-attendance.functions";
import type { RegistrationAdminRole } from "./admin-roles.server";

export function EventReportRoleAction({ registrationId, role, cancelled, onChanged }: {registrationId:string;role?:RegistrationAdminRole;cancelled:boolean;onChanged?:(id:string,enabled:boolean)=>void}) {
  const [enabled,setEnabled]=useState(Boolean(role?.isEventReports)),[busy,setBusy]=useState(false);
  useEffect(()=>{setEnabled(Boolean(role?.isEventReports));},[role?.isEventReports]);
  async function toggle(){setBusy(true);try{const result=await setRegistrationEventReportAccess({data:{registrationId,enabled:!enabled}});setEnabled(result.enabled);onChanged?.(registrationId,result.enabled);toast.success(result.enabled?"Gerenciamento do evento habilitado: somente relatórios, com bloqueio por CPF.":"Acesso aos relatórios removido.");}
    catch(error){toast.error(error instanceof Error?error.message:"Não foi possível alterar o acesso.");}finally{setBusy(false);}}
  return <DropdownMenuItem disabled={busy||!role?.hasAccount||(!enabled&&cancelled)} onSelect={event=>{event.preventDefault();void toggle();}}>
    <ClipboardList aria-hidden="true"/><span className="flex flex-col"><span>{busy?"Salvando…":enabled?"Remover Gerenciamento do evento":"Habilitar Gerenciamento do evento"}</span><span className="text-xs text-muted-foreground">{role?.hasAccount?"Somente relatórios · acesso com CPF":"Libere o acesso do participante primeiro."}</span></span>
  </DropdownMenuItem>;
}
