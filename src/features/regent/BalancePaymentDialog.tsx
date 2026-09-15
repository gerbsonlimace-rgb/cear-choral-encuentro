import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startComplementCheckout } from "@/lib/regent.functions";

import { formatComplementCents, type BalancePaymentTarget } from "./regent-payments.domain";

type CheckoutResult = { checkoutUrl: string; orderNsu: string };
type Props = {
  target: BalancePaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startCheckout?: (input: { data: { registrationId: string } }) => Promise<CheckoutResult>;
  navigateToCheckout?: (url: string) => void;
};

const defaultNavigateToCheckout = (url: string) => window.location.assign(url);

// Shared by the admin and regent presentations; keep the validation in one place.
// eslint-disable-next-line react-refresh/only-export-components
export function isSafeCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "checkout.infinitepay.io" || url.hostname === "checkout.infinitepay.com.br")
    );
  } catch {
    return false;
  }
}

export function BalancePaymentDialog({
  target,
  open,
  onOpenChange,
  startCheckout = startComplementCheckout,
  navigateToCheckout = defaultNavigateToCheckout,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    if (!open) setError("");
  }, [open, target?.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !target) return;

    busy.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await startCheckout({ data: { registrationId: target.id } });
      if (!isSafeCheckoutUrl(result.checkoutUrl)) throw new Error("unsafe checkout URL");
      navigateToCheckout(result.checkoutUrl);
    } catch {
      setError("Não foi possível abrir o pagamento. Tente novamente.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const balance = target ? formatComplementCents(target.balanceCents) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar saldo pendente</DialogTitle>
          <DialogDescription>
            {target
              ? `Você criará uma cobrança de ${balance} para ${target.name}. O valor será confirmado pelo servidor.`
              : "Selecione um participante com saldo pendente."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !target}>
              {submitting ? "Abrindo pagamento…" : `Pagar saldo de ${balance ?? "R$ 0,00"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
