import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminSummaryPage } from "@/features/admin/AdminSummaryPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/resumo")({
  ssr: false,
  component: AdminSummaryRoute,
  head: () => ({
    meta: [
      { title: "Resumo | Administração do Encontro de Coros" },
      {
        name: "description",
        content: "Visão geral administrativa das inscrições e pagamentos do Encontro de Coros.",
      },
      { property: "og:title", content: "Resumo | Administração do Encontro de Coros" },
      {
        property: "og:description",
        content: "Visão geral administrativa das inscrições e pagamentos do Encontro de Coros.",
      },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminSummaryRoute() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        void navigate({ to: "/acessar", replace: true });
        return;
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <main className="internal-app min-h-svh bg-background p-6" role="status">
        <p className="text-sm text-muted-foreground">Carregando o resumo…</p>
      </main>
    );
  }

  return (
    <AdminSummaryPage navigateTo={(to) => void navigate({ to })} />
  );
}
