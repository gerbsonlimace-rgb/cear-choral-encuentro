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
      <div className="mx-auto max-w-[1440px] space-y-4">
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
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
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
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                ["Avaliações recebidas", String(summary.total)],
                ["Média geral · de 5", formatFeedbackScore(summary.average)],
                [
                  "Notas 4 e 5",
                  summary.total ? `${Math.round((summary.positive / summary.total) * 100)}%` : "—",
                ],
                ["Com comentários", String(summary.withComments)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-card px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
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
                <div className="grid gap-3 xl:grid-cols-[0.9fr_1.6fr]">
                  <section
                    className="rounded-lg border border-border bg-card p-3"
                    aria-labelledby="feedback-distribution"
                  >
                    <h2 id="feedback-distribution" className="font-semibold">
                      Distribuição das notas
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Avaliação geral do encontro
                    </p>
                    <ul className="mt-3 grid grid-cols-5 gap-2">
                      {[5, 4, 3, 2, 1].map((score) => {
                        const count = summary.distribution[score - 1];
                        const percent = Math.round((count / summary.total) * 100);
                        return (
                          <li
                            key={score}
                            className="min-w-0 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
                            aria-label={`Nota ${score}: ${count} avaliações (${percent}%)`}
                          >
                            <span className="flex items-center gap-1 font-medium tabular-nums">
                              {score}
                              <Star aria-hidden="true" className="size-3" />
                            </span>
                            <div
                              aria-hidden="true"
                              className="mt-1.5 h-1 overflow-hidden rounded-full bg-background"
                            >
                              <div
                                className="h-full rounded-full bg-brand-gold"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="mt-1 block tabular-nums text-muted-foreground">
                              {count} · {percent}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  <section
                    className="rounded-lg border border-border bg-card p-3"
                    aria-labelledby="feedback-aspects"
                  >
                    <h2 id="feedback-aspects" className="font-semibold">
                      Notas por critério
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Médias de 1 a 5. “Não utilizei” fica fora da média.
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      {summary.aspects.map((aspect) => (
                        <div
                          key={aspect.key}
                          className="min-w-0 rounded-md bg-muted/50 px-2 py-1.5"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <dt className="truncate text-xs" title={aspect.label}>
                              {aspect.label}
                            </dt>
                            <dd className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatFeedbackScore(aspect.average)}
                            </dd>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {aspect.count} respostas
                            {aspect.notUsed > 0 ? ` · ${aspect.notUsed} não utilizaram` : ""}
                          </div>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>

                <section aria-labelledby="feedback-responses" className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 id="feedback-responses" className="text-lg font-semibold">
                        Respostas recebidas
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mais recentes primeiro. O resumo acima considera todas as avaliações.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        Nota geral
                        <select
                          value={rating}
                          onChange={(event) => {
                            setRating(event.target.value);
                            setPage(0);
                          }}
                          className="min-h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Todas</option>
                          {RATING_LABELS.map((label, index) => (
                            <option key={label} value={index + 1}>
                              {index + 1} · {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs">
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
                    <p className="rounded-md border border-border bg-card p-4 text-sm">
                      Nenhuma avaliação corresponde aos filtros.
                    </p>
                  )}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <table className="w-full min-w-[1020px] table-fixed border-collapse text-left text-xs">
                      <caption className="sr-only">
                        Notas por critério, data de envio e comentários das avaliações recebidas
                      </caption>
                      <colgroup>
                        <col className="w-36" />
                        <col className="w-28" />
                        {FEEDBACK_ASPECTS.map(({ key }) => (
                          <col key={key} className="w-[5.5rem]" />
                        ))}
                        <col className="w-48" />
                      </colgroup>
                      <thead className="bg-muted/70 text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Enviada em
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Nota geral
                          </th>
                          {FEEDBACK_ASPECTS.map(({ key, label }) => (
                            <th key={key} scope="col" className="px-2 py-2 font-medium">
                              {label}
                            </th>
                          ))}
                          <th scope="col" className="px-3 py-2 font-medium">
                            Comentários
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => {
                          const comments = [
                            ...FEEDBACK_ASPECTS.filter(
                              ({ key }) => !!row.criterion_comments[key]?.trim(),
                            ).map(({ key, label }) => ({
                              label,
                              text: row.criterion_comments[key],
                            })),
                            ...(row.suggestion.trim()
                              ? [{ label: "Sugestão geral", text: row.suggestion }]
                              : []),
                          ];
                          return (
                            <tr key={row.submission_id} className="align-top hover:bg-muted/30">
                              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                                <time dateTime={row.created_at}>
                                  {dateFormatter.format(new Date(row.created_at))}
                                </time>
                              </td>
                              <th scope="row" className="whitespace-nowrap px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1.5">
                                  <Star aria-hidden="true" className="size-3.5" />
                                  {row.overall}/5 · {RATING_LABELS[row.overall - 1]}
                                </span>
                              </th>
                              {FEEDBACK_ASPECTS.map(({ key }) => (
                                <td key={key} className="px-2 py-2 tabular-nums">
                                  {row[key] === null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    `${row[key]}/5`
                                  )}
                                  {row[key] === null && (
                                    <span className="sr-only">Não utilizei</span>
                                  )}
                                </td>
                              ))}
                              <td className="whitespace-normal px-3 py-2">
                                {comments.length ? (
                                  <details className="max-w-48">
                                    <summary className="min-h-6 cursor-pointer font-medium underline decoration-border underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                      {comments.length}{" "}
                                      {comments.length === 1 ? "comentário" : "comentários"}
                                    </summary>
                                    <div className="space-y-2 py-2">
                                      {comments.map((comment) => (
                                        <div key={comment.label}>
                                          <h4 className="font-semibold">{comment.label}</h4>
                                          <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
                                            {comment.text}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                ) : (
                                  <span className="text-muted-foreground">Nenhum</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
