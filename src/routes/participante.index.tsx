import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ParticipantPortalPage } from "@/features/participant/ParticipantPortalPage";

export const Route = createFileRoute("/participante/")({
  component: ParticipantPortalRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Área do participante no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Área do participante | Encontro de Coros" },
      { property: "og:description", content: "Área do participante no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
      onOpenAdmin={() => void navigate({ to: "/admin/inscricoes" })}
      onMissingAccess={onMissingAccess}
      onSignedOut={() => navigate({ to: "/acessar" })}
    />
  );
}
