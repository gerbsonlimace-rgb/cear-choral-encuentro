import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  BadgeCheck,
  Banknote,
  ChartNoAxesCombined,
  Clock3,
  ExternalLink,
  Link2,
  MoreHorizontal,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { InternalMetricCard } from "@/components/internal-app/InternalMetricCard";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BalancePaymentDialog, isSafeCheckoutUrl } from "@/features/regent/BalancePaymentDialog";
import { startComplementCheckout } from "@/lib/regent.functions";
import {
  createAdminRegistrationCheckoutLink,
  exportAdminRegistrations,
  getAdminAccess,
  getAdminRegistrationReceipt,
  getAdminRegistrationSummary,
  listAdminRegistrations,
  markAdminRegistrationPaid,
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
import {
  getAdminFinancialState,
  manualPaymentReceiptMimeTypeSchema,
  MAX_MANUAL_PAYMENT_RECEIPT_BYTES,
  type ManualPaymentReceipt,
} from "./admin.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

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
  createPaymentLink?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    reused: boolean;
  }>;
  markPaid?: (input: {
    data: { registrationId: string; receipt: ManualPaymentReceipt };
  }) => Promise<{
    status: "paid";
    registrationId: string;
  }>;
  getReceiptUrl?: (input: { data: { registrationId: string } }) => Promise<{
    signedUrl: string;
    expiresIn: number;
  }>;
  openReceiptUrl?: (url: string) => void;
  copyToClipboard?: (value: string) => Promise<void>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
  startBalanceCheckout?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    orderNsu: string;
  }>;
  /** Test/embedding seam matching the shared dialog's naming. */
  startCheckout?: (input: { data: { registrationId: string } }) => Promise<{
    checkoutUrl: string;
    orderNsu: string;
  }>;
  navigateToCheckout?: (url: string) => void;
  navigateTo?: (to: AdminNavigationPath | "/regente") => void;
};

const defaultGetSession = () => supabase.auth.getSession();
const defaultSignOut = () => supabase.auth.signOut();
const defaultCopyToClipboard = (value: string) => navigator.clipboard.writeText(value);
const defaultOpenReceiptUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
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
  const status = getAdminFinancialState(row).status;
  return (
    <Badge variant={status === "paid" || status === "partially_paid" ? "default" : "secondary"}>
      {
        {
          legacy: "Histórico",
          pending: "Pendente",
          partially_paid: "Parcialmente pago",
          paid: "Pago",
        }[status]
      }
    </Badge>
  );
}

function pendingAmountCents(row: AdminRegistrationRow): number | null {
  return getAdminFinancialState(row).pendingCents;
}

function receivedAmountCents(row: AdminRegistrationRow): number | null {
  const state = getAdminFinancialState(row);
  return state.confirmedPrincipalCents ?? row.paidAmountCents;
}

