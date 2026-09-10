import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminChoirsPage } from "@/features/admin/AdminChoirsPage";

export const Route = createFileRoute("/admin/coros")({
  component: AdminChoirsRoute,
  head: () => ({
    meta: [
      { title: "Coros e valores | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminChoirsRoute() {
  const navigate = useNavigate();
  return (
    <AdminChoirsPage
      onSignedOut={() => navigate({ to: "/admin/login" })}
      onMissingSession={() => navigate({ to: "/admin/login" })}
    />
  );
}
