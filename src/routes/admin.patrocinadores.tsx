import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminSponsorsPage } from "@/features/admin/AdminSponsorsPage";
import { getAdminSponsorsBootstrap } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/admin/patrocinadores")({
  component: AdminSponsorsRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Patrocinadores no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Patrocinadores | Administração do Encontro de Coros" },
      { property: "og:description", content: "Patrocinadores no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Patrocinadores | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSponsorsRoute() {
  const navigate = useNavigate();
  return (
    <AdminSponsorsPage
      loadInitialData={getAdminSponsorsBootstrap}
      navigateTo={(to) => void navigate({ to })}
      onSignedOut={() => navigate({ to: "/admin/login" })}
      onMissingSession={() => navigate({ to: "/admin/login" })}
    />
  );
}