function readReceipt(file: File): Promise<ManualPaymentReceipt> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o comprovante selecionado."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Não foi possível ler o comprovante selecionado."));
        return;
      }
      resolve({
        base64: result.slice(separator + 1),
        mimeType: manualPaymentReceiptMimeTypeSchema.parse(file.type),
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

function PaymentSummary({ row }: { row: AdminRegistrationRow }) {
  const received = receivedAmountCents(row);
  const pending = pendingAmountCents(row);
  return (
    <div className="space-y-1.5">
      <Status row={row} />
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {received !== null && <p>Recebido: <span className="font-medium text-foreground">{money(received)}</span></p>}
        {pending !== null && <p>Pendente: <span className="font-medium text-foreground">{money(pending)}</span></p>}
        {received === null && pending === null && <p>Valores não informados</p>}
      </div>
    </div>
  );
}

function RegistrationViews({
  rows,
  participantActionBusy,
  onReprocess,
  onReset,
  onBalancePayment,
  onPaymentLink,
  onMarkPaid,
  onViewReceipt,
}: {
  rows: AdminRegistrationRow[];
  participantActionBusy: boolean;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (row: AdminRegistrationRow, receipt: ManualPaymentReceipt) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
}) {
  return (
    <>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table aria-label="Inscrições">
          <TableHeader>
            <TableRow>
              {[
                "Coralista",
                "E-mail",
                "Pagamento",
                "WhatsApp",
                "Coro",
                "Mais",
              ].map((label) => (
                <TableHead key={label} scope="col">
                  {label}
                </TableHead>
              ))}
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
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-52 break-all align-top">{row.email}</TableCell>
                <TableCell className="min-w-36 align-top"><PaymentSummary row={row} /></TableCell>
                <TableCell className="max-w-40 align-top">{row.phone}</TableCell>
                <TableCell className="max-w-44 align-top">
                  <p className="break-words font-medium">{row.choirName}</p>
                </TableCell>
                <TableCell className="w-16 text-right align-top">
                  <RegistrationActions
                    row={row}
                    onReprocess={onReprocess}
                    onReset={onReset}
                    onBalancePayment={onBalancePayment}
                    onPaymentLink={onPaymentLink}
                    onMarkPaid={onMarkPaid}
                    onViewReceipt={onViewReceipt}
                    busy={participantActionBusy}
                  />
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
                <RegistrationActions
                  row={row}
                  onReprocess={onReprocess}
                  onReset={onReset}
                  onBalancePayment={onBalancePayment}
                  onPaymentLink={onPaymentLink}
                  onMarkPaid={onMarkPaid}
                  onViewReceipt={onViewReceipt}
                  busy={participantActionBusy}
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="break-all">{row.email}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="mb-1 text-muted-foreground">Pagamento</dt>
                  <dd><PaymentSummary row={row} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd>{row.phone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coro</dt>
                  <dd className="break-words">{row.choirName}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}

function RegistrationActions({
  row,
  onReprocess,
  onReset,
  onBalancePayment,
  onPaymentLink,
  onMarkPaid,
  onViewReceipt,
  busy,
}: {
  row: AdminRegistrationRow;
  onReprocess: (row: AdminRegistrationRow) => void;
  onReset: (row: AdminRegistrationRow) => Promise<void>;
  onBalancePayment: (row: AdminRegistrationRow) => void;
  onPaymentLink: (row: AdminRegistrationRow) => void;
  onMarkPaid: (row: AdminRegistrationRow, receipt: ManualPaymentReceipt) => Promise<boolean>;
  onViewReceipt: (row: AdminRegistrationRow) => void;
  busy: boolean;
}) {
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [receipt, setReceipt] = useState<ManualPaymentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const state = getAdminFinancialState(row);
  const openUrl = row.openComplementPayment?.checkoutUrl;
  const access = row.participantAccess;
  const selectReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceipt(null);
    setReceiptError("");
    if (!manualPaymentReceiptMimeTypeSchema.safeParse(file.type).success) {
      setReceiptError("Envie um comprovante em PDF, JPG ou PNG.");
      return;
    }
    if (file.size === 0 || file.size > MAX_MANUAL_PAYMENT_RECEIPT_BYTES) {
      setReceiptError("O comprovante deve ter entre 1 byte e 10 MB.");
      return;
    }
    try {
      setReceipt(await readReceipt(file));
    } catch {
      setReceiptError("Não foi possível ler o comprovante selecionado.");
    }
  };
  const openMarkPaid = () => {
    setReceipt(null);
    setReceiptError("");
    setConfirmMarkPaid(true);
  };
  const hasActions = row.hasManualReceipt || (typeof openUrl === "string" && isSafeCheckoutUrl(openUrl)) ||
    state.status === "pending" || (state.status === "partially_paid" && state.pendingCents > 0) ||
    access?.canReprocess || access?.canReset;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy || !hasActions}
            aria-label={`Mais ações para ${row.name}`}
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {row.hasManualReceipt && (
            <DropdownMenuItem onSelect={() => onViewReceipt(row)}>
              <ExternalLink aria-hidden="true" /> Ver comprovante
            </DropdownMenuItem>
          )}
          {openUrl && isSafeCheckoutUrl(openUrl) && (
            <DropdownMenuItem asChild><a href={openUrl}>Continuar pagamento</a></DropdownMenuItem>
          )}
          {state.status === "pending" && (
            <>
              <DropdownMenuItem onSelect={() => onPaymentLink(row)}>
                <Link2 aria-hidden="true" /> Gerar link de pagamento
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openMarkPaid}>
                <BadgeCheck aria-hidden="true" /> Marcar como pago
              </DropdownMenuItem>
            </>
          )}
          {state.status === "partially_paid" && state.pendingCents > 0 && !row.openComplementPayment && (
            <DropdownMenuItem onSelect={() => onBalancePayment(row)}>
              <Banknote aria-hidden="true" /> Pagar saldo de {money(state.pendingCents)}
            </DropdownMenuItem>
          )}
          {(access?.canReprocess || access?.canReset) && <DropdownMenuSeparator />}
          {access?.canReprocess && (
            <DropdownMenuItem onSelect={() => onReprocess(row)}>
              <RefreshCw aria-hidden="true" /> Reprocessar acesso
            </DropdownMenuItem>
          )}
          {access?.canReset && (
            <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
              <KeyRound aria-hidden="true" /> Redefinir senha inicial
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {row.openComplementPayment && !isSafeCheckoutUrl(openUrl ?? null) && (
        <span className="sr-only">Pagamento em processamento</span>
      )}
        <AlertDialog
          open={confirmMarkPaid}
          onOpenChange={(open) => {
            setConfirmMarkPaid(open);
            if (!open) {
              setReceipt(null);
              setReceiptError("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar inscrição como paga?</AlertDialogTitle>
              <AlertDialogDescription>
                Confirme que o valor de {money(pendingAmountCents(row))} foi recebido e anexe o
                comprovante antes de concluir esta ação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`payment-receipt-${row.id}`}>Comprovante de pagamento</Label>
              <Input
                id={`payment-receipt-${row.id}`}
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                aria-required="true"
                disabled={busy}
                onChange={(event) => void selectReceipt(event)}
              />
              {receipt && (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: {receipt.fileName}
                </p>
              )}
              {receiptError && (
                <p role="alert" className="text-sm text-destructive">
                  {receiptError}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy || !receipt}
                onClick={(event) => {
                  event.preventDefault();
                  if (!receipt) return;
                  void onMarkPaid(row, receipt).then((success) => {
                    if (success) setConfirmMarkPaid(false);
                  });
                }}
              >
                Confirmar pagamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
            <AlertDialogAction disabled={busy} onClick={() => void onReset(row).then(() => setConfirmReset(false))}>
              Confirmar redefinição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RegistrationFinancialSummary({ summary }: { summary: AdminRegistrationSummary }) {
  const financial = [
    {
      label: "Recebido",
      value: money(summary.receivedCents),
      hint: `${summary.paid} ${summary.paid === 1 ? "inscrição paga" : "inscrições pagas"}`,
      icon: Banknote,
    },
    {
      label: "Pendente",
      value: money(summary.pendingCents),
      hint: `${summary.pending} ${summary.pending === 1 ? "inscrição aguardando" : "inscrições aguardando"}`,
      icon: Clock3,
    },
    {
      label: "Total previsto",
      value: money(summary.expectedCents),
      hint: "Recebido + pendente + regente",
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <div role="group" aria-label="Resumo financeiro" className="grid gap-3 sm:grid-cols-3">
      {financial.map((metric) => (
        <InternalMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.hint}
          icon={metric.icon}
        />
      ))}
    </div>
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
  createPaymentLink = createAdminRegistrationCheckoutLink,
  markPaid = markAdminRegistrationPaid,
  getReceiptUrl = getAdminRegistrationReceipt,
  openReceiptUrl = defaultOpenReceiptUrl,
  copyToClipboard = defaultCopyToClipboard,
  reprocessAccess = reprocessParticipantAccess,
  resetInitialPassword = resetParticipantInitialPassword,
  startBalanceCheckout,
  startCheckout,
  navigateToCheckout,
  getSession = defaultGetSession,
  signOut = defaultSignOut,
  navigateTo,
}: Props) {
  const openBalanceCheckout = startBalanceCheckout ?? startCheckout ?? startComplementCheckout;
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
  const [balanceTarget, setBalanceTarget] = useState<AdminRegistrationRow | null>(null);
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

  async function runPaymentLinkAction(row: AdminRegistrationRow): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await createPaymentLink({ data: { registrationId: row.id } });
      if (!isSafeCheckoutUrl(result.checkoutUrl)) throw new Error("unsafe checkout URL");
      await copyToClipboard(result.checkoutUrl);
      setAnnouncement(
        result.reused ? "Link de pagamento copiado." : "Novo link de pagamento gerado e copiado.",
      );
    } catch {
      setActionError("Não foi possível gerar o link de pagamento. Tente novamente.");
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runMarkPaidAction(
    row: AdminRegistrationRow,
    receipt: ManualPaymentReceipt,
  ): Promise<boolean> {
    if (actionBusy.current || gate !== "authorized") return false;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await markPaid({ data: { registrationId: row.id, receipt } });
      if (result.status !== "paid") throw new Error("Unexpected payment result");
      setAnnouncement("Inscrição marcada como paga.");
      setRetry((value) => value + 1);
      return true;
    } catch {
      setActionError("Não foi possível marcar a inscrição como paga. Tente novamente.");
      return false;
    } finally {
      actionBusy.current = false;
      setParticipantActionBusy(false);
    }
  }

  async function runReceiptAction(row: AdminRegistrationRow): Promise<void> {
    if (actionBusy.current || gate !== "authorized") return;
    actionBusy.current = true;
    setParticipantActionBusy(true);
    setActionError("");
    try {
      const result = await getReceiptUrl({ data: { registrationId: row.id } });
      openReceiptUrl(result.signedUrl);
    } catch {
      setActionError("Não foi possível abrir o comprovante. Tente novamente.");
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
    <main className="internal-app min-h-svh bg-[#f7f7f5] px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
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
              summary && <RegistrationFinancialSummary summary={summary} />
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
                    <SelectItem value="partially_paid">Parcialmente pagas</SelectItem>
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
                  onBalancePayment={setBalanceTarget}
                  onPaymentLink={(row) => void runPaymentLinkAction(row)}
                  onMarkPaid={runMarkPaidAction}
                  onViewReceipt={(row) => void runReceiptAction(row)}
                />
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-sm">
                    Nenhuma inscrição encontrada.
                  </CardContent>
                </Card>
              ))
            )}
            <BalancePaymentDialog
              target={
                balanceTarget && getAdminFinancialState(balanceTarget).status === "partially_paid"
                  ? {
                      id: balanceTarget.id,
                      name: balanceTarget.name,
                      balanceCents: getAdminFinancialState(balanceTarget).pendingCents ?? 0,
                    }
                  : null
              }
              open={balanceTarget !== null}
              onOpenChange={(open) => {
                if (!open) setBalanceTarget(null);
              }}
              startCheckout={openBalanceCheckout}
              navigateToCheckout={navigateToCheckout}
            />
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
