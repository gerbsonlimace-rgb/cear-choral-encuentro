import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCurrencyToCents } from "@/features/choirs/choir-pricing.domain";
import { formatComplementCents, type PortalParticipant } from "./regent-payments.domain";

export type ComplementPaymentDialogProps = {
  participant: PortalParticipant | null;
  onClose: () => void;
  startCheckout?: (input: {
    registrationId: string;
    amountCents: number;
  }) => Promise<{ checkoutUrl: string }>;
};

export function ComplementPaymentDialog({
  participant,
  onClose,
  startCheckout,
}: ComplementPaymentDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const complement = participant?.complement;
  if (!participant || !complement || !complement.eligible) return null;
  const currentParticipant = participant;
  const balance = complement.balanceCents;

  async function submit() {
    if (busy.current) return;
    let amount: number | null;
    try {
      amount = parseCurrencyToCents(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Informe um valor válido.");
      return;
    }
    if (!amount || amount > balance) {
      setError(`O valor máximo é ${formatComplementCents(balance)}.`);
      return;
    }
    if (!startCheckout) return;
    busy.current = true;
    setError("");
    try {
      const result = await startCheckout({
        registrationId: currentParticipant.id,
        amountCents: amount,
      });
      if (!/^https:\/\//i.test(result.checkoutUrl)) throw new Error("URL de pagamento inválida.");
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o pagamento.");
      busy.current = false;
    }
  }

  return (
    <Dialog open={Boolean(participant)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar complemento</DialogTitle>
          <DialogDescription>
            {currentParticipant.name} · saldo máximo {formatComplementCents(balance)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="complement-amount">Valor</Label>
          <Input
            id="complement-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy.current}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy.current}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={busy.current}>
            {busy.current ? "Abrindo pagamento…" : "Pagar complemento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
