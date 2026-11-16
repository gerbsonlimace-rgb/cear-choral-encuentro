import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminOverviewPage } from "@/features/admin/AdminOverviewPage";
import { getAdminHospedagemBootstrap } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/visao-geral")({
  component: AdminOverviewRoute,
});

function AdminOverviewRoute() {
  const navigate = useNavigate();
  return (
    <AdminOverviewPage
      loadInitialData={getAdminHospedagemBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}