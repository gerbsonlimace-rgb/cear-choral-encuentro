import { createFileRoute } from "@tanstack/react-router";
import { PublicAttendancePage } from "@/features/public-attendance/PublicAttendancePage";
export const Route=createFileRoute("/chamada")({
  component:PublicAttendancePage,
  head:()=>({meta:[{title:"Chamada | Encontro de Coros"},{name:"robots",content:"noindex, nofollow"},{name:"referrer",content:"no-referrer"},{name:"color-scheme",content:"light"}]}),
});
