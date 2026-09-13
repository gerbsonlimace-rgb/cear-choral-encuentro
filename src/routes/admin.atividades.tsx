import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AdminEventActivitiesPage } from "@/features/event-activities/AdminEventActivitiesPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/atividades")({
  ssr: false,
  component: AdminEventActivitiesRoute,
  head: () => ({ meta: [
    { title: "Programação | Administração do Encontro de Coros" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});

function AdminEventActivitiesRoute() {
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
    return () => { active = false; };
  }, [navigate]);

  if (!ready) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando a programação…</p>;
  }

  return <AdminEventActivitiesPage navigateTo={(to) => void navigate({ to })} />;
}
