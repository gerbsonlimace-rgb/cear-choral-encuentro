import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminChoirsPage } from "@/features/admin/AdminChoirsPage";
import { getAdminChoirPricingBootstrap } from "@/lib/choir-pricing.functions";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminSettingsRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Configurações no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Configurações | Administração do Encontro de Coros" },
      { property: "og:description", content: "Configurações no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Configurações | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSettingsRoute() {
  const navigate = useNavigate();
  return (
    <AdminChoirsPage
      section="settings"
      loadInitialData={getAdminChoirPricingBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/acessar" })}
      onMissingSession={() => navigate({ to: "/acessar" })}
    />
  );
}
