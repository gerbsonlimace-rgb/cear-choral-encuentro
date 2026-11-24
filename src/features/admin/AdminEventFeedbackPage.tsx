import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FEEDBACK_ASPECTS, RATING_LABELS } from "@/features/event-feedback/eventFeedback.domain";
import {
  formatFeedbackScore,
  hasFeedbackComments,
  summarizeFeedback,
  type AdminFeedbackRow,
} from "@/features/event-feedback/adminEventFeedback.domain";
import { supabase } from "@/integrations/supabase/client";
import { getAdminEventFeedback } from "@/lib/admin-event-feedback.functions";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

const getDefaultSession = () => supabase.auth.getSession();
const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

type Props = {
  loadFeedback?: () => Promise<AdminFeedbackRow[]>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  onMissingSession: () => void;
  navigateTo?: (to: AdminNavigationPath) => void;
};

export function AdminEventFeedbackPage({
  loadFeedback = getAdminEventFeedback,
  getSession = getDefaultSession,
  onMissingSession,
  navigateTo,
}: Props) {
  const [rows, setRows] = useState<AdminFeedbackRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [rating, setRating] = useState("");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRows(null);
    void (async () => {
      try {
        const session = await getSession();
        if (!active) return;
        if (session.error || !session.data.session) {
          onMissingSession();
          return;
        }
        const result = await loadFeedback();
        if (active) {
          setRows(result);
          setPage(0);
        }
      } catch {
        if (active)
          setError(
            "Não foi possível carregar as avaliações. Verifique seu acesso de administrador e tente novamente.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getSession, loadFeedback, onMissingSession, revision]);

  const summary = useMemo(() => summarizeFeedback(rows ?? []), [rows]);
  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (row) =>
          (!rating || row.overall === Number(rating)) &&
          (!commentsOnly || hasFeedbackComments(row)),
      ),
    [rows, rating, commentsOnly],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <main className="internal-app min-h-svh bg-background px-4 pb-28 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      {rows && <AdminNavigation current="feedback" navigateTo={navigateTo} />}
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Avaliações do encontro</h1>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Notas e comentários recebidos. Consulta exclusiva da administração, sem identificação
              dos participantes.
            </p>
          </div>
          {rows && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw aria-hidden="true" /> Atualizar
            </Button>
          )}
        </header>

        {loading && (
          <div role="status" aria-label="Carregando avaliações" className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="space-y-3 rounded-xl border border-destructive/30 bg-card p-4"
          >
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setRevision((value) => value + 1)}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {rows && (
          <>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Avaliações recebidas", String(summary.total)],
                ["Média geral · de 5", formatFeedbackScore(summary.average)],
                [
                  "Notas 4 e 5",
                  summary.total ? `${Math.round((summary.positive / summary.total) * 100)}%` : "—",
                ],
                ["Com comentários", String(summary.withComments)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {!rows.length ? (
              <section className="rounded-xl border border-border bg-card p-6">
                <MessageSquareText
                  aria-hidden="true"
                  className="mb-3 size-6 text-muted-foreground"
                />
                <h2 className="font-semibold">Nenhuma avaliação recebida ainda.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  As respostas aparecerão aqui após o envio pelo formulário de avaliação.
                </p>
              </section>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                  <section
                    className="rounded-xl border border-border bg-card p-4 sm:p-5"
                    aria-labelledby="feedback-distribution"
                  >
                    <h2 id="feedback-distribution" className="font-semibold">
                      Distribuição das notas
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avaliação geral do encontro
                    </p>
                    <ul className="mt-4 space-y-3">
                      {[5, 4, 3, 2, 1].map((score) => {
                        const count = summary.distribution[score - 1];
                        const percent = Math.round((count / summary.total) * 100);
                        return (
                          <li
                            key={score}
                            className="flex items-center gap-3 text-sm"
                            aria-label={`Nota ${score}: ${count} avaliações (${percent}%)`}
                          >
                            <span className="flex w-8 shrink-0 items-center gap-1 tabular-nums">
                              {score}
                              <Star aria-hidden="true" className="size-3.5" />
                            </span>
                            <div
                              aria-hidden="true"
                              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className="h-full rounded-full bg-brand-gold"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-20 shrink-0 text-right text-xs tabular-nums">
                              {count} · {percent}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  <section
                    className="rounded-xl border border-border bg-card p-4 sm:p-5"
                    aria-labelledby="feedback-aspects"
                  >
                    <h2 id="feedback-aspects" className="font-semibold">
                      Notas por critério
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Médias de 1 a 5. “Não utilizei” fica fora da média.
                    </p>
                    <dl className="mt-3 divide-y divide-border">
                      {summary.aspects.map((aspect) => (
                        <div
                          key={aspect.key}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <div>
                            <dt className="text-sm">{aspect.label}</dt>
                            <dd className="text-xs text-muted-foreground">
                              {aspect.count} respostas
                              {aspect.notUsed > 0 ? ` · ${aspect.notUsed} não utilizaram` : ""}
                            </dd>
                          </div>
                          <dd className="text-lg font-semibold tabular-nums">
                            {formatFeedbackScore(aspect.average)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>

                <section aria-labelledby="feedback-responses" className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 id="feedback-responses" className="text-lg font-semibold">
                        Respostas recebidas
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mais recentes primeiro. O resumo acima considera todas as avaliações.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        Nota geral
                        <select
                          value={rating}
                          onChange={(event) => {
                            setRating(event.target.value);
                            setPage(0);
                          }}
                          className="min-h-11 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Todas</option>
                          {RATING_LABELS.map((label, index) => (
                            <option key={label} value={index + 1}>
                              {index + 1} · {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={commentsOnly}
                          onChange={(event) => {
                            setCommentsOnly(event.target.checked);
                            setPage(0);
                          }}
                          className="size-4 accent-brand-gold focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        Somente com comentários
                      </label>
                    </div>
                  </div>
                  <p role="status" className="text-sm text-muted-foreground">
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "avaliação encontrada" : "avaliações encontradas"}
                  </p>
                  {!filtered.length && (
                    <p className="rounded-xl border border-border bg-card p-5 text-sm">
                      Nenhuma avaliação corresponde aos filtros.
                    </p>
                  )}
                  <div className="space-y-3">
                    {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => (
                      <article
                        key={row.submission_id}
                        className="rounded-xl border border-border bg-card p-4 sm:p-5"
                      >
                        <header className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <Star aria-hidden="true" className="size-4 text-foreground" />
                            Nota geral {row.overall}/5 · {RATING_LABELS[row.overall - 1]}
                          </h3>
                          <time dateTime={row.created_at} className="text-xs text-muted-foreground">
                            {dateFormatter.format(new Date(row.created_at))}
                          </time>
                        </header>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                          {FEEDBACK_ASPECTS.map(({ key, label }) => (
                            <div
                              key={key}
                              className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs"
                            >
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="font-medium tabular-nums">
                                {row[key] === null ? "Não utilizei" : `${row[key]}/5`}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {hasFeedbackComments(row) ? (
                          <div className="mt-4 space-y-3 border-t border-border pt-3">
                            {FEEDBACK_ASPECTS.filter(
                              ({ key }) => !!row.criterion_comments[key]?.trim(),
                            ).map(({ key, label }) => (
                              <div key={key}>
                                <h4 className="text-xs font-semibold">{label}</h4>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {row.criterion_comments[key]}
                                </p>
                              </div>
                            ))}
                            {row.suggestion.trim() && (
                              <div>
                                <h4 className="text-xs font-semibold">Sugestão geral</h4>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {row.suggestion}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-muted-foreground">
                            Sem comentários nesta avaliação.
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                  {pageCount > 1 && (
                    <nav
                      aria-label="Páginas de avaliações"
                      className="flex items-center justify-between gap-3"
                    >
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={page === 0}
                        onClick={() => setPage((value) => value - 1)}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm tabular-nums">
                        {page + 1} de {pageCount}
                      </span>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={page + 1 >= pageCount}
                        onClick={() => setPage((value) => value + 1)}
                      >
                        Próxima
                      </Button>
                    </nav>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
