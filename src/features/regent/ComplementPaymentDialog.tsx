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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCurrencyToCents } from "@/features/choirs/choir-pricing.domain";
import { startComplementCheckout } from "@/lib/regent.functions";

import { formatComplementCents, type PortalParticipant } from "./regent-payments.domain";

type CheckoutResult = { checkoutUrl: string; orderNsu: string };
type Props = {
  participant: PortalParticipant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startCheckout?: (input: {
    data: { registrationId: string; amountCents: number };
  }) => Promise<CheckoutResult>;
  navigateToCheckout?: (url: string) => void;
};

const defaultNavigateToCheckout = (url: string) => window.location.assign(url);

function isSafeCheckoutUrl(value: string) {
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

export function ComplementPaymentDialog({
  participant,
  open,
  onOpenChange,
  startCheckout = startComplementCheckout,
  navigateToCheckout = defaultNavigateToCheckout,
}: Props) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setError("");
    }
  }, [open, participant?.id]);

  const balanceCents =
    participant?.complement.eligible === true ? participant.complement.balanceCents : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !participant || !participant.complement.eligible) return;

    setError("");
    let amountCents: number | null;
    try {
      amountCents = parseCurrencyToCents(amount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Informe um valor válido.");
      return;
    }
    if (amountCents === null) {
      setError("Informe o valor do complemento.");
      return;
    }
    if (amountCents > participant.complement.balanceCents) {
      setError(`O valor máximo é ${formatComplementCents(participant.complement.balanceCents)}.`);
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      const result = await startCheckout({
        data: { registrationId: participant.id, amountCents },
      });
      if (!isSafeCheckoutUrl(result.checkoutUrl)) {
        throw new Error("unsafe checkout URL");
      }
      navigateToCheckout(result.checkoutUrl);
    } catch {
      setError("Não foi possível abrir o pagamento. Tente novamente.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar complemento</DialogTitle>
          <DialogDescription>
            {participant
              ? `Defina uma parcela para ${participant.name}. Máximo disponível: ${formatComplementCents(balanceCents)}.`
              : "Selecione um participante elegível."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="complement-amount">Valor do complemento</Label>
            <Input
              id="complement-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              disabled={submitting}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !participant || !participant.complement.eligible}
            >
              {submitting ? "Abrindo pagamento…" : "Pagar complemento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
