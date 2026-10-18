import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNoticesPage } from "@/features/admin/AdminNoticesPage";

export const Route = createFileRoute("/admin/avisos")({
  component: AdminNoticesRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Avisos no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Avisos | Administração do Encontro de Coros" },
      { property: "og:description", content: "Avisos no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Avisos | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminNoticesRoute() {
  const navigate = useNavigate();
  return (
    <AdminNoticesPage
      navigateTo={(to) => void navigate({ to })}
      onMissingSession={() => void navigate({ to: "/acessar" })}
    />
  );
}
