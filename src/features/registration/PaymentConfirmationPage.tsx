import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyRegistrationPayment } from "@/lib/registration.functions";
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
const defaultVerifyPayment = (lookup: PaymentLookup) =>
  verifyRegistrationPayment({ data: lookup });

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
        : `Cartão em ${state.payment.installments} parcelas`;

    return (
      <PaymentMessage title="Inscrição confirmada">
        <p className="mt-3 text-muted-foreground">
          Pagamento por <span>{method}</span>.
        </p>
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
        <RetryButton onClick={() => setCycle((current) => current + 1)} />
      </PaymentMessage>
    );
  }

  if (state.kind === "error") {
    return (
      <PaymentMessage title="Não foi possível verificar agora">
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

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button className="mt-6 rounded-full bg-teal font-bold text-white hover:bg-teal/90" onClick={onClick}>
      Verificar novamente
    </Button>
  );
}
