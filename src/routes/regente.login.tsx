import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/regente/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { title: "Acesso do regente | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
