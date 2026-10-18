import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/participante/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { name: "description", content: "Acesso do participante no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Acesso do participante | Encontro de Coros" },
      { property: "og:description", content: "Acesso do participante no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Acesso do participante | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
