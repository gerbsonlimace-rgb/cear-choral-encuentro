import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginParticipant } from "@/lib/participant.functions";
import { buildReceiptRows, downloadReceiptPdf } from "@/features/registration/receipt";
import type { ParticipantRegistrationView } from "@/features/registration/participant-area.server";

export const Route = createFileRoute("/participante")({
  head: () => ({
    meta: [
      { title: "Área do participante — II Encontro de Coros Diocesanos e Litúrgicos" },
      {
        name: "description",
        content:
          "Acesse sua inscrição no II Encontro de Coros Diocesanos e Litúrgicos e baixe o comprovante em PDF.",
      },
      { property: "og:title", content: "Área do participante — II Encontro de Coros" },
      {
        property: "og:description",
        content: "Consulte sua inscrição e baixe o comprovante em PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParticipantAreaPage,
});

function ParticipantAreaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<ParticipantRegistrationView[] | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await loginParticipant({ data: { email, password } });
      if (result.ok) {
        setRegistrations(result.registrations);
        setPassword("");
      } else {
        setError(result.message);
      }
    } catch {
      setError("Não foi possível entrar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl">
        {registrations ? (
          <ParticipantPanel
            registrations={registrations}
            onExit={() => {
              setRegistrations(null);
              setEmail("");
            }}
          />
        ) : (
          <Card className="border-border bg-card shadow-sm shadow-teal/10">
            <CardContent className="p-6 sm:p-8">
              <UserRound className="size-10 text-teal" aria-hidden="true" />
              <h1 className="mt-3 font-display text-3xl font-extrabold text-foreground">
                Área do participante
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre com o e-mail informado na inscrição. A senha é o seu CPF seguido da data de
                nascimento (ex.: 12345678909 20031990).
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="participante-email">E-mail da inscrição</Label>
                  <Input
                    id="participante-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participante-senha">Senha (CPF + data de nascimento)</Label>
                  <Input
                    id="participante-senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-teal font-bold text-teal-foreground hover:bg-teal/90"
                >
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>

              <a
                href="/"
                className="mt-6 inline-flex text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Voltar ao início
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function ParticipantPanel({
  registrations,
  onExit,
}: {
  registrations: ParticipantRegistrationView[];
  onExit: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border bg-card shadow-sm shadow-teal/10">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">
              Olá, {registrations[0]?.participantName || "participante"}
            </h1>
            <p className="text-sm text-muted-foreground">{registrations[0]?.email}</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={onExit}>
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </CardContent>
      </Card>

      {registrations.map((registration, index) => (
        <RegistrationCard key={registration.orderNsu ?? index} registration={registration} />
      ))}
    </div>
  );
}

function RegistrationCard({ registration }: { registration: ParticipantRegistrationView }) {
  const [downloading, setDownloading] = useState(false);
  const paid = registration.paymentStatus === "paid";
  const rows = paid
    ? buildReceiptRows({
        participantName: registration.participantName,
        paymentMethod: registration.paymentMethod ?? "pix",
        installments: registration.installments ?? 1,
        ...(registration.choirName ? { choirName: registration.choirName } : {}),
        ...(registration.amountCents ? { amountCents: registration.amountCents } : {}),
        ...(registration.paidAmountCents ? { paidAmountCents: registration.paidAmountCents } : {}),
        ...(registration.paidAt ? { paidAt: registration.paidAt } : {}),
        ...(registration.orderNsu ? { orderNsu: registration.orderNsu } : {}),
      })
    : [];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceiptPdf({
        participantName: registration.participantName,
        paymentMethod: registration.paymentMethod ?? "pix",
        installments: registration.installments ?? 1,
        ...(registration.choirName ? { choirName: registration.choirName } : {}),
        ...(registration.amountCents ? { amountCents: registration.amountCents } : {}),
        ...(registration.paidAmountCents ? { paidAmountCents: registration.paidAmountCents } : {}),
        ...(registration.paidAt ? { paidAt: registration.paidAt } : {}),
        ...(registration.orderNsu ? { orderNsu: registration.orderNsu } : {}),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm shadow-teal/10">
      <CardContent className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">
          {paid ? "Inscrição confirmada" : "Pagamento pendente"}
        </p>

        {paid ? (
          <>
            <dl className="mt-4 divide-y divide-border">
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
              {registration.receiptUrl && (
                <a
                  href={registration.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal underline-offset-4 hover:underline"
                >
                  Ver recibo da InfinitePay
                </a>
              )}
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-muted-foreground">
              Sua inscrição foi registrada, mas o pagamento ainda não foi confirmado.
            </p>
            {registration.checkoutUrl && (
              <Button
                asChild
                className="w-full rounded-full bg-teal font-bold text-teal-foreground hover:bg-teal/90"
              >
                <a href={registration.checkoutUrl}>Concluir pagamento</a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
