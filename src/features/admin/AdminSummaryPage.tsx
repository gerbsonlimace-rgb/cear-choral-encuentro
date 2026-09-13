import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Clock3, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { getAdminAccess, getAdminRegistrationSummary, type AdminAccessState } from "@/lib/admin.functions";
import type { AdminRegistrationSummary } from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

type Props = {
  checkAccess?: () => Promise<AdminAccessState>;
  loadSummary?: () => Promise<AdminRegistrationSummary>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AdminSummaryPage({ checkAccess = getAdminAccess, loadSummary = getAdminRegistrationSummary, navigateTo }: Props) {
  const [summary, setSummary] = useState<AdminRegistrationSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void checkAccess()
      .then((access) => {
        if (access.status !== "authorized") throw new Error("forbidden");
        return loadSummary();
      })
      .then((result) => active && setSummary(result))
      .catch(() => active && setError("Não foi possível carregar o resumo administrativo."));
    return () => {
      active = false;
    };
  }, [checkAccess, loadSummary]);

  const metrics = summary
    ? [
        { label: "Inscrições", value: String(summary.total), icon: Users },
        { label: "Pagamentos confirmados", value: String(summary.paid), icon: CheckCircle2 },
        { label: "Pagamentos pendentes", value: String(summary.pending), icon: Clock3 },
        {
          label: "Valor confirmado",
          value: money.format(summary.receivedCents / 100),
          icon: Banknote,
        },
      ]
    : [];

  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-display text-3xl tracking-[-0.02em]">Resumo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visão geral das inscrições e pagamentos do encontro.
          </p>
        </header>
        <AdminNavigation current="summary" navigateTo={navigateTo} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!summary && !error && <Skeleton className="h-48 w-full" />}
        {summary && (
          <section
            aria-label="Indicadores do encontro"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {metrics.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border bg-card p-5">
                <Icon aria-hidden="true" className="size-5 text-primary" />
                <p className="mt-5 text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
