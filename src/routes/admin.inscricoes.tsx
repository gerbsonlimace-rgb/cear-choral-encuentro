import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminRegistrationsPage } from "@/features/admin/AdminRegistrationsPage";
import { getAdminRegistrationsBootstrap } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/inscricoes")({
  component: AdminRegistrationsRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Inscrições no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Inscrições | Administração do Encontro de Coros" },
      { property: "og:description", content: "Inscrições no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
