import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { ParticipantAttendancePage } from "@/features/event-activities/ParticipantAttendancePage";

const searchSchema = z.object({ token: z.string().max(2048).catch("") });

export const Route = createFileRoute("/participante/presenca")({
  validateSearch: searchSchema,
  component: ParticipantAttendanceRoute,
  head: () => ({ meta: [
      { name: "description", content: "Confirmar presença no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Confirmar presença | Encontro de Coros" },
      { property: "og:description", content: "Confirmar presença no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    { title: "Confirmar presença | Encontro de Coros" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "color-scheme", content: "light" },
  ] }),
});

function ParticipantAttendanceRoute() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  return <ParticipantAttendancePage token={token} onBack={() => void navigate({ to: "/participante" })} />;
}
