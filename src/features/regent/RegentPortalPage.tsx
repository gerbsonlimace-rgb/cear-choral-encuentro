import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminChoirPricing } from "@/lib/choir-pricing.functions";
import {
  getRegentPortalSummary,
  listRegentPortalParticipants,
  startComplementCheckout,
} from "@/lib/regent.functions";
import type { RegentAccess } from "./regent.domain";
import type { PortalParticipant } from "./regent-payments.domain";
import { formatComplementCents } from "./regent-payments.domain";
import { ComplementPaymentDialog } from "./ComplementPaymentDialog";
import { RegentParticipantList } from "./RegentParticipantList";

type Props = {
  access: Extract<RegentAccess, { status: "authorized" }>;
  list?: typeof listRegentPortalParticipants;
  summary?: typeof getRegentPortalSummary;
  checkout?: typeof startComplementCheckout;
};
export function RegentPortalPage({
  access,
  list = listRegentPortalParticipants,
  summary = getRegentPortalSummary,
  checkout = startComplementCheckout,
}: Props) {
  const [choirs, setChoirs] = useState<Array<{ id: string; name: string }>>([]);
  const [choirId, setChoirId] = useState(access.role === "regent" ? access.choirId : "");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PortalParticipant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState({
    totalParticipants: 0,
    eligibleComplementCents: 0,
    confirmedComplementCents: 0,
    outstandingComplementCents: 0,
  });
  const [selected, setSelected] = useState<PortalParticipant | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (access.role === "admin")
      void getAdminChoirPricing()
        .then((data) => {
          setChoirs(data.choirs.map((c) => ({ id: c.id, name: c.name })));
          if (!choirId && data.choirs[0]) setChoirId(data.choirs[0].id);
        })
        .catch(() => setError("Não foi possível carregar os coros."));
  }, [access.role, choirId]);
  useEffect(() => {
    if (!choirId) return;
    setError("");
    void Promise.all([
      list({ data: { choirId, search: query.trim(), page, pageSize: 10 } }),
      summary({ data: { choirId } }),
    ])
      .then(([result, totals]) => {
        setRows(result.rows);
        setTotal(result.total);
        setSum(totals);
      })
      .catch(() => setError("Não foi possível carregar os participantes."));
  }, [choirId, query, page, list, summary]);
  const choirName =
    choirs.find((c) => c.id === choirId)?.name ??
    (access.role === "regent" ? "Seu coro" : "Selecione um coro");
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Área do regente</p>
          <h1 className="font-display text-3xl">{choirName}</h1>
        </div>
        {access.role === "admin" && (
          <label className="text-sm">
            Coro
            <select
              aria-label="Coro"
              className="mt-1 block h-9 rounded-md border bg-background px-3"
              value={choirId}
              onChange={(e) => {
                setChoirId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Selecione</option>
              {choirs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total de participantes", sum.totalParticipants],
          ["Complemento total", formatComplementCents(sum.eligibleComplementCents)],
          ["Complemento confirmado", formatComplementCents(sum.confirmedComplementCents)],
          ["Saldo complementar", formatComplementCents(sum.outstandingComplementCents)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </section>
      <div className="flex items-center gap-3">
        <Input
          aria-label="Buscar participante"
          placeholder="Buscar por nome ou CPF"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />{" "}
        <span className="text-sm text-muted-foreground">{total} participante(s)</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {choirId && <RegentParticipantList rows={rows} onPay={setSelected} />}
      <div className="flex justify-center gap-3">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span className="text-sm">Página {page}</span>
        <button type="button" disabled={page * 10 >= total} onClick={() => setPage((p) => p + 1)}>
          Próxima
        </button>
      </div>
      <ComplementPaymentDialog
        participant={selected}
        onClose={() => setSelected(null)}
        startCheckout={(input) => checkout({ data: input })}
      />
    </main>
  );
}
