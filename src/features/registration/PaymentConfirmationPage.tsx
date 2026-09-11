import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download, ExternalLink, LogIn } from "lucide-react";

import eventLogo from "@/assets/logo-coros-branco.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyRegistrationPayment } from "@/lib/registration.functions";
import { buildReceiptRows, downloadReceiptPdf } from "./receipt";
import type { PublicPaymentStatus } from "./registration-payment.server";
import type { PaymentLookup } from "./registration.domain";

type PaidPayment = Extract<PublicPaymentStatus, { status: "paid" }>;

type PaymentConfirmationPageProps = {
  lookup: PaymentLookup | null;
  verifyPayment?: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>;
  downloadReceipt?: (payment: PaidPayment) => Promise<void>;
  retryDelayMs?: number;
};

type ResolvedPaymentConfirmationPageProps = {
  lookup: PaymentLookup | null;
  verifyPayment: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>;
  downloadReceipt: (payment: PaidPayment) => Promise<void>;
  retryDelayMs: number;
};

type ConfirmationState =
  | { kind: "processing" }
  | { kind: "paid"; payment: Extract<PublicPaymentStatus, { status: "paid" }> }
  | { kind: "pending" }
  | { kind: "error" };

const MAX_VERIFICATION_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;
const defaultVerifyPayment = (lookup: PaymentLookup) => verifyRegistrationPayment({ data: lookup });
const defaultDownloadReceipt = (payment: PaidPayment) => downloadReceiptPdf(payment);

export function PaymentConfirmationPage({
  lookup,
  verifyPayment = defaultVerifyPayment,
  downloadReceipt = defaultDownloadReceipt,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}: PaymentConfirmationPageProps) {
  const lookupKey = JSON.stringify(
    lookup
      ? [lookup.orderNsu, lookup.transactionNsu, lookup.slug, lookup.receiptUrl ?? null]
      : [null],
  );

  return (
    <PaymentConfirmationCycle
      key={lookupKey}
      lookup={lookup}
      verifyPayment={verifyPayment}
      downloadReceipt={downloadReceipt}
      retryDelayMs={retryDelayMs}
    />
  );
}

