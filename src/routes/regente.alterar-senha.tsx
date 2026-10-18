import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RegentPasswordChangePage } from "@/features/regent/RegentPasswordChangePage";

export const Route = createFileRoute("/regente/alterar-senha")({
  component: RegentPasswordChangeRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Alterar senha no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Alterar senha | Encontro de Coros" },
      { property: "og:description", content: "Alterar senha no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
      onLoginRequired={() => navigate({ to: "/acessar" })}
    />
  );
}
