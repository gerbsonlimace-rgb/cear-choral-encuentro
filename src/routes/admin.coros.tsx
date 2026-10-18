import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminChoirsPage } from "@/features/admin/AdminChoirsPage";
import { getAdminChoirPricingBootstrap } from "@/lib/choir-pricing.functions";

export const Route = createFileRoute("/admin/coros")({
  component: AdminChoirsRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Coros e valores no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Coros e valores | Administração do Encontro de Coros" },
      { property: "og:description", content: "Coros e valores no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Coros e valores | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminChoirsRoute() {
  const navigate = useNavigate();
  return (
    <AdminChoirsPage
      loadInitialData={getAdminChoirPricingBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}
