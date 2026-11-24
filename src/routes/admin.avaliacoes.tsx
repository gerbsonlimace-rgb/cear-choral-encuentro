import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminEventFeedbackPage } from "@/features/admin/AdminEventFeedbackPage";

export const Route = createFileRoute("/admin/avaliacoes")({
  component: AdminEventFeedbackRoute,
  head: () => ({
    meta: [
      { title: "Avaliações | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminEventFeedbackRoute() {
  const navigate = useNavigate();
  return (
    <AdminEventFeedbackPage
      navigateTo={(to) => void navigate({ to })}
      onMissingSession={() => void navigate({ to: "/acessar" })}
    />
  );
}
