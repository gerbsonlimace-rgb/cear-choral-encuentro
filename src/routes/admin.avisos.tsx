import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNoticesPage } from "@/features/admin/AdminNoticesPage";

export const Route = createFileRoute("/admin/avisos")({
  component: AdminNoticesRoute,
  head: () => ({
    meta: [
      { title: "Avisos | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminNoticesRoute() {
  const navigate = useNavigate();
  return (
    <AdminNoticesPage
      navigateTo={(to) => void navigate({ to })}
      onMissingSession={() => void navigate({ to: "/acessar" })}
    />
  );
}