function PaymentConfirmationCycle({
  lookup,
  verifyPayment,
  downloadReceipt,
  retryDelayMs,
}: ResolvedPaymentConfirmationPageProps) {
  const [cycle, setCycle] = useState(0);
  const [state, setState] = useState<ConfirmationState>({ kind: "processing" });
  const orderNsu = lookup?.orderNsu;
  const transactionNsu = lookup?.transactionNsu;
  const slug = lookup?.slug;
  const receiptUrl = lookup?.receiptUrl;

  useEffect(() => {
    if (!orderNsu || !transactionNsu || !slug) return;

    const lookupForVerification: PaymentLookup = {
      orderNsu,
      transactionNsu,
      slug,
      ...(receiptUrl ? { receiptUrl } : {}),
    };

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const verify = async (attempt: number) => {
      setState({ kind: "processing" });

      try {
        const payment = await verifyPayment(lookupForVerification);
        if (disposed) return;

        if (payment.status === "paid") {
          setState({ kind: "paid", payment });
          return;
        }

        if (attempt >= MAX_VERIFICATION_ATTEMPTS) {
          setState({ kind: "pending" });
          return;
        }

        retryTimer = setTimeout(() => {
          void verify(attempt + 1);
        }, retryDelayMs);
      } catch {
        if (!disposed) setState({ kind: "error" });
      }
    };

    void verify(1);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [cycle, orderNsu, receiptUrl, retryDelayMs, slug, transactionNsu, verifyPayment]);

  if (!lookup) {
    return <PaymentMessage title="Não foi possível identificar este pagamento." />;
  }

  if (state.kind === "paid") {
    return <ConfirmedPayment payment={state.payment} downloadReceipt={downloadReceipt} />;
  }

  if (state.kind === "pending") {
    return (
      <PaymentMessage title="Pagamento ainda não confirmado">
        <DuplicatePaymentWarning />
        <RetryButton onClick={() => setCycle((current) => current + 1)} />
      </PaymentMessage>
    );
  }

  if (state.kind === "error") {
    return (
      <PaymentMessage title="Não foi possível verificar agora">
        <DuplicatePaymentWarning />
        <RetryButton onClick={() => setCycle((current) => current + 1)} />
      </PaymentMessage>
    );
  }

  return <PaymentMessage title="Confirmando pagamento…" />;
}

function PaymentMessage({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg border-border bg-card shadow-sm shadow-teal/10">
        <CardContent className="p-6 text-center sm:p-8">
          <h1 className="font-display text-3xl font-extrabold text-foreground">{title}</h1>
          {children}
          <a
            href="/"
            className="mt-6 inline-flex font-semibold text-teal underline-offset-4 hover:underline"
          >
            Voltar ao início
          </a>
        </CardContent>
      </Card>
    </main>
  );
}

function ConfirmedPayment({
  payment,
  downloadReceipt,
}: {
  payment: PaidPayment;
  downloadReceipt: (payment: PaidPayment) => Promise<void>;
}) {
  const [downloading, setDownloading] = useState(false);
  const rows = buildReceiptRows(payment);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceipt(payment);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(210,166,52,0.18),transparent_65%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl">
        <header className="overflow-hidden rounded-[2rem] bg-primary px-5 py-6 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8 sm:py-7">
          <div className="flex items-center gap-4 sm:gap-6">
            <img
              src={eventLogo}
              alt="Logo do Encontro de Coros"
              className="h-16 w-auto shrink-0 object-contain sm:h-20"
            />
            <div className="min-w-0 border-l border-primary-foreground/25 pl-4 sm:pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber">
                II Encontro de Coros
              </p>
              <p className="mt-2 max-w-md font-display text-lg font-bold leading-tight sm:text-2xl">
                Diocesanos e Litúrgicos do Ceará
              </p>
              <p className="mt-2 text-sm text-primary-foreground/70">
                20 a 22 de novembro de 2026 · Quixadá (CE)
              </p>
            </div>
          </div>
        </header>

        <Card className="relative -mt-3 overflow-hidden rounded-[2rem] border-border bg-card shadow-2xl shadow-primary/10 sm:-mt-5">
          <div className="border-b border-border bg-card px-5 py-7 sm:px-10 sm:py-9">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald/20 text-emerald-foreground sm:size-16">
                <CheckCircle2 className="size-8 sm:size-9" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-foreground">
                  Pagamento aprovado pela InfinitePay
                </p>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Inscrição confirmada
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Sua vaga está garantida. Confira abaixo os dados da sua inscrição e guarde este
                  comprovante.
                </p>
              </div>
            </div>
          </div>

          <CardContent className="space-y-7 px-5 py-7 sm:px-10 sm:py-9">
            <section aria-labelledby="registration-details-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-foreground">
                    Resumo
                  </p>
                  <h2
                    id="registration-details-title"
                    className="mt-1 font-display text-2xl font-bold"
                  >
                    Dados da inscrição
                  </h2>
                </div>
                <span className="rounded-full bg-emerald/15 px-3 py-1 text-xs font-bold text-emerald-foreground">
                  Confirmada
                </span>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-border bg-muted/30 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="mt-2 break-words text-sm font-bold leading-5 text-foreground">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {payment.participantAccessStatus === "active" && (
              <section
                className="rounded-3xl border border-amber/40 bg-amber/10 p-5 sm:p-6"
                aria-labelledby="material-title"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber text-amber-foreground">
                    <LogIn className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="material-title"
                      className="font-display text-xl font-bold text-foreground"
                    >
                      Seu material estará no app do Coralista
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      É necessário acessar o app do Coralista para consultar as partituras, manuais
                      e demais materiais do evento.
                    </p>
                    <a
                      href="/acessar"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Acessar o app do Coralista
                      <LogIn className="size-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>
            )}
            {payment.participantAccessStatus === "pending" && (
              <p className="rounded-3xl border border-amber/40 bg-amber/10 p-5 text-sm leading-6 text-muted-foreground">
                Seu pagamento foi confirmado. Estamos preparando seu acesso à área do participante.
              </p>
            )}
            {payment.participantAccessStatus === "conflict" && (
              <p className="rounded-3xl border border-amber/40 bg-amber/10 p-5 text-sm leading-6 text-muted-foreground">
                Seu acesso precisa de atendimento da organização.
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                className="w-full rounded-full bg-primary px-6 py-6 font-bold text-primary-foreground shadow-lg shadow-primary/15 hover:bg-primary/90 sm:w-auto"
                disabled={downloading}
                onClick={() => void handleDownload()}
              >
                <Download aria-hidden="true" />
                {downloading ? "Gerando PDF…" : "Baixar comprovante em PDF"}
              </Button>
              {payment.receiptUrl && (
                <a
                  href={payment.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                >
                  Ver comprovante
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              )}
              <a
                href="/"
                className="text-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline sm:ml-auto"
              >
                Voltar ao início
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function DuplicatePaymentWarning() {
  return <p className="mt-3 text-muted-foreground">Não faça outro pagamento.</p>;
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="mt-6 rounded-full bg-teal font-bold text-white hover:bg-teal/90"
      onClick={onClick}
    >
      Verificar novamente
    </Button>
  );
}
