import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRegentAccess } from "@/lib/regent.functions";
import { RegentPortalPage } from "@/features/regent/RegentPortalPage";
import type { RegentAccess } from "@/features/regent/regent.domain";

export const Route = createFileRoute("/regente/")({
  component: RegentIndexRoute,
  head: () => ({
    meta: [
      { name: "description", content: "Meu coro no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:title", content: "Meu coro | Encontro de Coros" },
      { property: "og:description", content: "Meu coro no portal do II Encontro de Coros Diocesanos e Litúrgicos do Ceará." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Meu coro | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RegentIndexRoute() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<Extract<RegentAccess, { status: "authorized" }> | null>(
    null,
  );
  useEffect(() => {
    void getRegentAccess()
      .then((state) => {
        if (state.status === "authorized") setAccess(state);
        else if (state.status === "password_change_required")
          void navigate({ to: "/regente/alterar-senha" });
        else void navigate({ to: "/regente/login" });
      })
      .catch(() => void navigate({ to: "/regente/login" }));
  }, [navigate]);
  if (!access)
    return (
      <main className="p-6" role="status">
        Carregando…
      </main>
    );
  return <RegentPortalPage access={access} />;
}
