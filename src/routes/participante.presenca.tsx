import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { ParticipantAttendancePage } from "@/features/event-activities/ParticipantAttendancePage";

const searchSchema = z.object({ token: z.string().max(2048).catch("") });

export const Route = createFileRoute("/participante/presenca")({
  validateSearch: searchSchema,
  component: ParticipantAttendanceRoute,
  head: () => ({ meta: [
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
