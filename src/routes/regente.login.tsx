import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RegentLoginPage } from "@/features/regent/RegentLoginPage";

export const Route = createFileRoute("/regente/login")({
  component: RegentLoginRoute,
  head: () => ({
    meta: [
      { title: "Acesso do regente | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RegentLoginRoute() {
  const navigate = useNavigate();
  return (
    <RegentLoginPage
      onPasswordChangeRequired={() => navigate({ to: "/regente/alterar-senha" })}
      onAuthorized={() => navigate({ href: "/regente" })}
    />
  );
}
