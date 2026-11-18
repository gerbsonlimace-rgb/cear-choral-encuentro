import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/inscricoes" });
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { title: "Administração | Encontro de Coros" },
      {
        name: "description",
        content: "Acesso à administração do Encontro de Coros.",
      },
      { property: "og:title", content: "Administração | Encontro de Coros" },
      {
        property: "og:description",
        content: "Acesso à administração do Encontro de Coros.",
      },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});