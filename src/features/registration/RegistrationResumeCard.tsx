import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function RegistrationResumeCard() {
  return (
    <Card
      id="retomar-pagamento"
      className="mx-auto mt-4 max-w-4xl rounded-2xl border-amber/30 bg-amber/5 shadow-none"
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
            <RotateCcw className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-lg font-extrabold text-foreground">
              Já fez sua inscrição?
            </h3>
            <p className="text-sm text-muted-foreground">
              Acesse a Área do Participante com seu e-mail e a senha formada pelo CPF e a data de
              nascimento para continuar um pagamento pendente.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="min-h-11 shrink-0 rounded-full bg-foreground px-5 font-bold text-background"
        >
          <a href="/participante">Acessar área do participante</a>
        </Button>
      </CardContent>
    </Card>
  );
}
