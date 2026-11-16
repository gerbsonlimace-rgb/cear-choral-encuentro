import { useEffect, useState } from "react";
import { Banknote, Ban, CheckCircle2, CircleOff, Clock3, Users, History } from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportAdminRegistrationsPdf,
  getAdminAccess,
  getAdminRegistrationSummary,
  type AdminAccessState,
} from "@/lib/admin.functions";
import type { AdminRegistrationSummary } from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";
import { AdminChoirSummaryCard, type PrepareChoirPdf } from "./AdminChoirSummaryCard";

type Props = {
  checkAccess?: () => Promise<AdminAccessState>;
  loadSummary?: () => Promise<AdminRegistrationSummary>;
  prepareChoirPdf?: PrepareChoirPdf;
  navigateTo?: (to: AdminNavigationPath) => void;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AdminSummaryPage({
  checkAccess = getAdminAccess,
  loadSummary = getAdminRegistrationSummary,
  navigateTo,
  prepareChoirPdf,
}: Props) {
  const exportPdfFn = useServerFn(exportAdminRegistrationsPdf);
  const preparePdf = prepareChoirPdf ?? exportPdfFn;
  const [summary, setSummary] = useState<AdminRegistrationSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
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
  }, [checkAccess, loadSummary, refresh]);

  const registrationMetrics = summary
    ? [
        { label: "Inscrições", value: String(summary.total), icon: Users },
        { label: "Pagamentos confirmados", value: String(summary.paid), icon: CheckCircle2 },
        { label: "Pagamentos pendentes", value: String(summary.pending), icon: Clock3 },
        { label: "Inscrições isentas", value: String(summary.exempt ?? 0), icon: CircleOff },
        { label: "Históricas", value: String(summary.legacy), icon: History },
        { label: "Canceladas", value: String(summary.cancelled ?? 0), icon: Ban },
      ]
    : [];
  const raffleReceivedCents = summary?.rafflePaidCents ?? 0;
  const registrationReceivedCents = (summary?.receivedCents ?? 0) - raffleReceivedCents;
  const financialMetrics = summary
    ? [
        {
          label: "Total recebido",
          value: money.format(summary.receivedCents / 100),
          icon: Banknote,
          details: [
            { label: "Inscrições", value: money.format(registrationReceivedCents / 100) },
            { label: "Rifas", value: money.format(raffleReceivedCents / 100) },
            ...(summary.refundedCents
              ? [{ label: "Devoluções", value: `− ${money.format(summary.refundedCents / 100)}` }]
              : []),
          ],
        },
        {
          label: "Pendente taxa de inscrição",
          value: money.format(summary.pendingCents / 100),
          icon: Clock3,
        },
        {
          label: "Pendente em rifas",
          value: money.format((summary.rafflePendingCents ?? 0) / 100),
          icon: Clock3,
        },
        {
          label: "Total previsto",
          value: money.format(summary.expectedCents / 100),
          icon: Banknote,
        },
      ]
    : [];

  return (
    <main className="internal-app min-h-svh min-w-0 bg-background px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <header>
          <h1 className="font-display text-2xl">Resumo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {registrationMetrics.map(({ label, value, icon: Icon }) => (
                  <article key={label} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-3">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-semibold tabular-nums">{value}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {financialMetrics.map(({ label, value, icon: Icon, details }) => (
                  <article key={label} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-3">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="break-words text-xl font-semibold tabular-nums">{value}</p>
                      {details && (
                        <dl className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
                          {details.map((detail) => (
                            <div key={detail.label} className="flex flex-wrap justify-between gap-x-2">
                              <dt>{detail.label}</dt>
                              <dd className="font-medium tabular-nums">{detail.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section aria-label="Visão geral das inscrições" className="space-y-2">
              <h2 className="text-sm font-semibold">Financeiro por coro/diocese</h2>
              {summary.byChoir.length ? (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.byChoir.map((item) => (
                    <AdminChoirSummaryCard
                      key={item.choirName}
                      item={item}
                      preparePdf={preparePdf}
                      onSettled={() => setRefresh((value) => value + 1)}
                    />
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nenhum coro/diocese com inscrições.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
