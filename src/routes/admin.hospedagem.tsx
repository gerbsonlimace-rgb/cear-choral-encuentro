import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminHospedagemPage } from "@/features/admin/AdminHospedagemPage";
import { getAdminHospedagemBootstrap } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/hospedagem")({
  component: AdminHospedagemRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Hospedagem no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Hospedagem | Administração do Encontro de Coros" },
      { property: "og:description", content: "Planejamento de hospedagem no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Hospedagem | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminHospedagemRoute() {
  const navigate = useNavigate();
  return (
    <AdminHospedagemPage
      loadInitialData={getAdminHospedagemBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}