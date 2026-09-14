import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

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
  const onMissingAccess = useCallback(
    () => navigate({ to: "/acessar", search: { reautenticar: true }, replace: true }),
    [navigate],
  );
  return (
    <ParticipantPortalPage
      onOpenAdmin={() => void navigate({ to: "/admin/resumo" })}
      onMissingAccess={onMissingAccess}
      onSignedOut={() => navigate({ to: "/acessar" })}
    />
  );
}
