import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportAdminRegistrations,
  getAdminAccess,
  getAdminRegistrationSummary,
  listAdminRegistrations,
  reprocessParticipantAccess,
  resetParticipantInitialPassword,
  type AdminAccessState,
  type AdminRegistrationsBootstrap,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminExportFile,
  AdminRegistrationExportQuery,
  AdminRegistrationPage,
  AdminRegistrationQuery,
  AdminRegistrationRow,
  AdminRegistrationSummary,
} from "./admin.domain";
import { AdminNavigation } from "./AdminNavigation";

type Props = {
  onSignedOut: () => void;
  onMissingSession: () => void;
  checkAdmin?: () => Promise<AdminAccessState>;
  loadInitialData?: () => Promise<AdminRegistrationsBootstrap>;
  loadRegistrations?: (input: { data: AdminRegistrationQuery }) => Promise<AdminRegistrationPage>;
  loadSummary?: () => Promise<AdminRegistrationSummary>;
  exportRegistrations?: (input: { data: AdminRegistrationExportQuery }) => Promise<AdminExportFile>;
  reprocessAccess?: (input: { data: { registrationId: string } }) => Promise<unknown>;
  resetInitialPassword?: (input: { data: { registrationId: string } }) => Promise<{
    status: "success";
    sessionsRevoked: false;
  }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  navigateTo?: (
    to: "/admin/inscricoes" | "/admin/coros" | "/admin/patrocinadores" | "/regente",
  ) => void;
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();
const initialQuery: AdminRegistrationQuery = {
  search: "",
  paymentStatus: "all",
  page: 1,
  pageSize: 25,
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza" });
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "Não informado";
const money = (value: number | null) =>
  value === null ? "Não informado" : moneyFormatter.format(value / 100);

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function ParticipantAvatar({ row }: { row: AdminRegistrationRow }) {
  return (
    <Avatar className="h-10 w-10 shrink-0 border border-border">
      {row.photoUrl && <AvatarImage src={row.photoUrl} alt={`Foto de ${row.name}`} />}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {nameInitials(row.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function Status({ row }: { row: AdminRegistrationRow }) {
  return (
    <Badge variant={row.paymentStatus === "paid" ? "default" : "secondary"}>
      {{ legacy: "Histórico", pending: "Pendente", paid: "Pago" }[row.paymentStatus]}
    </Badge>
  );
}

function Payment({ row }: { row: AdminRegistrationRow }) {
  const method =
    row.paymentMethod === "pix"
      ? "Pix"
      : row.paymentMethod === "credit_card"
        ? `Cartão${row.installments === null ? "" : ` · ${row.installments}x`}`
        : "Não informado";
  return (
    <dl className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-muted-foreground">Inscrição</dt>
        <dd>
          {row.pricingType === null
            ? "Não informado"
            : `${row.pricingType === "promotional" ? "Promocional" : "Normal"} · ${money(row.registrationPriceCents)}`}
        </dd>
      </div>
      {row.pricingType === "promotional" && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Valor normal</dt>
          <dd>{money(row.standardPriceCents)}</dd>
        </div>
      )}
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-muted-foreground">Esperado</dt>
        <dd>{money(row.amountCents)}</dd>
      </div>
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-muted-foreground">Valor pago</dt>
        <dd>{money(row.paidAmountCents)}</dd>
      </div>
      <div>
        <dt className="sr-only">Forma de pagamento</dt>
        <dd>{method}</dd>
      </div>
      <div className="flex flex-wrap gap-x-2">
        <dt className="text-muted-foreground">Pago em</dt>
        <dd>{date(row.paidAt)}</dd>
      </div>
    </dl>
  );
}

function pendingAmountCents(row: AdminRegistrationRow): number | null {
  if (row.paymentStatus !== "pending") return null;
  return Math.max(0, (row.amountCents ?? 0) - (row.paidAmountCents ?? 0));
}

function ParticipantAccessActions({
  row,
  busy,
  onReprocess,
  onReset,
}: {
  row: AdminRegistrationRow;
  busy: boolean;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const access = row.participantAccess;
  if (!access) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant={access.label === "Ativo" ? "default" : "secondary"}>{access.label}</Badge>
      {access.canReprocess && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onReprocess(row)}>
          Reprocessar acesso
        </Button>
      )}
      {access.canReset && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmReset(true)}>
            Redefinir senha inicial
          </Button>
          <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Redefinir senha inicial?</AlertDialogTitle>
                <AlertDialogDescription>
                  A pessoa poderá usar novamente a senha inicial no próximo acesso.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={() => void onReset(row).then(() => setConfirmReset(false))}
                >
                  Confirmar redefinição
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function RegistrationViews({
  rows,
  participantActionBusy,
  onReprocess,
  onReset,
}: {
  rows: AdminRegistrationRow[];
  participantActionBusy: boolean;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
}) {
  return (
    <>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table aria-label="Inscrições">
          <TableHeader>
            <TableRow>
              {["Coralista", "Valor pago", "Valor pendente", "WhatsApp", "Coro", "Regente"].map(
                (label) => (
                  <TableHead key={label} scope="col">
                    {label}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-56 align-top">
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar row={row} />
                    <div className="min-w-0">
                      <p className="break-words font-medium">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">CPF {row.cpf}</p>
                      <div className="mt-1">
                        <Status row={row} />
                      </div>
                      <ParticipantAccessActions
                        row={row}
                        busy={participantActionBusy}
                        onReprocess={onReprocess}
                        onReset={onReset}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">{money(row.paidAmountCents)}</TableCell>
                <TableCell className="align-top">
                  {pendingAmountCents(row) === null ? "—" : money(pendingAmountCents(row))}
                </TableCell>
                <TableCell className="max-w-40 align-top">{row.phone}</TableCell>
                <TableCell className="max-w-44 align-top">
                  <p className="break-words font-medium">{row.choirName}</p>
                </TableCell>
                <TableCell className="max-w-44 align-top">
                  <p className="break-words">{row.regentName ?? "Não informado"}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <section aria-label="Cartões de inscrições" className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id} className="shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ParticipantAvatar row={row} />
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold">{row.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">CPF {row.cpf}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{date(row.createdAt)}</p>
                  </div>
                </div>
                <Status row={row} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Valor pago</dt>
                  <dd>{money(row.paidAmountCents)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Valor pendente</dt>
                  <dd>{pendingAmountCents(row) === null ? "—" : money(pendingAmountCents(row))}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd>{row.phone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coro</dt>
                  <dd className="break-words">{row.choirName}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Regente</dt>
                  <dd className="break-words">{row.regentName ?? "Não informado"}</dd>
                </div>
              </dl>
              <div className="border-t pt-3">
                <ParticipantAccessActions
                  row={row}
                  busy={participantActionBusy}
                  onReprocess={onReprocess}
                  onReset={onReset}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}

function RegistrationSummary({ summary }: { summary: AdminRegistrationSummary }) {
  const financial = [
    {
      label: "Recebido",
      value: money(summary.receivedCents),
      hint: `${summary.paid} ${summary.paid === 1 ? "inscrição paga" : "inscrições pagas"}`,
      valueClass: "text-primary",
    },
    {
      label: "Pendente",
      value: money(summary.pendingCents),
      hint: `${summary.pending} ${summary.pending === 1 ? "inscrição aguardando" : "inscrições aguardando"}`,
      valueClass: "text-foreground",
    },
    {
      label: "Total previsto",
      value: money(summary.expectedCents),
      hint: "Recebido + pendente + regente",
      valueClass: "text-foreground",
    },
  ];
  const counts = [
    { label: "Total", value: String(summary.total) },
    { label: "Pagas", value: String(summary.paid) },
    { label: "Pendentes", value: String(summary.pending) },
    { label: "Históricas", value: String(summary.legacy) },
    { label: "Pendente do regente", value: money(summary.pendingRegentCents) },
  ];

  return (
    <section aria-label="Visão geral das inscrições" className="space-y-4">
      <div role="group" aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-3">
        {financial.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-card p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${metric.valueClass}`}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Inscrições</h2>
            <p className="text-xs text-muted-foreground">Todos os registros</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
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
                        {money(item.receivedCents)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Pendente</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {money(item.pendingCents)}
                      </dd>
                    </div>
                    {item.pendingRegentCents > 0 && (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">Pendente do regente</dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {money(item.pendingRegentCents)}
                        </dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-2 border-t border-border/70 pt-1.5">
                      <dt className="text-muted-foreground">Total previsto</dt>
                      <dd className="font-semibold tabular-nums text-primary">
                        {money(item.expectedCents)}
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

export function AdminRegistrationsPage({
  onSignedOut,
  onMissingSession,
  checkAdmin = getAdminAccess,
  loadInitialData,
  loadRegistrations = listAdminRegistrations,
  loadSummary = getAdminRegistrationSummary,
  exportRegistrations = exportAdminRegistrations,
  reprocessAccess = reprocessParticipantAccess,
  resetInitialPassword = resetParticipantInitialPassword,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: Props) {
  const [gate, setGate] = useState<
    "checking" | "authorized" | "forbidden" | "error" | "expired" | "leaving"
  >("checking");
  const [result, setResult] = useState<AdminRegistrationPage | null>(null);
  const [summary, setSummary] = useState<AdminRegistrationSummary | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [exporting, setExporting] = useState(false);
  const [participantActionBusy, setParticipantActionBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [bootstrapDataReady, setBootstrapDataReady] = useState(false);
  const actionBusy = useRef(false);
  const revision = useRef(0);
  const invalidateAccess = useCallback(() => {
    revision.current++;
  }, []);

  const verifyAccess = useCallback(async () => {
    const current = ++revision.current;
    setGate("checking");
    setResult(null);
    setSummary(null);
    try {
      const access = await checkAdmin();
      if (current === revision.current) setGate(access.status);
    } catch {
      try {
        const session = await getSession();
        if (current !== revision.current) return;
        if (!session.error && !session.data.session) {
          setGate("expired");
          onMissingSession();
          return;
        }
      } catch {
        /* An unavailable local session cannot authorize or prove expiry. */
      }
      if (current === revision.current) setGate("error");
    }
  }, [checkAdmin, getSession, onMissingSession]);

  useEffect(() => {
    if (loadInitialData) {
      let active = true;
      setGate("checking");
      setLoading(true);
      setSummaryLoading(true);
      setListError("");
      setSummaryError("");
      // Without a local session the protected server fn would 401 and blank the page.
      const bootstrap = async () => {
        try {
          const session = await getSession();
          if (!session.error && !session.data.session) return null;
        } catch {
          /* An unavailable local session cannot prove expiry; try the server call. */
        }
        return loadInitialData();
      };
      void bootstrap()
        .then((result) => {
          if (!active) return;
          if (!result) {
            setGate("expired");
            onMissingSession();
            return;
          }
          if (result.access.status !== "authorized" || !result.data) {
            setGate(result.access.status);
            return;
          }
          setResult(result.data.registrations);
          setSummary(result.data.summary);
          setBootstrapDataReady(true);
          setGate("authorized");
        })
        .catch(async () => {
          if (!active) return;
          try {
            const session = await getSession();
            if (!active) return;
            if (!session.error && !session.data.session) {
              setGate("expired");
              onMissingSession();
              return;
            }
          } catch {
            /* An unavailable local session cannot authorize or prove expiry. */
          }
          setGate("error");
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
          setSummaryLoading(false);
        });
      return () => {
        active = false;
      };
    }
    void verifyAccess();
    return invalidateAccess;
  }, [getSession, invalidateAccess, loadInitialData, onMissingSession, verifyAccess]);

  useEffect(() => {
    if (gate !== "authorized") return;
    if (loadInitialData && bootstrapDataReady && retry === 0 && query === initialQuery) return;
    let active = true;
    setLoading(true);
    setResult(null);
    setListError("");
    void (async () => {
      try {
        const next = await loadRegistrations({ data: query });
        if (active) setResult(next);
      } catch {
        try {
          const session = await getSession();
          if (!active) return;
          if (!session.error && !session.data.session) {
            setGate("expired");
            onMissingSession();
            return;
          }
        } catch {
          /* Keep transient failures retryable. */
        }
        if (active) setListError("Não foi possível carregar as inscrições. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    bootstrapDataReady,
    gate,
    getSession,
    loadInitialData,
    loadRegistrations,
    onMissingSession,
    query,
    retry,
  ]);

  useEffect(() => {
    if (gate !== "authorized") return;
    if (loadInitialData && bootstrapDataReady && summaryRetry === 0) return;
    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    void loadSummary()
      .then((next) => {
        if (active) setSummary(next);
      })
      .catch(() => {
        if (active) setSummaryError("Não foi possível carregar os totais. Tente novamente.");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bootstrapDataReady, gate, loadInitialData, loadSummary, summaryRetry]);

  function search(event: FormEvent) {
    event.preventDefault();
    if (loading || actionBusy.current) return;
    setAnnouncement("");
    setQuery((previous) => ({ ...previous, search: searchDraft.trim(), page: 1 }));
  }

  async function exportCsv() {
    if (actionBusy.current || loading || gate !== "authorized") return;
    actionBusy.current = true;
    const current = revision.current;
    setExporting(true);
    setActionError("");
    setAnnouncement("");
    try {
      const file = await exportRegistrations({
        data: { search: query.search, paymentStatus: query.paymentStatus },
      });
      if (current !== revision.current) return;
      const url = URL.createObjectURL(new Blob([file.content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = file.fileName;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      setAnnouncement("CSV exportado.");
    } catch {
      if (current === revision.current)
        setActionError("Não foi possível exportar. Tente novamente.");
    } finally {
      actionBusy.current = false;
      if (current === revision.current) setExporting(false);
    }
  }

  async function runParticipantAction(
    row: AdminRegistrationRow,
    action: "reprocess" | "reset",
  ): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      if (action === "reprocess") {
        await reprocessAccess({ data: { registrationId: row.id } });
        setAnnouncement("Acesso reprocessado.");
      } else {
        const result = await resetInitialPassword({ data: { registrationId: row.id } });
        if (result.sessionsRevoked !== false) throw new Error("Unexpected reset result");
        setAnnouncement("Senha redefinida. Sessões que já estavam abertas não foram encerradas.");
      }
      setRetry((value) => value + 1);
    } catch {
      setActionError("Não foi possível atualizar o acesso. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function logout() {
    if (actionBusy.current) return;
    actionBusy.current = true;
    revision.current++;
    setGate("leaving");
    setResult(null);
    setSummary(null);
    setSearchDraft("");
    setQuery(initialQuery);
    setActionError("");
    setAnnouncement("");
    try {
      const response = await signOut();
      if (response.error) throw response.error;
      onSignedOut();
    } catch {
      setGate("error");
      setActionError("Não foi possível sair. Tente novamente.");
    } finally {
      actionBusy.current = false;
    }
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const statusText =
    gate === "checking"
      ? "Verificando acesso…"
      : gate === "expired"
        ? "Sessão expirada. Redirecionando para entrar…"
        : gate === "leaving"
          ? "Saindo…"
          : gate === "authorized"
            ? loading
              ? "Carregando inscrições…"
              : result
                ? `${result.total} ${result.total === 1 ? "inscrição encontrada" : "inscrições encontradas"}`
                : ""
            : "";

  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Encontro de Coros · Administração
            </p>
            <h1 className="mt-2 font-display text-2xl">Inscrições</h1>
          </div>
          {["authorized", "forbidden", "error"].includes(gate) && (
            <div className="flex gap-2">
              {gate === "authorized" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportCsv}
                  disabled={loading || exporting}
                >
                  {exporting ? "Exportando…" : "Exportar CSV"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={logout} disabled={exporting}>
                Sair
              </Button>
            </div>
          )}
        </header>
        {gate === "authorized" && (
          <AdminNavigation current="registrations" navigateTo={navigateTo} />
        )}
        <div aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
          <p>{statusText}</p>
          {announcement && <p>{announcement}</p>}
        </div>
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        {gate === "checking" && <Skeleton className="h-32 w-full" />}
        {gate === "forbidden" && (
          <p role="alert" className="text-sm text-destructive">
            Acesso não autorizado.
          </p>
        )}
        {gate === "error" && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p role="alert" className="text-sm">
                Não foi possível verificar seu acesso. Tente novamente.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setActionError("");
                  void verifyAccess();
                }}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
        {gate === "authorized" && (
          <>
            {summaryLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : summaryError ? (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <p role="alert" className="text-sm">
                    {summaryError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSummaryRetry((value) => value + 1)}
                  >
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              summary && <RegistrationSummary summary={summary} />
            )}
            <form
              onSubmit={search}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="registration-search">Pesquisar inscrições</Label>
                <div className="flex gap-2">
                  <Input
                    id="registration-search"
                    type="search"
                    maxLength={100}
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Nome, CPF, e-mail, telefone ou cidade"
                    disabled={loading || exporting}
                  />
                  <Button type="submit" disabled={loading || exporting}>
                    Pesquisar
                  </Button>
                </div>
              </div>
              <div className="space-y-2 sm:w-44">
                <Label htmlFor="registration-status">Situação</Label>
                <Select
                  value={query.paymentStatus}
                  disabled={loading || exporting}
                  onValueChange={(value: AdminRegistrationQuery["paymentStatus"]) => {
                    setAnnouncement("");
                    setQuery((previous) => ({ ...previous, paymentStatus: value, page: 1 }));
                  }}
                >
                  <SelectTrigger id="registration-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                    <SelectItem value="legacy">Históricas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : listError ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <p role="alert" className="text-sm">
                    {listError}
                  </p>
                  <Button size="sm" onClick={() => setRetry((value) => value + 1)}>
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              result &&
              (result.rows.length ? (
                <RegistrationViews
                  rows={result.rows}
                  participantActionBusy={participantActionBusy}
                  onReprocess={(row) => void runParticipantAction(row, "reprocess")}
                  onReset={(row) => runParticipantAction(row, "reset")}
                />
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-sm">
                    Nenhuma inscrição encontrada.
                  </CardContent>
                </Card>
              ))
            )}
            {result && (
              <nav
                aria-label="Paginação de inscrições"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-xs text-muted-foreground">
                  Página {result.page} de {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading || exporting || result.page <= 1}
                    onClick={() =>
                      setQuery((previous) => ({ ...previous, page: previous.page - 1 }))
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading || exporting || result.page >= pages}
                    onClick={() =>
                      setQuery((previous) => ({ ...previous, page: previous.page + 1 }))
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
