import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CircleOff, Clock3, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  getAdminAccess,
  getAdminRegistrationSummary,
  type AdminAccessState,
} from "@/lib/admin.functions";
import type { AdminRegistrationSummary } from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { formatAdminRafflePending } from "./admin-raffle.domain";

type Props = {
  checkAccess?: () => Promise<AdminAccessState>;
  loadSummary?: () => Promise<AdminRegistrationSummary>;
  navigateTo?: (to: AdminNavigationPath) => void;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function RegistrationSummaryBreakdown({ summary }: { summary: AdminRegistrationSummary }) {
  const counts = [
    { label: "Total", value: String(summary.total) },
    { label: "Pagas", value: String(summary.paid) },
    { label: "Pendentes", value: String(summary.pending) },
    { label: "Isentos", value: String(summary.exempt ?? 0) },
    { label: "Históricas", value: String(summary.legacy) },
  ];

  return (
    <section aria-label="Visão geral das inscrições" className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Inscrições</h2>
            <p className="text-xs text-muted-foreground">Todos os registros</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            {counts.map((metric) => (
              <div key={metric.label}>
                <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="border-t bg-muted/30 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">Financeiro por coro/diocese</h3>
          {summary.byChoir.length ? (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.byChoir.map((item) => (
                <li
                  key={item.choirName}
                  className="min-w-0 rounded-lg border bg-card p-4 shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">
                      {item.choirName}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                      {item.total} {item.total === 1 ? "inscrito" : "inscritos"}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Recebido</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {money.format(item.receivedCents / 100)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Pendente</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {money.format(item.pendingCents / 100)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Pendente em rifas</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatAdminRafflePending({ cents: item.rafflePendingCents ?? 0, tickets: item.rafflePendingTickets ?? null })}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 border-t border-border/70 pt-1.5">
                      <dt className="text-muted-foreground">Total previsto</dt>
                      <dd className="font-semibold tabular-nums text-primary">
                        {money.format(item.expectedCents / 100)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum coro/diocese com inscrições.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function AdminSummaryPage({
  checkAccess = getAdminAccess,
  loadSummary = getAdminRegistrationSummary,
  navigateTo,
}: Props) {
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

  const registrationMetrics = summary
    ? [
        { label: "Inscrições", value: String(summary.total), icon: Users },
        { label: "Pagamentos confirmados", value: String(summary.paid), icon: CheckCircle2 },
        { label: "Pagamentos pendentes", value: String(summary.pending), icon: Clock3 },
        { label: "Inscrições isentas", value: String(summary.exempt ?? 0), icon: CircleOff },
      ]
    : [];
  const financialMetrics = summary
    ? [
        {
          label: "Total recebido",
          value: money.format(summary.receivedCents / 100),
          detail: "Pagamentos confirmados",
          icon: Banknote,
        },
        {
          label: "Total pendente",
          value: money.format(summary.pendingCents / 100),
          detail: `${money.format(summary.pendingCents / 100)} em inscrições`,
          icon: Clock3,
        },
        {
          label: "Pendente em rifas",
          value: money.format((summary.rafflePendingCents ?? 0) / 100),
          detail: formatAdminRafflePending({ cents: summary.rafflePendingCents ?? 0, tickets: summary.rafflePendingTickets ?? null }),
          icon: Clock3,
        },
      ]
    : [];

  return (
    <main className="internal-app min-h-svh min-w-0 bg-background px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
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
          <>
            <section
              aria-label="Indicadores do encontro"
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {registrationMetrics.map(({ label, value, icon: Icon }) => (
                  <article key={label} className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <p className="mt-3 text-sm text-muted-foreground sm:mt-5">{label}</p>
                    <p className="mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
                  </article>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {financialMetrics.map(({ label, value, detail, icon: Icon }) => (
                  <article key={label} className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <p className="mt-3 text-sm text-muted-foreground sm:mt-5">{label}</p>
                    <p className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
                  </article>
                ))}
              </div>
            </section>
            <RegistrationSummaryBreakdown summary={summary} />
          </>
        )}
      </div>
    </main>
  );
}
