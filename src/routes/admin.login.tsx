import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { name: "description", content: "Acesso administrativo no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Acesso administrativo | Encontro de Coros" },
      { property: "og:description", content: "Acesso administrativo no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Acesso administrativo | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
