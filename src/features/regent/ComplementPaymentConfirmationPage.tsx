import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyComplementPayment } from "@/lib/regent.functions";
import type { PaymentLookup } from "@/features/registration/registration.domain";

type Props = {
  lookup: PaymentLookup | null;
  onSuccess?: () => void;
  verifyPayment?: (lookup: PaymentLookup) => Promise<{ status: "paid" | "pending" }>;
};
type State = "processing" | "paid" | "pending" | "error";

export function ComplementPaymentConfirmationPage({
  lookup,
  onSuccess,
  verifyPayment = (value) => verifyComplementPayment({ data: value }),
}: Props) {
  const [state, setState] = useState<State>(lookup ? "processing" : "error");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!lookup) return;
    let active = true;
    void verifyPayment(lookup)
      .then((result) => {
        if (!active) return;
        if (result.status === "paid") {
          setState("paid");
          onSuccess?.();
        } else setState("pending");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [attempt, lookup, onSuccess, verifyPayment]);
  const title =
    state === "paid"
      ? "Pagamento confirmado"
      : state === "processing"
        ? "Processando pagamento…"
        : state === "pending"
          ? "Pagamento não confirmado"
          : "Não foi possível verificar agora";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          {state === "paid" ? (
            <p className="text-muted-foreground">O complemento foi registrado com segurança.</p>
          ) : (
            state !== "processing" && (
              <>
                <p className="text-muted-foreground">Não faça outro pagamento.</p>
                <Button
                  onClick={() => {
                    setState("processing");
                    setAttempt((value) => value + 1);
                  }}
                >
                  Verificar novamente
                </Button>
              </>
            )
          )}
          <a className="block text-teal underline" href={state === "paid" ? "/regente" : "/"}>
            Voltar
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
