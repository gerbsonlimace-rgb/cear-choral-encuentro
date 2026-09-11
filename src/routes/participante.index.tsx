import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ParticipantPortalPage } from "@/features/participant/ParticipantPortalPage";

export const Route = createFileRoute("/participante/")({
  component: ParticipantPortalRoute,
  head: () => ({
    meta: [
      { title: "Área do participante | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ParticipantPortalRoute() {
  const navigate = useNavigate();
  return (
    <ParticipantPortalPage
      onMissingAccess={() => navigate({ to: "/acessar" })}
      onSignedOut={() => navigate({ to: "/acessar" })}
    />
  );
}
