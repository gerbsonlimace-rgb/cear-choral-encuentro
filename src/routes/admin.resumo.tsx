import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminSummaryPage } from "@/features/admin/AdminSummaryPage";

export const Route = createFileRoute("/admin/resumo")({
  component: AdminSummaryRoute,
  head: () => ({
    meta: [
      { title: "Resumo | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSummaryRoute() {
  const navigate = useNavigate();
  return (
    <AdminSummaryPage navigateTo={(to) => void navigate({ to })} />
  );
}
