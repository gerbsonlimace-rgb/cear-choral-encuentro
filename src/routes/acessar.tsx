import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { UnifiedPortalLoginPage } from "@/features/access/UnifiedPortalLoginPage";

export const Route = createFileRoute("/acessar")({
  component: UnifiedPortalAccessRoute,
  head: () => ({
    meta: [
      { title: "Acessar portal | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#ffffff" },
      { name: "color-scheme", content: "light" },
    ],
  }),
});

function UnifiedPortalAccessRoute() {
  const navigate = useNavigate();
  return <UnifiedPortalLoginPage onAuthorized={(destination) => navigate({ href: destination })} />;
}
