import { useEffect, useRef, useState, type FormEvent } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminChoir } from "@/features/choirs/choir-pricing.domain";
import { getAdminChoirPricing } from "@/lib/choir-pricing.functions";
import {
  getRegentPortalSummary,
  listRegentPortalParticipants,
  type RegentPortalBootstrap,
} from "@/lib/regent.functions";

import { BalancePaymentDialog } from "./BalancePaymentDialog";
import {
  formatComplementCents,
  type BalancePaymentTarget,
  type PortalParticipant,
  type PortalSummary,
} from "./regent-payments.domain";
import type { RegentAccess } from "./regent.domain";
import type { PortalParticipantPage } from "./regent-portal.server";
import { RegentParticipantList } from "./RegentParticipantList";

type AuthorizedAccess = Extract<RegentAccess, { status: "authorized" }>;
type PortalListInput = {
  data: { choirId?: string; search: string; page: number; pageSize: number };
};
type PortalSummaryInput = { data: { choirId?: string } };

type Props = {
  access: AuthorizedAccess;
  loadParticipants?: (input: PortalListInput) => Promise<PortalParticipantPage>;
  loadSummary?: (input: PortalSummaryInput) => Promise<PortalSummary>;
  loadAdminChoirs?: () => Promise<AdminChoir[]>;
  initialData?: RegentPortalBootstrap;
};

const PAGE_SIZE = 20;
const defaultLoadAdminChoirs = async () => (await getAdminChoirPricing()).choirs;

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}

