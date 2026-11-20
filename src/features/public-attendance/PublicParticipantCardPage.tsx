import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicParticipantCard } from "@/lib/public-attendance.functions";
import type { PublicParticipantCard } from "./publicAttendance.domain";

export function PublicParticipantCardPage({ token, loadCard = getPublicParticipantCard }: {
  token: string; loadCard?: (input: { data: { token: string } }) => Promise<PublicParticipantCard>;
}) {
  const [card, setCard] = useState<PublicParticipantCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setCard(null);
    setError(null);

    void loadCard({ data: { token } })
      .then(value => {
        if (current) setCard(value);
      })
      .catch((err) => {
        if (current) {
          const messages = [
            "Não foi possível abrir este cartão. Confira o link recebido ou procure a equipe do evento.",
            "Falha ao carregar cartão. Tentando novamente...",
            "Cartão não disponível no momento. Tente mais tarde ou procure a equipe."
          ];
          setError(messages[Math.min(attempt, messages.length - 1)]);
        }
      });

    return () => {
      current = false;
    };
  }, [token, loadCard, attempt]);

  return (
    <main className="internal-app flex min-h-svh items-start justify-center bg-[#f7f7f5] px-4 py-8 text-zinc-950 sm:py-12 print:bg-white print:py-0">
      <div className="w-full max-w-sm">
        {!card && !error && <p role="status" className="text-center text-sm text-zinc-600">Abrindo seu cartão…</p>}
        {error && (
          <div className="space-y-4 rounded-xl border bg-white p-5">
            <p role="alert" className="text-sm text-red-800">{error}</p>
            <Button onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>
          </div>
        )}
        {card && (
          <>
            <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white print:border-0">
              <header className="bg-zinc-950 px-5 py-4 text-white print:bg-white print:text-zinc-950">
                <p className="font-semibold">Encontro de Coros · Ceará</p>
                <p className="mt-1 text-sm text-zinc-600 print:text-zinc-600">20 a 22 de novembro de 2026</p>
              </header>
              <div className="p-5 text-center">
                <h1 className="break-words text-2xl font-bold tracking-tight">{card.name}</h1>
                <p className="mt-2 break-words text-sm text-zinc-600">{card.choirName}</p>
                <img src={card.qrDataUrl} alt={`QR Code individual de ${card.name}`} width={720} height={720} className="mx-auto mt-4 aspect-square w-full"/>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">Apresente este QR Code à equipe na entrada das atividades. O mesmo cartão vale para todo o encontro.</p>
                {!card.eligible && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Sua inscrição ainda não está confirmada. Procure a equipe antes da chamada.</p>
                )}
              </div>
            </article>
            <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
              <Button variant="outline" asChild>
                <a href={card.qrDataUrl} download="meu-qr-encontro.png">
                  <Download className="size-4"/>Salvar QR
                </a>
              </Button>
              <Button onClick={() => window.print()}><Printer className="size-4"/>Imprimir cartão</Button>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-zinc-600 print:hidden">
              Guarde este cartão. Você pode salvar a imagem ou tirar uma captura da tela para apresentar sem internet.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
