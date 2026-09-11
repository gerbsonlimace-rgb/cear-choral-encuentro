import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyRegistrationPayment } from "@/lib/registration.functions";
import { buildReceiptRows, downloadReceiptPdf } from "./receipt";
import type { PublicPaymentStatus } from "./registration-payment.server";
import type { PaymentLookup } from "./registration.domain";


type PaymentConfirmationPageProps = {
  lookup: PaymentLookup | null;
  verifyPayment?: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>;
  retryDelayMs?: number;
};

type ResolvedPaymentConfirmationPageProps = {
  lookup: PaymentLookup | null;
  verifyPayment: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>;
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

export function PaymentConfirmationPage({
  lookup,
  verifyPayment = defaultVerifyPayment,
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
      retryDelayMs={retryDelayMs}
    />
  );
}

function PaymentConfirmationCycle({
  lookup,
  verifyPayment,
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
    const method =
      state.payment.paymentMethod === "pix"
        ? "Pix"
        : `Cartão em ${state.payment.installments} ${
            state.payment.installments === 1 ? "parcela" : "parcelas"
          }`;

    return (
      <PaymentMessage title="Inscrição confirmada">
        <p className="mt-3 text-muted-foreground">
          Pagamento por <span>{method}</span>.
        </p>
        {state.payment.participantAccessStatus === "active" && (
          <a
            href="/acessar"
            className="mt-4 inline-flex font-semibold text-teal underline-offset-4 hover:underline"
          >
            Acessar área do participante
          </a>
        )}
        {state.payment.participantAccessStatus === "pending" && (
          <p className="mt-3 text-muted-foreground">
            Seu pagamento foi confirmado. Estamos preparando seu acesso à área do participante.
          </p>
        )}
        {state.payment.participantAccessStatus === "conflict" && (
          <p className="mt-3 text-muted-foreground">
            Seu acesso precisa de atendimento da organização.
          </p>
        )}
        {state.payment.receiptUrl && (
          <a
            href={state.payment.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex font-semibold text-teal underline-offset-4 hover:underline"
          >
            Ver comprovante
          </a>
        )}
      </PaymentMessage>
    );
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
}: {
  payment: Extract<PublicPaymentStatus, { status: "paid" }>;
}) {
  const [downloading, setDownloading] = useState(false);
  const rows = buildReceiptRows(payment);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceiptPdf(payment);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-xl overflow-hidden border-border bg-card p-0 shadow-lg shadow-teal/10">
        <div className="bg-teal px-6 py-8 text-center text-teal-foreground sm:px-8">
          <CheckCircle2 className="mx-auto size-12" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-extrabold">Inscrição confirmada</h1>
          <p className="mt-2 text-sm opacity-90">
            Sua vaga no II Encontro de Coros Diocesanos e Litúrgicos está garantida.
          </p>
        </div>
        <CardContent className="p-6 sm:p-8">
          <dl className="divide-y divide-border">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold text-foreground sm:text-right">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              className="w-full rounded-full bg-teal font-bold text-teal-foreground hover:bg-teal/90"
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
                className="font-semibold text-teal underline-offset-4 hover:underline"
              >
                Ver comprovante
              </a>
            )}
            <a
              href="/participante"
              className="font-semibold text-teal underline-offset-4 hover:underline"
            >
              Acessar área do participante
            </a>
            <a href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Voltar ao início
            </a>
          </div>
        </CardContent>
      </Card>
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
