import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { title: "Acesso administrativo | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
