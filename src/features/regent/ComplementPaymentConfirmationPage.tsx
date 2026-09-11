import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PaymentLookup } from "@/features/registration/registration.domain";
import { verifyComplementPayment } from "@/lib/regent.functions";
import type { ComplementPaymentPublicStatus } from "./regent-payment.server";

type Props = {
  lookup: PaymentLookup | null;
  verifyPayment?: (lookup: PaymentLookup) => Promise<ComplementPaymentPublicStatus>;
  retryDelayMs?: number;
};

type State =
  | { kind: "processing" }
  | { kind: "paid"; payment: Extract<ComplementPaymentPublicStatus, { status: "paid" }> }
  | { kind: "pending" }
  | { kind: "error" };

const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const defaultVerifyPayment = (lookup: PaymentLookup) => verifyComplementPayment({ data: lookup });

export function ComplementPaymentConfirmationPage({
  lookup,
  verifyPayment = defaultVerifyPayment,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}: Props) {
  const key = JSON.stringify(
    lookup
      ? [lookup.orderNsu, lookup.transactionNsu, lookup.slug, lookup.receiptUrl ?? null]
      : [null],
  );
  return (
    <ConfirmationCycle
      key={key}
      lookup={lookup}
      verifyPayment={verifyPayment}
      retryDelayMs={retryDelayMs}
    />
  );
}

function ConfirmationCycle({ lookup, verifyPayment, retryDelayMs }: Required<Props>) {
  const [cycle, setCycle] = useState(0);
  const [state, setState] = useState<State>({ kind: "processing" });
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
        if (attempt >= MAX_ATTEMPTS) {
          setState({ kind: "pending" });
          return;
        }
        retryTimer = setTimeout(() => void verify(attempt + 1), retryDelayMs);
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

  if (!lookup) return <Message title="Não foi possível identificar este pagamento." />;
  if (state.kind === "paid") {
    const method =
      state.payment.paymentMethod === "pix"
        ? "Pix"
        : `Cartão em ${state.payment.installments} ${state.payment.installments === 1 ? "parcela" : "parcelas"}`;
    return (
      <Message title="Complemento confirmado">
        <p className="mt-3 text-muted-foreground">Pagamento por {method}.</p>
        {state.payment.receiptUrl && <ReceiptLink receiptUrl={state.payment.receiptUrl} />}
      </Message>
    );
  }
  if (state.kind === "pending") {
    return (
      <Message title="Pagamento complementar ainda não confirmado">
        <p className="mt-3 text-muted-foreground">Não faça outro pagamento.</p>
        <RetryButton onClick={() => setCycle((current) => current + 1)} />
      </Message>
    );
  }
  if (state.kind === "error") {
    return (
      <Message title="Não foi possível verificar agora">
        <p className="mt-3 text-muted-foreground">Não faça outro pagamento.</p>
        <RetryButton onClick={() => setCycle((current) => current + 1)} />
      </Message>
    );
  }
  return <Message title="Confirmando pagamento…" />;
}

function Message({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg border-border bg-card shadow-sm shadow-teal/10">
        <CardContent className="p-6 text-center sm:p-8">
          <h1 className="font-display text-3xl font-extrabold text-foreground">{title}</h1>
          {children}
          <a
            href="/regente"
            className="mt-6 inline-flex font-semibold text-teal underline-offset-4 hover:underline"
          >
            Voltar à área do regente
          </a>
        </CardContent>
      </Card>
    </main>
  );
}

function ReceiptLink({ receiptUrl }: { receiptUrl: string }) {
  return (
    <a
      href={receiptUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-6 inline-flex font-semibold text-teal underline-offset-4 hover:underline"
    >
      Ver comprovante
    </a>
  );
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
