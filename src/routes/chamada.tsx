import { createFileRoute } from "@tanstack/react-router";
import { PublicAttendancePage } from "@/features/public-attendance/PublicAttendancePage";
import { EventManagementGate } from "@/features/public-attendance/EventManagementLogin";
export const Route=createFileRoute("/chamada")({
  component:()=> <EventManagementGate>{access=><PublicAttendancePage canScan={access.canScan} canReport={access.canReport} canArchive={access.canArchive}/>}</EventManagementGate>,
  head:()=>({meta:[{title:"Gerenciamento do evento | Encontro de Coros"},{name:"robots",content:"noindex, nofollow"},{name:"referrer",content:"no-referrer"},{name:"color-scheme",content:"light"}]}),
});
