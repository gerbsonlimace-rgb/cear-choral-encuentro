import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileDown, LoaderCircle, ExternalLink, HandCoins, Eye } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deliverFile, openPreparedPdf } from "@/lib/file-download";
import { listAdminChoirRaffles, settleAdminChoirRaffles, getAdminChoirRoster, markAdminRegistrationPaid, setAdminRegistrationRafflePaid } from "@/lib/admin.functions";
import type { AdminChoirFinancials, AdminRegistrationPdfExportQuery, AdminRegistrationRow } from "./admin.domain";
import { getAdminFinancialState, MAX_MANUAL_PAYMENT_RECEIPT_BYTES } from "./admin.domain";
import type { ManualPaymentReceipt } from "./admin.domain";
import type { AdminPdfFile } from "./admin-registration-pdf";
import { formatAdminRafflePending, getAdminRafflePending, getAdminRegistrationPendingCents } from "./admin-raffle.domain";
import { getManualPaymentDue, parseReceivedAmount } from "./admin-manual-payment.domain";
import type { ManualPaymentRemainder } from "./admin-manual-payment.domain";

export type PrepareChoirPdf = (input: { data: AdminRegistrationPdfExportQuery }) => Promise<AdminPdfFile>;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AdminChoirSummaryCard({
  item,
  preparePdf,
  onSettled,
}: {
  item: AdminChoirFinancials;
  preparePdf: PrepareChoirPdf;
  onSettled?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ blob: Blob; fileName: string } | null>(null);
  const active = useRef(false);
  const working = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function exportPdf() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await preparePdf({ data: {
        search: "", paymentStatus: "all", choirId: "all", musicalProfile: "all", loginStatus: "all", choirName: item.choirName,
      } });
      const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
      if (active.current) setFile({ blob: new Blob([bytes], { type: "application/pdf" }), fileName: result.fileName });
    } catch {
      if (active.current) setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      working.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <li className="min-w-0">
      <Card
        className="min-w-0 overflow-hidden rounded-xl border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
      >
        <div className="flex items-center justify-between gap-2 bg-brand-gold-soft px-2.5 py-1.5">
          <h3 className="min-w-0 break-words text-xs font-bold leading-4 text-brand-ink">
            {item.choirName}
          </h3>
          <span
            className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-ink"
          >
            {item.total} {item.total === 1 ? "inscrito" : "inscritos"}
          </span>
        </div>
        <CardContent className="p-2.5">
          <dl className="space-y-0.5 text-[11px] leading-4">
            {[
              {
                label: "Total recebido",
                value: money.format(item.receivedCents / 100),
                details: [
                  {
                    label: "Inscrições",
                    value: money.format(
                      (item.receivedCents - (item.rafflePaidCents ?? 0)) / 100,
                    ),
                  },
                  { label: "Rifas", value: money.format((item.rafflePaidCents ?? 0) / 100) },
                ],
              },
              { label: "Pendente taxa de inscrição", value: money.format(item.pendingCents / 100) },
              { label: "Pendente em rifas", value: formatAdminRafflePending({ cents: item.rafflePendingCents ?? 0, tickets: item.rafflePendingTickets ?? null }) },
              { label: "Total previsto", value: money.format(item.expectedCents / 100) },
            ].map(({ label, value, details }) => (
              <div key={label} className="space-y-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
                {details && (
                  <dl className="space-y-0.5 text-[10px] leading-4 text-muted-foreground">
                    {details.map((detail) => (
                      <div key={detail.label} className="flex flex-wrap justify-between gap-x-2">
                        <dt>{detail.label}</dt>
                        <dd className="font-medium tabular-nums">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </dl>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5 border-t pt-2">
            <ChoirDetailsDialog item={item} />
            {((item.rafflePendingCents ?? 0) > 0 || (item.rafflePaidCents ?? 0) > 0) && (
              <RaffleSettlementDialog item={item} onSettled={onSettled} />
            )}
            {file && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                aria-label={`Abrir PDF de ${item.choirName}`}
                onClick={() => openPreparedPdf(file.blob)}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Abrir PDF
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busy}
              aria-label={`${file ? "Baixar PDF" : "Exportar PDF"} de ${item.choirName}`}
              onClick={() => {
                if (file) {
                  setError("");
                  void deliverFile(file.blob, file.fileName).catch(() => {
                    if (active.current) setError("Não foi possível baixar o PDF. Tente novamente.");
                  });
                } else void exportPdf();
              }}
            >
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : file ? <Download aria-hidden="true" className="size-4" /> : <FileDown aria-hidden="true" className="size-4" />}
              {busy ? "Gerando…" : file ? "Baixar PDF" : "Exportar PDF"}
            </Button>
          </div>
          {file && (
            <p role="status" className="mt-1.5 text-[10px] text-muted-foreground">
              PDF pronto. Baixar PDF
            </p>
          )}
          {error && (
            <p role="alert" className="mt-1.5 text-[10px] text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

type ChoirRaffleRow = {
  registrationId: string;
  name: string;
  pendingCents: number;
  pendingTickets: number | null;
  paidCents: number | null;
};

function RaffleSettlementDialog({
  item,
  onSettled,
}: {
  item: AdminChoirFinancials;
  onSettled?: () => void;
}) {
  const listRaffles = useServerFn(listAdminChoirRaffles);
  const settleRaffles = useServerFn(settleAdminChoirRaffles);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ChoirRaffleRow[]>([]);
  const [totalPendingCents, setTotalPendingCents] = useState(0);
  const [totalPaidCents, setTotalPaidCents] = useState(0);
  const [totalInput, setTotalInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const parsedTotal =
    totalInput.trim() === "" ? undefined : (parseReceivedAmount(totalInput) ?? undefined);
  const invalidTotal = totalInput.trim() !== "" && parsedTotal === undefined;
  const expectedTotalCents = totalPaidCents + totalPendingCents;
  // Amount informed above every expected raffle: extra sales must be recorded,
  // not discarded as change.
  const projectedExtra =
    parsedTotal !== undefined && parsedTotal > expectedTotalCents
      ? parsedTotal - expectedTotalCents
      : 0;

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await listRaffles({ data: { choirName: item.choirName } });
      setRows(result.rows);
      setTotalPendingCents(result.totalPendingCents);
      setTotalPaidCents(result.totalPaidCents);
    } catch {
      setError("Não foi possível carregar as rifas do coro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function settle(totalCents: number | undefined) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await settleRaffles({ data: { choirName: item.choirName, totalCents } });
      setMessage(
        result.leftoverCents > 0
          ? `Rifas pagas: ${money.format(result.settledCents / 100)}. Inclui ${money.format(result.leftoverCents / 100)} vendidos acima do previsto.`
          : result.remainingCents > 0
            ? `Rifas pagas: ${money.format(result.settledCents / 100)}. Ainda faltam ${money.format(result.remainingCents / 100)}.`
            : `Rifas pagas: ${money.format(result.settledCents / 100)}. Todas as rifas quitadas.`,
      );
      setTotalInput("");
      await load();
      onSettled?.();
    } catch {
      setError("Não foi possível quitar as rifas. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        aria-label={`Quitar rifas de ${item.choirName}`}
        onClick={() => {
          setOpen(true);
          setTotalInput("");
          void load();
        }}
      >
        <HandCoins aria-hidden="true" className="size-4" />
        Quitar rifas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quitar rifas — {item.choirName}</DialogTitle>
            <DialogDescription>
              Informe o valor total recebido em rifas. O valor passa a ser o total registrado do
              coro; vendas acima do previsto também são registradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Rifas já pagas</span>
                <span className="font-semibold tabular-nums">
                  {money.format(totalPaidCents / 100)}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Pendente em rifas</span>
                <span className="font-semibold tabular-nums">
                  {formatAdminRafflePending({
                    cents: totalPendingCents,
                    tickets:
                      totalPendingCents > 0 && totalPendingCents % 1000 === 0
                        ? totalPendingCents / 1000
                        : null,
                  })}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`raffle-total-${item.choirName}`}>Valor total recebido (R$)</Label>
              <Input
                id={`raffle-total-${item.choirName}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={totalInput}
                disabled={saving || loading}
                aria-invalid={invalidTotal}
                onChange={(event) => setTotalInput(event.target.value)}
              />
              <p className={invalidTotal ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                {invalidTotal
                  ? "Informe um valor válido."
                  : projectedExtra > 0
                    ? `Venda extra de ${money.format(projectedExtra / 100)} acima do previsto, que também será registrada.`
                    : parsedTotal !== undefined
                      ? parsedTotal < totalPaidCents
                        ? `O total será ajustado para ${money.format(parsedTotal / 100)}.`
                        : `O total registrado passará a ser ${money.format(parsedTotal / 100)}.`
                      : "Deixe em branco para quitar todas as rifas pendentes."}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Coralistas ({rows.length})
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum coralista com rifas pendentes.</p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {rows.map((row) => (
                    <li
                      key={row.registrationId}
                      className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sm"
                    >
                      <span className="min-w-0 break-words">{row.name}</span>
                      <span
                        className={
                          row.pendingCents === 0
                            ? "font-semibold text-emerald-600"
                            : "font-semibold tabular-nums"
                        }
                      >
                        {row.pendingCents > 0
                          ? formatAdminRafflePending({
                              cents: row.pendingCents,
                              tickets: row.pendingTickets,
                            })
                          : "Quitado"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-600">{message}</p>}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || loading || totalPendingCents === 0}
              onClick={() => void settle(undefined)}
            >
              Quitar todas as rifas
            </Button>
            <Button
              type="button"
              disabled={saving || loading || invalidTotal || parsedTotal === undefined || parsedTotal === 0}
              onClick={() => void settle(parsedTotal)}
            >
              {saving ? "Salvando…" : "Registrar total recebido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type ChoirRosterRow = AdminRegistrationRow;

type ChoirRoster = {
  rows: AdminRegistrationRow[];
  total: number;
  pendingFeeCents: number;
  rafflePendingCents: number;
  rafflePendingTickets: number | null;
  receivedCents: number;
  rafflePaidCents: number;
};

type RosterStatus = "paid" | "pending" | "partially_paid" | "exempt" | "legacy";

const rosterStatusLabels: Record<RosterStatus, string> = {
  paid: "Pago",
  pending: "Taxa pendente",
  partially_paid: "Parcialmente pago",
  exempt: "Isento",
  legacy: "Histórico",
};

function choirRosterRowView(row: AdminRegistrationRow) {
  const state = getAdminFinancialState(row);
  const registrationPendingCents = getAdminRegistrationPendingCents(row, state) ?? 0;
  const raffle = getAdminRafflePending(row, state);
  const registrationValueCents = row.registrationPriceCents ?? row.amountCents ?? null;
  const registrationColor =
    state.status === "legacy"
      ? "text-muted-foreground"
      : registrationPendingCents === 0 && state.status !== "pending"
        ? "text-emerald-600"
        : "text-amber-600";
  const raffleColor =
    raffle === null
      ? "text-muted-foreground"
      : raffle.cents === 0
        ? "text-emerald-600"
        : "text-amber-600";
  return {
    state,
    registrationPendingCents,
    raffle,
    registrationValueCents,
    registrationColor,
    raffleColor,
  };
}

function ChoirDetailsDialog({ item }: { item: AdminChoirFinancials }) {
  const loadRoster = useServerFn(getAdminChoirRoster);
  const markPaid = useServerFn(markAdminRegistrationPaid);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState<ChoirRoster | null>(null);

  const [paymentRow, setPaymentRow] = useState<AdminRegistrationRow | null>(null);
  const [originalAmountInput, setOriginalAmountInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [rafflePaidInput, setRafflePaidInput] = useState("");
  const [reason, setReason] = useState("");
  const [remainder, setRemainder] = useState<ManualPaymentRemainder>("pending");
  const [receipt, setReceipt] = useState<ManualPaymentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRoster(await loadRoster({ data: { choirName: item.choirName } }));
    } catch {
      setError("Não foi possível carregar os detalhes do coro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!paymentRow) return;
    const row = paymentRow;
    const state = getAdminFinancialState(row);
    const savedOriginalPrice =
      row.adminRegistrationOriginalPriceCents ??
      (row.paymentOrigin === "exemption" ? null : row.registrationPriceCents);
    setOriginalAmountInput(savedOriginalPrice === null ? "" : centsToInput(savedOriginalPrice));
    const due = manualPaymentDueLocal(row);
    setAmountInput(
      due === null
        ? ""
        : due.mode === "balance"
          ? centsToInput(due.dueCents)
          : row.paymentOrigin === "exemption"
            ? centsToInput(due.dueCents)
            : centsToInput(row.amountCents ?? due.dueCents),
    );
    setRafflePaidInput(row.adminRafflePaidCents ? centsToInput(row.adminRafflePaidCents) : "");
    setReason(row.manualPaymentReason ?? "");
    setRemainder(row.paymentOrigin === "exemption" || row.isFreeRegistration ? "discount" : "pending");
    setReceipt(null);
    setReceiptError("");
  }, [paymentRow]);

  function manualPaymentDueLocal(row: AdminRegistrationRow) {
    return getManualPaymentDue({
      paymentStatus: row.paymentStatus,
      paymentOrigin: row.paymentOrigin ?? null,
      amountCents: row.amountCents,
      paidAmountCents: row.paidAmountCents,
      pricingType: row.pricingType,
      standardPriceCents: row.standardPriceCents,
      registrationPriceCents: row.registrationPriceCents,
      feePendingCents: row.manualFeePendingCents ?? null,
      discountCents: row.manualDiscountCents ?? null,
      originalRegistrationPriceCents: row.adminRegistrationOriginalPriceCents ?? null,
    });
  }

  function canConfigurePayment(row: AdminRegistrationRow) {
    const due = manualPaymentDueLocal(row);
    return row.paymentStatus === "pending" || due?.mode === "balance" || row.paymentOrigin === "exemption";
  }

  async function selectReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MANUAL_PAYMENT_RECEIPT_BYTES) {
      setReceiptError("O comprovante deve ter no máximo 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      const comma = result.indexOf(",");
      setReceipt({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type as ManualPaymentReceipt["mimeType"],
        fileName: file.name,
      });
      setReceiptError("");
    };
    reader.readAsDataURL(file);
  }

  async function savePayment() {
    if (!paymentRow) return;
    const row = paymentRow;
    const due = manualPaymentDueLocal(row);
    if (!due) {
      const rafflePaidRaw = rafflePaidInput.trim() === "" ? undefined : parseReceivedAmount(rafflePaidInput);
      if (rafflePaidInput.trim() !== "" && rafflePaidRaw === null) {
        setReceiptError("Informe um valor válido para as rifas.");
        return;
      }
      setPaymentBusy(true);
      setReceiptError("");
      try {
        await setAdminRegistrationRafflePaid({
          data: { registrationId: row.id, rafflePaidCents: rafflePaidRaw ?? null },
        });
        await load();
        setPaymentOpen(false);
        setPaymentRow(null);
      } catch {
        setReceiptError("Não foi possível registrar o pagamento das rifas.");
      } finally {
        setPaymentBusy(false);
      }
      return;
    }
    const originalAmountCents = parseReceivedAmount(originalAmountInput);
    const receivedCents = parseReceivedAmount(amountInput);
    const rafflePaidRaw = rafflePaidInput.trim() === "" ? undefined : parseReceivedAmount(rafflePaidInput);
    if (rafflePaidInput.trim() !== "" && rafflePaidRaw === null) {
      setReceiptError("Informe um valor válido para as rifas.");
      return;
    }
    if (originalAmountCents === null || receivedCents === null) {
      setReceiptError("Informe valores válidos.");
      return;
    }
    if (receivedCents === 0 && remainder !== "discount") {
      setReceiptError("Informe um valor recebido ou isente o valor total.");
      return;
    }
    if (receivedCents > due.dueCents) {
      setReceiptError("O valor recebido não pode ser maior que o valor pendente.");
      return;
    }
    setPaymentBusy(true);
    setReceiptError("");
    try {
      await markPaid({
        data: {
          registrationId: row.id,
          receipt: receipt ?? undefined,
          amountCents: receivedCents,
          remainder,
          originalRegistrationPriceCents: originalAmountCents,
          rafflePaidCents: rafflePaidRaw ?? undefined,
          reason,
        },
      });
      await load();
      setPaymentOpen(false);
      setPaymentRow(null);
    } catch {
      setReceiptError("Não foi possível salvar a configuração de pagamento.");
    } finally {
      setPaymentBusy(false);
    }
  }

  const [paymentOpen, setPaymentOpen] = useState(false);
  const centsToInput = (value: number) => (value / 100).toFixed(2).replace(".", ",");

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Ver detalhes de ${item.choirName}`}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Eye aria-hidden="true" className="size-4" />
        Ver detalhes
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalhes — {item.choirName}</DialogTitle>
            <DialogDescription>
              Lista de inscritos do coro com situação, valor da inscrição e valor das rifas.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : roster ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Total de inscritos</dt>
                  <dd className="text-lg font-semibold tabular-nums">{roster.total}</dd>
                </div>
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Total recebido</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {money.format(roster.receivedCents / 100)}
                  </dd>
                  <dd className="text-[11px] text-muted-foreground">
                    Inscrições {money.format((roster.receivedCents - roster.rafflePaidCents) / 100)} ·{" "}
                    Rifas {money.format(roster.rafflePaidCents / 100)}
                  </dd>
                </div>
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Pendente taxa de inscrição</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {money.format(roster.pendingFeeCents / 100)}
                  </dd>
                </div>
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Pendente em rifas</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatAdminRafflePending({
                      cents: roster.rafflePendingCents,
                      tickets: roster.rafflePendingTickets,
                    })}
                  </dd>
                </div>
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Rifas pagas</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {money.format(roster.rafflePaidCents / 100)}
                  </dd>
                </div>
              </dl>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {[
                        "Nome no crachá",
                        "Nome completo",
                        "E-mail",
                        "WhatsApp",
                        "Situação",
                        "Valor inscrição",
                        "Valor rifas",
                        "Ações",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-2 py-1.5 text-left text-xs font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">
                          Nenhuma inscrição encontrada para este coro.
                        </td>
                      </tr>
                    ) : (
                      roster.rows.map((row) => {
                        const view = choirRosterRowView(row);
                        return (
                          <tr key={row.id} className="border-t">
                            <td className="px-2 py-1.5 align-top">
                              {row.badgeName?.trim() || row.name}
                            </td>
                            <td className="px-2 py-1.5 align-top">{row.name}</td>
                            <td className="px-2 py-1.5 align-top">{row.email}</td>
                            <td className="px-2 py-1.5 align-top">{row.phone}</td>
                            <td className="px-2 py-1.5 align-top">
                              {row.cancelledAt
                                ? "Cancelada"
                                : rosterStatusLabels[view.state.status as RosterStatus]}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right align-top font-medium tabular-nums ${view.registrationColor}`}
                            >
                              {view.registrationValueCents === null
                                ? "Não informado"
                                : money.format(view.registrationValueCents / 100)}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right align-top font-medium tabular-nums ${view.raffleColor}`}
                            >
                              {view.raffle === null
                                ? "—"
                                : money.format(view.raffle.cents / 100)}
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={paymentBusy}
                                onClick={() => setPaymentRow(row)}
                              >
                                Configurar pagamento
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={paymentRow !== null} onOpenChange={(open) => {
        if (!open) { setPaymentRow(null); setReceipt(null); setReceiptError(""); }
      }}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Configurar pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentRow ? `Inscrição de ${paymentRow.name}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="modal-original-amount">Valor original (R$)</Label>
              <Input
                id="modal-original-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={originalAmountInput}
                disabled={paymentBusy}
                onChange={(event) => setOriginalAmountInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-amount">Valor recebido (R$)</Label>
              <Input
                id="modal-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountInput}
                disabled={paymentBusy}
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-raffle-paid">Rifas pagas (R$)</Label>
              <Input
                id="modal-raffle-paid"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={rafflePaidInput}
                disabled={paymentBusy}
                onChange={(event) => setRafflePaidInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-reason">Justificativa</Label>
              <Input
                id="modal-reason"
                value={reason}
                disabled={paymentBusy}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {receiptError && (
              <p role="alert" className="text-sm text-destructive">{receiptError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="modal-receipt">Comprovante (opcional)</Label>
              <Input
                id="modal-receipt"
                type="file"
                accept="image/*,application/pdf"
                disabled={paymentBusy}
                onChange={(event) => void selectReceipt(event)}
              />
              {receipt && <p className="text-xs text-muted-foreground">Arquivo selecionado: {receipt.fileName}</p>}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paymentBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={paymentBusy} onClick={(event) => { event.preventDefault(); void savePayment(); }}>
              {paymentBusy ? "Salvando…" : "Salvar configuração"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
