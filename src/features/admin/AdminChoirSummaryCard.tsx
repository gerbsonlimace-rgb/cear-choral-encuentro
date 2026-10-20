import { useEffect, useRef, useState } from "react";
import { Download, FileDown, LoaderCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deliverFile, openPreparedPdf } from "@/lib/file-download";
import type { AdminChoirFinancials, AdminRegistrationPdfExportQuery } from "./admin.domain";
import type { AdminPdfFile } from "./admin-registration-pdf";
import { formatAdminRafflePending } from "./admin-raffle.domain";

export type PrepareChoirPdf = (input: { data: AdminRegistrationPdfExportQuery }) => Promise<AdminPdfFile>;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AdminChoirSummaryCard({ item, preparePdf }: { item: AdminChoirFinancials; preparePdf: PrepareChoirPdf }) {
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
    <li className="min-w-0 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold">{item.choirName}</h3>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{item.total} {item.total === 1 ? "inscrito" : "inscritos"}</span>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        {[
          { label: "Recebido", value: money.format(item.receivedCents / 100) },
          { label: "Pendente taxa de inscrição", value: money.format(item.pendingCents / 100) },
          { label: "Pendente em rifas", value: formatAdminRafflePending({ cents: item.rafflePendingCents ?? 0, tickets: item.rafflePendingTickets ?? null }) },
          { label: "Total previsto", value: money.format(item.expectedCents / 100) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex flex-wrap justify-end gap-2 border-t pt-2">
        {file && <Button size="sm" variant="ghost" aria-label={`Abrir PDF de ${item.choirName}`} onClick={() => openPreparedPdf(file.blob)}><ExternalLink aria-hidden="true" className="size-4" />Abrir PDF</Button>}
        <Button size="sm" variant="outline" disabled={busy}
          aria-label={`${file ? "Baixar PDF" : "Exportar PDF"} de ${item.choirName}`}
          onClick={() => {
            if (file) {
              setError("");
              void deliverFile(file.blob, file.fileName).catch(() => {
                if (active.current) setError("Não foi possível baixar o PDF. Tente novamente.");
              });
            } else void exportPdf();
          }}>
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : file ? <Download aria-hidden="true" className="size-4" /> : <FileDown aria-hidden="true" className="size-4" />}
          {busy ? "Gerando…" : file ? "Baixar PDF" : "Exportar PDF"}
        </Button>
      </div>
      {file && <p role="status" className="mt-2 text-xs text-muted-foreground">PDF pronto. Baixar PDF</p>}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  );
}