import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RegentPasswordChangePage } from "@/features/regent/RegentPasswordChangePage";

export const Route = createFileRoute("/regente/alterar-senha")({
  component: RegentPasswordChangeRoute,
  head: () => ({
    meta: [
      { title: "Alterar senha | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RegentPasswordChangeRoute() {
  const navigate = useNavigate();
  return (
    <RegentPasswordChangePage
      onCompleted={() => navigate({ href: "/regente" })}
      onAuthorized={() => navigate({ href: "/regente" })}
      onLoginRequired={() => navigate({ to: "/regente/login" })}
    />
  );
}
