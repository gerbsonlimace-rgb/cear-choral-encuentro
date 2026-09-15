import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download, ExternalLink, KeyRound, Link2, LoaderCircle, MessageCircle } from "lucide-react";

import eventLogo from "@/assets/logo-coros-branco.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyRegistrationPayment } from "@/lib/registration.functions";
import { buildReceiptRows, downloadReceiptPdf } from "./receipt";
import { clearRegistrationDraft } from "./registration-draft";
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
const DEFAULT_PARTICIPANT_PORTAL_URL = "https://encontrocorosce.lovable.app/acessar";
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
          clearRegistrationDraft();
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

  const displayState = !lookup ? "error" : state.kind;

  return (
    <main
      data-testid="payment-confirmation-shell"
      data-confirmation-state={displayState}
      className="relative min-h-svh overflow-hidden bg-[#f5efe3] px-4 py-8 transition-colors duration-500 motion-reduce:transition-none sm:px-6 sm:py-12"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,166,52,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(18,17,14,0.12),transparent_42%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-5xl transition-all duration-500 ease-out motion-reduce:transition-none">
        {!lookup ? (
          <PaymentMessage title="Não foi possível identificar este pagamento." />
        ) : state.kind === "paid" ? (
          <ConfirmedPayment
            payment={state.payment}
            downloadReceipt={downloadReceipt}
          />
        ) : state.kind === "pending" ? (
          <PaymentMessage title="Pagamento ainda não confirmado">
            <DuplicatePaymentWarning />
            <RetryButton onClick={() => setCycle((current) => current + 1)} />
          </PaymentMessage>
        ) : state.kind === "error" ? (
          <PaymentMessage title="Não foi possível verificar agora">
            <DuplicatePaymentWarning />
            <RetryButton onClick={() => setCycle((current) => current + 1)} />
          </PaymentMessage>
        ) : (
          <PaymentMessage title="Confirmando pagamento…" processing />
        )}
      </div>
    </main>
  );
}

function PaymentMessage({
  children,
  processing = false,
  title,
}: {
  children?: ReactNode;
  processing?: boolean;
  title: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg border-[#ded3bf] bg-[#fffaf0]/90 shadow-xl shadow-primary/10 backdrop-blur-sm">
        <CardContent className="p-6 text-center sm:p-8">
          {processing && (
            <LoaderCircle className="mx-auto mb-4 size-9 animate-spin text-amber-foreground motion-reduce:animate-none" aria-hidden="true" />
          )}
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
    </div>
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
  const participantPortalUrl = getParticipantPortalUrl(payment.participantPortalUrl);
  const rows = buildReceiptRows(payment);
  const isPreRegistration =
    payment.pricingType === "promotional" &&
    payment.registrationPriceCents < payment.standardPriceCents;
  const remainingCents = payment.remainingPriceCents ??
    (payment.standardPriceCents - payment.registrationPriceCents);
  const remainingValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(remainingCents / 100);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceipt(payment);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-5xl">
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
                  {isPreRegistration ? "Pré-inscrição confirmada" : "Inscrição confirmada"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {isPreRegistration ? (
                    <>
                      {payment.participantAccessStatus === "active" && (
                        <>
                          <span>Acesso ao app liberado</span>.{" "}
                        </>
                      )}
                      Sua vaga será confirmada após a quitação do valor restante.
                    </>
                  ) : (
                    <><span>Vaga confirmada</span>. Confira abaixo os dados da sua inscrição e guarde este comprovante.</>
                  )}
                </p>
                {isPreRegistration && (
                  <p className="mt-3 font-bold text-foreground">Valor restante: {remainingValue}</p>
                )}
              </div>
            </div>
          </div>

          <CardContent className="px-5 py-7 sm:px-10 sm:py-9">
            {payment.whatsappGroupUrl && (
              <nav aria-label="Próximos passos" className="mb-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {payment.whatsappGroupUrl && (
                  <a
                    href={payment.whatsappGroupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#166534] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#14532d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
                    Entrar no grupo do WhatsApp
                    <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                  </a>
                )}
              </nav>
            )}
            <div data-testid="confirmation-columns" className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-7">
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
                  {isPreRegistration ? "Pré-inscrição" : "Confirmada"}
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
              </div>

              <section
                className="h-fit rounded-3xl border border-amber/40 bg-amber/10 p-5 sm:p-6"
                aria-labelledby="material-title"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber text-amber-foreground">
                    <KeyRound className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-foreground">
                      Próximo passo
                    </p>
                    <h2
                      id="material-title"
                      className="font-display text-xl font-bold text-foreground"
                    >
                      Acesso ao portal do participante
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Use as informações abaixo para entrar no portal do participante.
                    </p>
                    <div className="mt-4 space-y-3 rounded-2xl border border-amber/40 bg-card/80 p-4 text-sm">
                      <p className="flex items-start gap-2">
                        <Link2 className="mt-0.5 size-4 shrink-0 text-amber-foreground" aria-hidden="true" />
                        <span>
                          <strong className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">Link do portal</strong>
                          <a
                            href={participantPortalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block break-all font-bold text-teal underline underline-offset-4"
                          >
                            {participantPortalUrl}
                          </a>
                        </span>
                      </p>
                      <p>
                        <strong className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">Login (e-mail cadastrado)</strong>
                        <span className="mt-1 block break-all font-bold text-foreground">
                          {payment.participantEmail ?? "e-mail cadastrado na inscrição"}
                        </span>
                      </p>
                      <p>
                        <strong className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">Senha (6 primeiros dígitos do CPF)</strong>
                        <span className="mt-1 block font-bold text-foreground">
                          {payment.participantInitialPassword ?? "os 6 primeiros dígitos do CPF"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

function getParticipantPortalUrl(portalUrl?: string): string {
  if (!portalUrl) return DEFAULT_PARTICIPANT_PORTAL_URL;
  try {
    const parsed = new URL(portalUrl, DEFAULT_PARTICIPANT_PORTAL_URL);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(parsed.href)
    ) {
      return parsed.href;
    }
  } catch {
    // Fall back to the public event portal when a stored value is malformed.
  }
  return DEFAULT_PARTICIPANT_PORTAL_URL;
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
