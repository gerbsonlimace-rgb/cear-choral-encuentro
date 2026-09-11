import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminRegistrationsPage } from "@/features/admin/AdminRegistrationsPage";

export const Route = createFileRoute("/admin/inscricoes")({
  component: AdminRegistrationsRoute,
  head: () => ({
    meta: [
      { title: "Inscrições | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminRegistrationsRoute() {
  const navigate = useNavigate();
  return (
    <AdminRegistrationsPage
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}
