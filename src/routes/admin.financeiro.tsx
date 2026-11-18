import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminFinancePage } from "@/features/admin/AdminFinancePage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/financeiro")({
  ssr: false,
  component: AdminFinanceRoute,
  head: () => ({
    meta: [
      { title: "Financeiro | Administração do Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminFinanceRoute() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) void navigate({ to: "/acessar", replace: true });
      else setReady(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);
  if (!ready)
    return (
      <main className="internal-app min-h-svh bg-background p-6" role="status">
        Carregando Financeiro…
      </main>
    );
  return <AdminFinancePage navigateTo={(to) => void navigate({ to })} />;
}
