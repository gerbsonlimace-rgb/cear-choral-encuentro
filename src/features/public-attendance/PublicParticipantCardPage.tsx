import { useEffect, useState } from "react";
import { BedDouble, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicParticipantCard } from "@/lib/public-attendance.functions";
import type { PublicParticipantCard } from "./publicAttendance.domain";
import eventLogo from "@/assets/logo-coros-diocesanos-regional.png";
import "./participantCard.css";

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
    <main className="internal-app flex min-h-svh items-start justify-center bg-[#eee9e0] px-3 py-4 text-zinc-950 sm:py-8 print:bg-white print:py-0">
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
            <article className="participant-card-art" aria-label={`Cartão de ${card.name}`}>
              <header className="participant-card-header">
                <img src={eventLogo} alt="Encontro de Coros Diocesanos e Litúrgicos" className="participant-card-logo"/>
                <p>II ENCONTRO DE COROS · QUIXADÁ 2026</p>
              </header>
              <div className="participant-card-photo">
                {card.photoUrl?<img src={card.photoUrl} alt={`Foto de ${card.name}`} onError={event=>{event.currentTarget.style.display="none";}}/>:null}
                <span aria-hidden="true">{card.name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("")}</span>
              </div>
              <div className={`participant-card-identity ${card.name.length+card.choirName.length+(card.fullName!==card.name?(card.fullName?.length??0):0)>90?"participant-card-identity-dense":""}`}>
                <p className="participant-card-role">PARTICIPANTE</p>
                <h1 style={{fontSize:`${card.name.length>32?4.2:card.name.length>22?4.8:5.4}cqw`}}>{card.name}</h1>
                <p className="participant-card-choir">{card.choirName}</p>
                {card.fullName&&card.fullName!==card.name&&<p className="participant-card-fullname">{card.fullName}</p>}
              </div>
              {card.lodging&&<section className="participant-card-lodging" aria-label="Sua hospedagem">
                <div className="participant-card-room-heading">
                  <BedDouble aria-hidden="true" className="participant-card-bed" />
                  <div><p className="participant-card-room-label">SUA ACOMODAÇÃO</p><h2>{card.lodging.room}</h2></div>
                </div>
                {card.lodging.location&&<p className="participant-card-location">{card.lodging.location}</p>}
                <p>{card.lodging.roommates.length?"Você está hospedado com":"Hospedagem do participante"}</p>
                {card.lodging.roommates.length>0&&<p className="participant-card-roommates">{card.lodging.roommates.join(" · ")}</p>}
              </section>}
              <div className="participant-card-qr">
                <img src={card.qrDataUrl} alt={`QR Code individual de ${card.name}`} width={720} height={720}/>
              </div>
              <p className="participant-card-instruction">Apresente este QR à equipe em cada atividade</p>
              <footer>20–22 NOV 2026 · QUIXADÁ, CE</footer>
            </article>
            {!card.eligible&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Sua inscrição ainda não está confirmada. Procure a equipe antes da chamada.</p>}
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
