import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAdminEventFeedbackPdf } from "@/lib/admin-event-feedback.functions";
import { deliverFile, openPreparedPdf } from "@/lib/file-download";
import type { FeedbackPdfFile } from "@/features/event-feedback/adminEventFeedback.pdf";

export function AdminFeedbackPdfExport({
  prepare = exportAdminEventFeedbackPdf,
}: {
  prepare?: () => Promise<FeedbackPdfFile>;
}) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [error, setError] = useState("");
  const active = useRef(false);
  const working = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function preparePdf() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await prepare();
      const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
      if (active.current)
        setFile({
          blob: new Blob([bytes], { type: "application/pdf" }),
          fileName: result.fileName,
        });
    } catch {
      if (active.current) setError("Não foi possível preparar o PDF. Tente novamente.");
    } finally {
      working.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Relatório dos resultados</h2>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
            PDF com logo, resultado geral, critérios e todos os comentários. Inclui todas as
            avaliações, independentemente dos filtros da lista.
          </p>
        </div>
        {!file && (
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => void preparePdf()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FileDown aria-hidden="true" />
            )}
            {busy ? "Preparando PDF…" : "Exportar PDF"}
          </Button>
        )}
      </div>
      {file && (
        <div className="space-y-2">
          <p role="status" className="text-sm">
            PDF pronto. Abra para ler ou salve no celular.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => openPreparedPdf(file.blob)}
            >
              <ExternalLink aria-hidden="true" /> Abrir PDF
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setError("");
                // Keep delivery in this click: mobile file sharing needs user activation.
                void deliverFile(file.blob, file.fileName).catch(() => {
                  if (active.current)
                    setError("Não foi possível salvar o PDF. Tente novamente ou use Abrir PDF.");
                });
              }}
            >
              <Download aria-hidden="true" /> Baixar ou compartilhar
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
