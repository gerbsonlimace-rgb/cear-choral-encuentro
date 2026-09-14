import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminDocumentsPage } from "@/features/admin/AdminDocumentsPage";

export const Route = createFileRoute("/admin/documentos")({
  component: AdminDocumentsRoute,
  head: () => ({
    meta: [
      { title: "Documentos | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminDocumentsRoute() {
  const navigate = useNavigate();
  return (
    <AdminDocumentsPage
      navigateTo={(to) => void navigate({ to })}
      onMissingSession={() => void navigate({ to: "/acessar" })}
    />
  );
}
