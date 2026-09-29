import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/participante/minha-foto")({
  beforeLoad: () => {
    throw redirect({ to: "/euvou" });
  },
  head: () => ({
    meta: [
      { title: "Crie sua foto #EuVou | Encontro de Coros 2026" },
      {
        name: "description",
        content: "Este endereço foi transferido para a página pública Eu Vou.",
      },
      { property: "og:title", content: "Crie sua foto #EuVou | Encontro de Coros 2026" },
      {
        property: "og:description",
        content: "Este endereço foi transferido para a página pública Eu Vou.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
