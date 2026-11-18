import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/resumo")({
  // The summary cards live inside the registrations screen, so the old address
  // only redirects there instead of keeping a second copy of the indicators.
  beforeLoad: () => {
    throw redirect({ to: "/admin/inscricoes" });
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { title: "Inscrições | Administração do Encontro de Coros" },
      {
        name: "description",
        content: "Visão geral administrativa das inscrições e pagamentos do Encontro de Coros.",
      },
      { property: "og:title", content: "Inscrições | Administração do Encontro de Coros" },
      {
        property: "og:description",
        content: "Visão geral administrativa das inscrições e pagamentos do Encontro de Coros.",
      },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
