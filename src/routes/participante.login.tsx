import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/participante/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { title: "Área do participante | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
