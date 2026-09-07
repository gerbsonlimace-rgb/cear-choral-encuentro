import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLoginPage } from "@/features/admin/AdminLoginPage";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginRoute,
  head: () => ({
    meta: [
      { title: "Acesso administrativo | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminLoginRoute() {
  const navigate = useNavigate();
  return <AdminLoginPage onAuthorized={() => navigate({ to: "/admin/inscricoes" })} />;
}
