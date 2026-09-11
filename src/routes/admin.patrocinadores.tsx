import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminSponsorsPage } from "@/features/admin/AdminSponsorsPage";

export const Route = createFileRoute("/admin/patrocinadores")({
  component: AdminSponsorsRoute,
  head: () => ({
    meta: [
      { title: "Patrocinadores | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSponsorsRoute() {
  const navigate = useNavigate();
  return (
    <AdminSponsorsPage
      onSignedOut={() => navigate({ to: "/admin/login" })}
      onMissingSession={() => navigate({ to: "/admin/login" })}
    />
  );
}
