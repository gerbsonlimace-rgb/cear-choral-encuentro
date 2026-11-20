import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ParticipantPreviewPage } from "@/features/participant/ParticipantPreviewPage";

export const Route = createFileRoute("/participante/previa")({
  ssr: false,
  component: ParticipantPreviewRoute,
  head: () => ({ meta: [
    { title: "Prévia do participante | Encontro de Coros" },
    { name: "description", content: "Prévia demonstrativa do portal do participante." },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});

function ParticipantPreviewRoute() {
  const navigate = useNavigate();
  const onUnauthorized = useCallback(() => {
    void navigate({ to: "/acessar", replace: true });
  }, [navigate]);
  const onReturnAdmin = useCallback(() => {
    void navigate({ to: "/admin/inscricoes" });
  }, [navigate]);

  return <ParticipantPreviewPage onUnauthorized={onUnauthorized} onReturnAdmin={onReturnAdmin} />;
}
