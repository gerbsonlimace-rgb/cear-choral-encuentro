import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, Paperclip, Plus, Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAdminFinance,
  createAdminFinance,
  getAdminFinanceFile,
} from "@/lib/admin-finance.functions";
import { parseReceivedAmount } from "./admin-manual-payment.domain";
import { createFinanceEntrySchema, type FinanceEntry } from "./admin-finance.domain";
import { AdminNavigation, type AdminNavigationPath } from "./AdminNavigation";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const showDate = (value: string) => dateFormat.format(new Date(`${value}T12:00:00`));
type Filter = "all" | "income" | "expense";

async function readAttachment(file: File) {
  return new Promise<{
    base64: string;
    mimeType: "application/pdf" | "image/jpeg" | "image/png";
    fileName: string;
  }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o anexo."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) return reject(new Error("Não foi possível ler o anexo."));
      resolve({
        base64: result.slice(comma + 1),
        mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function AdminFinancePage({
  navigateTo,
}: {
  navigateTo?: (to: AdminNavigationPath) => void;
}) {
  const loadFinance = useServerFn(getAdminFinance);
  const createEntry = useServerFn(createAdminFinance);
  const getFile = useServerFn(getAdminFinanceFile);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualAvailable, setManualAvailable] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [detailEntry, setDetailEntry] = useState<FinanceEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" }),
  );
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadFinance();
      setEntries(result.entries);
      setManualAvailable(result.manualAvailable);
      setAsOfDate(result.asOfDate);
      setDate((current) => current || result.asOfDate);
    } catch {
      setError("Não foi possível carregar o Financeiro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [loadFinance]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (sum, entry) => {
          if (entry.type === "income") sum.income += entry.amountCents;
          else sum.expense += entry.amountCents;
          return sum;
        },
        { income: 0, expense: 0 },
      ),
    [entries],
  );
  const visible = useMemo(
    () =>
      entries
        .filter((entry) => filter === "all" || entry.type === filter)
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) ||
            left.description.localeCompare(right.description, "pt-BR"),
        ),
    [entries, filter],
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    if (
      attachment &&
      (!["application/pdf", "image/jpeg", "image/png"].includes(attachment.type) ||
        attachment.size < 1 ||
        attachment.size > 10 * 1024 * 1024)
    ) {
      setFormError("O anexo deve ser PDF, JPG ou PNG e ter até 10 MB.");
      return;
    }
    let selectedAttachment: Awaited<ReturnType<typeof readAttachment>> | undefined;
    try {
      selectedAttachment = attachment ? await readAttachment(attachment) : undefined;
    } catch {
      setFormError("Não foi possível ler o anexo selecionado.");
      return;
    }
    const parsed = createFinanceEntrySchema.safeParse({
      type,
      date,
      description,
      responsible,
      notes,
      amountCents: parseReceivedAmount(amount),
      ...(selectedAttachment ? { attachment: selectedAttachment } : {}),
    });
    if (!parsed.success) {
      setFormError("Confira a data, a descrição, o responsável e o valor informado.");
      return;
    }
    setSaving(true);
    try {
      await createEntry({ data: parsed.data });
      setDialogOpen(false);
      setDescription("");
      setResponsible("");
      setNotes("");
      setAmount("");
      setAttachment(null);
      await refresh();
    } catch {
      setFormError("Não foi possível salvar o lançamento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function openAttachment(id: string) {
    try {
      const result = await getFile({ data: { id } });
      window.location.assign(result.signedUrl);
    } catch {
      setError("Não foi possível abrir o anexo. Tente novamente.");
    }
  }

  return (
    <main className="internal-app min-h-svh min-w-0 bg-background px-4 pb-24 pt-20 sm:px-6 md:pl-[calc(15rem+1.5rem)] md:pr-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Financeiro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entradas e saídas do encontro, com valores confirmados por coro.
            </p>
          </div>
          <Button
            className="min-h-11"
            onClick={() => setDialogOpen(true)}
            disabled={loading || !manualAvailable || Boolean(error)}
          >
            <Plus className="size-4" aria-hidden="true" /> Novo lançamento
          </Button>
        </header>
        <AdminNavigation current="finance" navigateTo={navigateTo} />

        <section aria-label="Resumo financeiro" className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownLeft className="size-4" aria-hidden="true" /> Entradas
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {loading || error || !manualAvailable ? "—" : money.format(totals.income / 100)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="size-4" aria-hidden="true" /> Saídas
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {loading || error || !manualAvailable ? "—" : money.format(totals.expense / 100)}
            </p>
          </div>
          <div className="rounded-xl bg-brand-ink p-4 text-white">
            <p className="flex items-center gap-2 text-sm text-white/75">
              <Wallet className="size-4" aria-hidden="true" /> Saldo
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {loading || error || !manualAvailable
                ? "—"
                : money.format((totals.income - totals.expense) / 100)}
            </p>
          </div>
        </section>

        <section aria-label="Lançamentos financeiros" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Lançamentos</h2>
              {asOfDate && (
                <p className="text-xs text-muted-foreground">
                  Valores automáticos consolidados em {showDate(asOfDate)}.
                </p>
              )}
            </div>
            <div
              className="flex rounded-lg border bg-card p-1"
              role="group"
              aria-label="Filtrar lançamentos"
            >
              {(
                [
                  ["all", "Todos"],
                  ["income", "Entradas"],
                  ["expense", "Saídas"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={`min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === value ? "bg-brand-ink text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}{" "}
              <button type="button" className="underline" onClick={() => void refresh()}>
                Recarregar
              </button>
            </p>
          )}
          {!loading && !error && !manualAvailable && (
            <p
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            >
              Prévia das inscrições e rifas disponível. A migração financeira ainda precisa ser
              aplicada para liberar lançamentos manuais, anexos e saldo completo.
            </p>
          )}
          {loading ? (
            <p
              role="status"
              className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
            >
              Carregando lançamentos…
            </p>
          ) : error ? null : visible.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              Nenhum lançamento nesta seleção.
            </p>
          ) : (
            <div className="max-h-[min(68vh,720px)] overflow-auto rounded-xl border bg-card">
              <div className="sticky top-0 z-10 hidden grid-cols-[5.5rem_minmax(10rem,2fr)_minmax(6rem,1fr)_minmax(8rem,1.4fr)_5rem_6rem_6rem] gap-2 border-b bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground xl:grid">
                <span>Data</span>
                <span>Descrição</span>
                <span>Responsável</span>
                <span>Observações</span>
                <span>Anexo</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Detalhes</span>
              </div>
              <ul className="divide-y">
                {visible.map((entry) => (
                  <li key={entry.id} className="px-3 py-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 xl:grid-cols-[5.5rem_minmax(10rem,2fr)_minmax(6rem,1fr)_minmax(8rem,1.4fr)_5rem_6rem_6rem] xl:items-center">
                      <span className="text-[11px] text-muted-foreground xl:text-xs">
                        {showDate(entry.date)}
                      </span>
                      <div className="col-start-1 row-start-2 min-w-0 xl:col-auto xl:row-auto">
                        <p className="break-words text-xs font-semibold">{entry.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {entry.source === "manual" ? "Manual" : "Automático · posição acumulada"}
                        </p>
                      </div>
                      <span className="hidden truncate text-xs text-muted-foreground xl:block">
                        {entry.responsible}
                      </span>
                      <span
                        className="hidden truncate text-xs text-muted-foreground xl:block"
                        title={entry.notes}
                      >
                        {entry.notes || "—"}
                      </span>
                      <span className="hidden xl:block">
                        {entry.attachmentName ? (
                          <button
                            type="button"
                            onClick={() => void openAttachment(entry.id)}
                            className="inline-flex min-h-8 max-w-full items-center gap-1 text-xs font-semibold underline underline-offset-2"
                          >
                            <Paperclip className="size-3 shrink-0" aria-hidden="true" />
                            <span className="sr-only">{entry.attachmentName}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </span>
                      <span
                        className={`col-start-2 row-start-2 whitespace-nowrap text-right text-xs font-bold tabular-nums xl:col-auto xl:row-auto ${entry.type === "expense" ? "text-destructive" : "text-foreground"}`}
                      >
                        {entry.type === "expense" ? "− " : "+ "}
                        {money.format(entry.amountCents / 100)}
                      </span>
                      <span className="col-start-2 row-start-3 text-right xl:col-auto xl:row-auto">
                        <button
                          type="button"
                          onClick={() => setDetailEntry(entry)}
                          aria-label={`Ver detalhes de ${entry.description}`}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Eye className="size-3.5" aria-hidden="true" /> Detalhes
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Lance manualmente apenas valores que ainda não estejam nas inscrições ou rifas, para
            evitar contagem duplicada.
          </p>
        </section>
      </div>

      <Dialog
        open={Boolean(detailEntry)}
        onOpenChange={(open) => {
          if (!open) setDetailEntry(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-5 text-left text-lg">{detailEntry?.description}</DialogTitle>
            <DialogDescription className="text-left">
              {detailEntry?.source === "manual"
                ? "Lançamento manual"
                : "Entrada automática por coro"}
            </DialogDescription>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Data</dt>
                  <dd className="font-semibold">{showDate(detailEntry.date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valor</dt>
                  <dd className="font-semibold tabular-nums">
                    {money.format(detailEntry.amountCents / 100)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Responsável</dt>
                  <dd className="font-semibold">{detailEntry.responsible}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tipo</dt>
                  <dd className="font-semibold">
                    {detailEntry.type === "income" ? "Entrada" : "Saída"}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-semibold">Observações</p>
                <p className="mt-1 text-muted-foreground">
                  {detailEntry.notes || "Nenhuma observação."}
                </p>
              </div>
              {detailEntry.attachmentName && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void openAttachment(detailEntry.id)}
                >
                  <Paperclip className="size-4" aria-hidden="true" /> Abrir anexo:{" "}
                  {detailEntry.attachmentName}
                </Button>
              )}
              {detailEntry.participants && (
                <div>
                  <p className="mb-2 text-xs font-semibold">
                    Coralistas e valores ({detailEntry.participants.length})
                  </p>
                  <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border px-3">
                    {detailEntry.participants.map((person) => (
                      <li
                        key={person.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-2 text-xs"
                      >
                        <span className="min-w-0 break-words">{person.name}</span>
                        {person.registrationStatus && (
                          <span
                            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              person.registrationStatus === "paid"
                                ? "bg-emerald-50 text-emerald-700"
                                : person.registrationStatus === "pending"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {person.registrationStatus === "paid"
                              ? "Paga"
                              : person.registrationStatus === "pending"
                                ? "Pendente"
                                : "Sem dados"}
                          </span>
                        )}
                        <span className="shrink-0 font-semibold tabular-nums">
                          {money.format(person.amountCents / 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
            <DialogDescription>
              Registre uma entrada ou saída, com comprovante opcional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void save(event)} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                onClick={() => setType("income")}
              >
                Entrada
              </Button>
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                onClick={() => setType("expense")}
              >
                Saída
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="finance-date">Data</Label>
                <Input
                  id="finance-date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="finance-amount">Valor (R$)</Label>
                <Input
                  id="finance-amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="finance-description">Descrição</Label>
              <Input
                id="finance-description"
                required
                maxLength={180}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finance-responsible">Responsável</Label>
              <Input
                id="finance-responsible"
                required
                maxLength={100}
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finance-notes">Observações</Label>
              <Textarea
                id="finance-notes"
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finance-attachment">Anexo (opcional)</Label>
              <Input
                id="finance-attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PDF, JPG ou PNG, até 10 MB.</p>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar lançamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
