import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminDocumentsPage } from "@/features/admin/AdminDocumentsPage";

export const Route = createFileRoute("/admin/documentos")({
  component: AdminDocumentsRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Documentos no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Documentos | Administração do Encontro de Coros" },
      { property: "og:description", content: "Documentos no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