export function RegentPortalPage({
  access,
  loadParticipants = listRegentPortalParticipants,
  loadSummary = getRegentPortalSummary,
  loadAdminChoirs = defaultLoadAdminChoirs,
  initialData,
}: Props) {
  const [choirs, setChoirs] = useState<AdminChoir[]>(initialData?.choirs ?? []);
  const [selectedChoirId, setSelectedChoirId] = useState(
    initialData?.selectedChoirId ?? (access.role === "regent" ? access.choirId : ""),
  );
  const [choirError, setChoirError] = useState("");
  const [summary, setSummary] = useState<PortalSummary | null>(initialData?.summary ?? null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [result, setResult] = useState<PortalParticipantPage | null>(
    initialData?.participants ?? null,
  );
  const [listError, setListError] = useState("");
  const [listRetry, setListRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [paymentTarget, setPaymentTarget] = useState<BalancePaymentTarget | null>(null);
  const [portalRefresh, setPortalRefresh] = useState(0);
  const skipInitialSummary = useRef(Boolean(initialData));
  const skipInitialList = useRef(Boolean(initialData));

  useEffect(() => {
    if (access.role !== "admin" || initialData) return;
    let disposed = false;
    setChoirError("");
    loadAdminChoirs()
      .then((loadedChoirs) => {
        if (disposed) return;
        setChoirs(loadedChoirs);
        setSelectedChoirId((current) => current || loadedChoirs[0]?.id || "");
      })
      .catch(() => {
        if (!disposed) setChoirError("Não foi possível carregar os coros. Tente novamente.");
      });
    return () => {
      disposed = true;
    };
  }, [access.role, initialData, loadAdminChoirs]);

  const ready = access.role === "regent" || Boolean(selectedChoirId);

  useEffect(() => {
    if (!ready) return;
    if (skipInitialSummary.current) {
      skipInitialSummary.current = false;
      return;
    }
    let disposed = false;
    setSummaryLoading(true);
    setSummaryError("");
    setSummary(null);
    loadSummary({ data: access.role === "admin" ? { choirId: selectedChoirId } : {} })
      .then((loadedSummary) => {
        if (!disposed) setSummary(loadedSummary);
      })
      .catch(() => {
        if (!disposed) setSummaryError("Não foi possível carregar o resumo. Tente novamente.");
      })
      .finally(() => {
        if (!disposed) setSummaryLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [access.role, loadSummary, portalRefresh, ready, selectedChoirId]);

  useEffect(() => {
    if (!ready) return;
    if (skipInitialList.current) {
      skipInitialList.current = false;
      return;
    }
    let disposed = false;
    setLoading(true);
    setListError("");
    setResult(null);
    loadParticipants({
      data: {
        ...(access.role === "admin" ? { choirId: selectedChoirId } : {}),
        search: query.search,
        page: query.page,
        pageSize: PAGE_SIZE,
      },
    })
      .then((page) => {
        if (!disposed) setResult(page);
      })
      .catch(() => {
        if (!disposed) setListError("Não foi possível carregar os participantes. Tente novamente.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [
    access.role,
    listRetry,
    loadParticipants,
    portalRefresh,
    query.page,
    query.search,
    ready,
    selectedChoirId,
  ]);

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") setPortalRefresh((value) => value + 1);
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => document.removeEventListener("visibilitychange", refreshOnReturn);
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery({ search: searchDraft.trim(), page: 1 });
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const activeChoirName =
    access.role === "regent"
      ? access.choirName
      : choirs.find((choir) => choir.id === selectedChoirId)?.name;

  return (
    <main className="min-h-svh bg-muted/20 px-4 py-6 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Encontro de Coros Diocesanos
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Área do regente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe participantes e complementos da inscrição.
          </p>
          <div className="mt-3 space-y-0.5 text-sm">
            <p className="font-medium text-foreground">
              {access.role === "regent"
                ? access.name
                : `Administrador · ${access.email ?? "e-mail não informado"}`}
            </p>
            {access.role === "regent" && <p className="text-muted-foreground">{access.email}</p>}
            {activeChoirName && (
              <p className="text-muted-foreground">Coro ativo: {activeChoirName}</p>
            )}
          </div>
        </header>

        {access.role === "admin" && (
          <Card>
            <CardContent className="space-y-2 p-4 sm:max-w-md">
              <Label htmlFor="regent-choir">Coro</Label>
              <Select
                value={selectedChoirId}
                onValueChange={(choirId) => {
                  setSelectedChoirId(choirId);
                  setSearchDraft("");
                  setQuery({ search: "", page: 1 });
                }}
              >
                <SelectTrigger id="regent-choir" aria-label="Coro">
                  <SelectValue placeholder="Selecione um coro" />
                </SelectTrigger>
                <SelectContent>
                  {choirs.map((choir) => (
                    <SelectItem key={choir.id} value={choir.id}>
                      {choir.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {choirError && (
                <p role="alert" className="text-sm text-destructive">
                  {choirError}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {summaryLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : summaryError ? (
          <p role="alert" className="text-sm text-destructive">
            {summaryError}
          </p>
        ) : summary ? (
          <section
            aria-label="Resumo dos complementos"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <SummaryCard label="Total de participantes" value={String(summary.totalParticipants)} />
            <SummaryCard
              label="Complemento total"
              value={formatComplementCents(summary.eligibleComplementCents)}
            />
            <SummaryCard
              label="Complemento confirmado"
              value={formatComplementCents(summary.confirmedComplementCents)}
            />
            <SummaryCard
              label="Saldo a receber"
              value={formatComplementCents(summary.outstandingComplementCents)}
            />
          </section>
        ) : null}

        <form
          onSubmit={search}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="participant-search">Pesquisar participantes</Label>
            <Input
              id="participant-search"
              type="search"
              maxLength={100}
              placeholder="Nome ou CPF"
              value={searchDraft}
              disabled={!ready || loading}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!ready || loading}>
            Pesquisar
          </Button>
        </form>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : listError ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p role="alert" className="text-sm text-destructive">
                {listError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setListRetry((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : result?.rows.length ? (
          <RegentParticipantList
            participants={result.rows}
            onPay={(participant) => {
              if (
                participant.financialState.status !== "partially_paid" ||
                !participant.complement.eligible
              ) {
                return;
              }
              setPaymentTarget({
                id: participant.id,
                name: participant.name,
                balanceCents: participant.complement.balanceCents,
              });
            }}
          />
        ) : result ? (
          <Card>
            <CardContent className="p-6 text-center text-sm">
              Nenhum participante encontrado.
            </CardContent>
          </Card>
        ) : null}

        {result && (
          <nav
            aria-label="Paginação de participantes"
            className="flex items-center justify-between gap-3"
          >
            <p className="text-xs text-muted-foreground">
              Página {result.page} de {pages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || result.page <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || result.page >= pages}
                onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
              >
                Próxima
              </Button>
            </div>
          </nav>
        )}
      </div>

      <BalancePaymentDialog
        target={paymentTarget}
        open={paymentTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
      />
    </main>
  );
}
