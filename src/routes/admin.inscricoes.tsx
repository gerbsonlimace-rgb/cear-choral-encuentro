import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminRegistrationsPage } from "@/features/admin/AdminRegistrationsPage";
import { getAdminRegistrationsBootstrap } from "@/lib/admin.functions";

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
      loadInitialData={getAdminRegistrationsBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}
