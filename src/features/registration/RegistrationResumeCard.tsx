import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resumeRegistrationCheckout } from "@/lib/registration.functions";
import { registrationResumeSchema, type RegistrationResumeInput } from "./registration.domain";
import type { RegistrationResumeResult } from "./registration-payment.server";

type Props = {
  resume?: (input: RegistrationResumeInput) => Promise<RegistrationResumeResult>;
  navigateToCheckout?: (url: string) => void;
};
const knownErrors = new Set([
  "Não foi possível localizar uma inscrição com os dados informados.",
  "Procure a organização para continuar o pagamento.",
]);
const formatCpf = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");

export function RegistrationResumeCard({
  resume = (input) => resumeRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: Props) {
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const parsed = registrationResumeSchema.safeParse({ cpf, birthDate });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const result = await resume(parsed.data);
      if (result.status === "paid") setMessage("Sua inscrição já está confirmada.");
      else navigateToCheckout(result.checkoutUrl);
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(
        knownErrors.has(text)
          ? text
          : "Não foi possível retomar o pagamento agora. Tente novamente.",
      );
    } finally {
      setLoading(false);
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
            <h3 className="font-display text-lg font-extrabold">Já fez sua inscrição?</h3>
            <p className="text-sm text-muted-foreground">
              Informe CPF e data de nascimento para continuar um pagamento pendente.
            </p>
          </div>
        </div>
        <form
          onSubmit={submit}
          noValidate
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="resume-cpf">CPF da inscrição</Label>
            <Input
              id="resume-cpf"
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume-birth-date">Data de nascimento da inscrição</Label>
            <Input
              id="resume-birth-date"
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Consultando…" : "Retomar pagamento"}
          </Button>
        </form>
        {message && (
          <p
            role={knownErrors.has(message) ? "status" : "alert"}
            aria-live="polite"
            className="mt-3 text-sm"
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
