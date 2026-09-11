import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ParticipantLoginPage } from "@/features/participant/ParticipantLoginPage";

export const Route = createFileRoute("/participante/login")({
  component: ParticipantLoginRoute,
  head: () => ({
    meta: [
      { title: "Área do participante | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ParticipantLoginRoute() {
  const navigate = useNavigate();
  return <ParticipantLoginPage onAuthorized={() => navigate({ href: "/participante" })} />;
}
