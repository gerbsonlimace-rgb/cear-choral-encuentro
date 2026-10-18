import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { UnifiedPortalLoginPage } from "@/features/access/UnifiedPortalLoginPage";

export const Route = createFileRoute("/acessar")({
  validateSearch: (search: Record<string, unknown>): { reautenticar?: boolean } =>
    search.reautenticar === true || search.reautenticar === "true" ? { reautenticar: true } : {},
  component: UnifiedPortalAccessRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Acessar portal no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Acessar portal | Encontro de Coros" },
      { property: "og:description", content: "Acessar portal no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Acessar portal | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#ffffff" },
      { name: "color-scheme", content: "light" },
    ],
  }),
});

function UnifiedPortalAccessRoute() {
  const navigate = useNavigate();
  const { reautenticar } = Route.useSearch();
  return (
    <UnifiedPortalLoginPage
      requireSignIn={reautenticar}
      onAuthorized={(destination) => navigate({ href: destination })}
    />
  );
}
