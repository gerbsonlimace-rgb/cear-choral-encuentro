import { useEffect, useState } from "react";
import { Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatNoticeDate,
  sortEventNotices,
  type EventNotice,
} from "@/features/event-notices/eventNotice.domain";
import { getParticipantEventNotices } from "@/lib/event-notice.functions";

export function ChoristerNotices({
  loadNotices = getParticipantEventNotices,
}: {
  loadNotices?: () => Promise<EventNotice[]>;
}) {
  const [notices, setNotices] = useState<EventNotice[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void Promise.resolve()
      .then(loadNotices)
      .then((data) => {
        if (active) {
          setNotices(sortEventNotices(data));
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setNotices([]);
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [loadNotices, revision]);

  return (
    <section aria-labelledby="home-notices-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-notices-title"
          className="flex items-center gap-2 text-sm font-semibold text-zinc-900"
        >
          <Megaphone aria-hidden="true" className="size-4 text-zinc-500" /> Avisos
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 text-zinc-600"
          aria-label="Atualizar avisos"
          disabled={status === "loading"}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${status === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`}
          />{" "}
          Atualizar
        </Button>
      </div>
      {status === "loading" && (
        <p role="status" className="text-sm text-zinc-500">
          Carregando avisos…
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-zinc-700"
        >
          Não foi possível carregar os avisos.
        </p>
      )}
      {status === "ready" &&
        (notices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            Nenhum aviso publicado por enquanto.
          </p>
        ) : (
          <div className="space-y-3">
            {(expanded ? notices : notices.slice(0, 3)).map((notice) => (
              <article
                key={notice.id}
                className="min-w-0 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
              >
                <p className="break-words text-xs font-medium text-zinc-500">{notice.eventName}</p>
                <h3 className="break-words text-base font-semibold leading-snug text-zinc-950">
                  {notice.title}
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere]">
                  {notice.body}
                </p>
                <time dateTime={notice.createdAt} className="block pt-1 text-xs text-zinc-500">
                  {formatNoticeDate(notice.createdAt)}
                </time>
              </article>
            ))}
            {notices.length > 3 && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Mostrar menos avisos" : `Ver todos os avisos (${notices.length})`}
              </Button>
            )}
          </div>
        ))}
    </section>
  );
}
