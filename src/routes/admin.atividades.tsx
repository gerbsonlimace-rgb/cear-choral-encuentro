import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { AdminEventActivitiesPage } from "@/features/event-activities/AdminEventActivitiesPage";
import { getAdminAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/atividades")({
  beforeLoad: async () => {
    const access = await getAdminAccess();
    if (access.status !== "authorized") throw redirect({ to: "/acessar" });
  },
  component: AdminEventActivitiesRoute,
  head: () => ({ meta: [
    { title: "Programação | Administração do Encontro de Coros" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});

function AdminEventActivitiesRoute() {
  const navigate = useNavigate();
  return <AdminEventActivitiesPage navigateTo={(to) => void navigate({ to })} />;
}
