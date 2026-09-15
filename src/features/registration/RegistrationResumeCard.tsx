import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafeCheckoutUrl } from "@/features/regent/BalancePaymentDialog";
import {
  resumeRegistrationCheckout,
  type RegistrationResumeResult,
} from "@/lib/registration.functions";
import { registrationResumeSchema, type RegistrationResumeInput } from "./registration.domain";

type RegistrationResumeCardProps = {
  resume?: (input: RegistrationResumeInput) => Promise<RegistrationResumeResult>;
  navigateToCheckout?: (url: string) => void;
};

const knownResumeErrors = new Set([
  "Não foi possível localizar uma inscrição com os dados informados.",
  "Procure a organização para continuar o pagamento.",
]);

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function RegistrationResumeCard({
  resume = (input) => resumeRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationResumeCardProps) {
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    const parsed = registrationResumeSchema.safeParse({ cpf, birthDate });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }

    setMessage("");
    setIsLoading(true);
    try {
      const result = await resume(parsed.data);
      if (result.status === "paid") {
        setMessage("Sua inscrição já está confirmada.");
      } else if (!isSafeCheckoutUrl(result.checkoutUrl)) {
        setMessage("Não foi possível abrir o pagamento. Tente novamente.");
      } else {
        navigateToCheckout(result.checkoutUrl);
      }
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "";
      setMessage(
        knownResumeErrors.has(errorMessage)
          ? errorMessage
          : "Não foi possível retomar a inscrição. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      id="retomar-pagamento"
      className="mx-auto mt-4 max-w-4xl rounded-2xl border-amber/30 bg-amber/5 shadow-none"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
            <RotateCcw className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-lg font-extrabold text-foreground">
              Já fez sua inscrição?
            </h3>
            <p className="text-sm text-muted-foreground">
              Informe CPF e data de nascimento para continuar um pagamento pendente.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="resume-cpf" className="font-semibold">
              CPF da inscrição
            </Label>
            <Input
              id="resume-cpf"
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={14}
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              placeholder="000.000.000-00"
              className="min-h-11 rounded-xl bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume-birth-date" className="font-semibold">
              Data de nascimento da inscrição
            </Label>
            <Input
              id="resume-birth-date"
              type="date"
              required
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="min-h-11 rounded-xl bg-background"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-11 rounded-full bg-foreground px-5 font-bold text-background"
          >
            {isLoading ? "Consultando…" : "Retomar pagamento"}
          </Button>
        </form>

        {message && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-foreground">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
