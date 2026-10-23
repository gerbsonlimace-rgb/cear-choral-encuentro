import {
  CalendarDays,
  Camera,
  ChevronRight,
  ExternalLink,
  Files,
  MessageCircle,
  Music2,
  Play,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

import { hasRafflesToSell, type ParticipantRegistrationView } from "./participant.domain";
import { ChoristerWelcomeCard } from "./ChoristerWelcomeCard";
import { ChoristerNotices } from "./ChoristerNotices";
import { RaffleShareCard } from "./RaffleShareCard";
import type { RaffleShareArtInput } from "./raffleShareArt";
import type { EventNotice } from "@/features/event-notices/eventNotice.domain";

type ChoristerHomeTabProps = {
  participant: ParticipantRegistrationView;
  loadNotices?: () => Promise<EventNotice[]>;
  recentPlayback?: {
    songName: string;
    audioTitle: string;
  };
  onContinuePlayback?: () => void;
  onNavigate?: (tab: "cantos" | "documentos" | "guia") => void;
  renderRaffleArt?: (input: RaffleShareArtInput) => Promise<File>;
};

function ShortcutIllustration({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 96 64" className="mb-1.5 h-10 w-14">
      <ellipse cx="46" cy="57" rx="29" ry="4" fill="currentColor" opacity=".08" />
      <circle cx="46" cy="30" r="27" fill="currentColor" opacity=".08" />
      <rect
        x="23"
        y="12"
        width="43"
        height="42"
        rx="10"
        fill="currentColor"
        opacity=".15"
        transform="rotate(-12 44 33)"
      />
      <rect
        x="29"
        y="10"
        width="43"
        height="42"
        rx="10"
        fill="white"
        fillOpacity=".85"
        transform="rotate(7 50 31)"
      />
      <Icon x="35" y="16" width="30" height="30" strokeWidth="1.6" />
      <path
        d="m79 8 1.5 4.5L85 14l-4.5 1.5L79 20l-1.5-4.5L73 14l4.5-1.5Z"
        fill="currentColor"
        opacity=".55"
      />
      <circle cx="15" cy="38" r="3" fill="currentColor" opacity=".3" />
      <circle cx="78" cy="46" r="2" fill="currentColor" opacity=".3" />
    </svg>
  );
}

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/DMasqDLthuP1HmhJzHxqxw";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const shortcutClassName =
  "group relative flex min-h-28 min-w-0 flex-col items-start rounded-2xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 sm:p-3";

export function ChoristerHomeTab({
  participant,
  loadNotices,
  recentPlayback,
  onContinuePlayback,
  onNavigate,
  renderRaffleArt,
}: ChoristerHomeTabProps) {
  return (
    <section aria-labelledby="chorister-home-title" className="space-y-4">
      <ChoristerWelcomeCard participant={participant} />

      <section aria-labelledby="home-shortcuts-title" className="space-y-2">
        <h2 id="home-shortcuts-title" className="text-sm font-semibold text-zinc-900">
          Seu encontro, à mão
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to="/euvou"
            aria-label="Crie sua foto do encontro"
            className={`${shortcutClassName} bg-amber-50 text-amber-700 hover:bg-amber-100`}
          >
            <ShortcutIllustration icon={Camera} />
            <ChevronRight aria-hidden="true" className="absolute right-3 top-3 size-4 opacity-50" />
            <span className="text-sm font-bold text-zinc-900">Minha foto</span>
            <span className="mt-1 text-xs leading-5 text-zinc-600">
              Personalize sua foto com a arte do encontro e compartilhe.
            </span>
          </Link>
          {onNavigate &&
            [
              {
                tab: "cantos",
                label: "Explorar cantos",
                title: "Áudios",
                description: "Ouça os áudios, baixe as partituras e imprima para estudar.",
                icon: Music2,
                tone: "bg-violet-50 text-violet-600 hover:bg-violet-100",
              },
              {
                tab: "guia",
                label: "Consultar programação",
                title: "Agenda",
                description: "Consulte os horários e os locais das atividades do encontro.",
                icon: CalendarDays,
                tone: "bg-sky-50 text-sky-700 hover:bg-sky-100",
              },
              {
                tab: "documentos",
                label: "Ver partituras",
                title: "Partituras",
                description: "Abra e baixe os guias e materiais disponibilizados para você.",
                icon: Files,
                tone: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              },
            ].map(({ tab, label, title, description, icon, tone }) => (
              <button
                key={tab}
                type="button"
                aria-label={label}
                onClick={() => onNavigate(tab as "cantos" | "documentos" | "guia")}
                className={`${shortcutClassName} ${tone}`}
              >
                <ShortcutIllustration icon={icon} />
                <ChevronRight
                  aria-hidden="true"
                  className="absolute right-3 top-3 size-4 opacity-50"
                />
                <span className="text-sm font-bold text-zinc-900">{title}</span>
                <span className="mt-0.5 text-xs leading-4 text-zinc-600">{description}</span>
              </button>
            ))}
        </div>
      </section>



      {hasRafflesToSell(participant) && participant.raffles && (
        <>
        {participant.registration.raffleOnlinePaymentEnabled === true && (
        <section aria-label="Suas rifas" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-900">
              <Ticket aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-zinc-950">Suas rifas</h2>
              <p className="mt-1 text-sm text-zinc-700">
                Cada rifa vendida ajuda a fazer este encontro acontecer. Vamos juntos!
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs text-zinc-600">Meta inicial</p>
              <p className="mt-1 font-bold text-zinc-950">
                {participant.raffles.totalTickets === null
                  ? money.format(participant.raffles.totalCents / 100)
                  : `${participant.raffles.totalTickets} rifas no total`}
              </p>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs text-zinc-600">Já pagas</p>
              <p className="mt-1 font-bold text-emerald-700">
                {participant.raffles.paidTickets === null
                  ? money.format(participant.raffles.paidCents / 100)
                  : `${participant.raffles.paidTickets} já pagas`}
              </p>
            </div>
            <div className="col-span-2 rounded-xl bg-white/80 p-3 sm:col-span-1">
              <p className="text-xs text-zinc-600">Pendentes</p>
              <p className="mt-1 font-bold text-zinc-950">
                {participant.raffles.pendingTickets === null
                  ? "Saldo pendente"
                  : `${participant.raffles.pendingTickets} pendentes`}
              </p>
              <p className="text-xs text-zinc-700">{money.format(participant.raffles.pendingCents / 100)}</p>
            </div>
          </div>
          {participant.raffles.extraTickets ? (
            <p className="mt-4 text-sm font-semibold text-emerald-800">
              Incrível! Você já vendeu {participant.raffles.extraTickets} {participant.raffles.extraTickets === 1 ? "rifa" : "rifas"} além da meta.
            </p>
          ) : null}
          {participant.raffles.pendingCents === 0 && (
            <p className="mt-4 text-sm font-semibold text-emerald-800">Rifas quitadas. Obrigado por fazer parte! Você pode continuar vendendo.</p>
          )}
          {participant.raffles.totalTickets !== null ? (
            <Link
              to="/participante/pagamento"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Pagar agora via Pix ou cartão de crédito <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <p className="mt-4 text-sm text-zinc-700">Consulte seu regente para conferir o saldo das rifas.</p>
          )}
        </section>
        )}
        <RaffleShareCard participant={participant} renderArt={renderRaffleArt} />
        </>
      )}

      <a
        href={WHATSAPP_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Entrar no grupo do encontro no WhatsApp"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 sm:p-4"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-emerald-50">
          <MessageCircle aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-zinc-900">
            Grupo do encontro no WhatsApp
          </span>
          <span className="mt-0.5 block text-xs leading-4 text-zinc-600">
            Converse com os demais coralistas e receba os avisos em primeira mão.
          </span>
        </span>
        <ExternalLink
          aria-hidden="true"
          className="size-4 shrink-0 text-emerald-700 opacity-70"
        />
      </a>


      <ChoristerNotices loadNotices={loadNotices} />

      {recentPlayback && onContinuePlayback ? (
        <section
          aria-labelledby="continue-listening-title"
          className="rounded-2xl border border-zinc-200 p-4"
        >
          <p id="continue-listening-title" className="mb-1 text-xs font-semibold text-zinc-500">
            Continuar ouvindo
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-14 w-full justify-start rounded-xl px-2 py-2 text-left text-zinc-950 hover:bg-zinc-50"
            aria-label={`Continuar ouvindo ${recentPlayback.songName}`}
            onClick={onContinuePlayback}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-900">
                <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{recentPlayback.songName}</span>
                <span className="block truncate text-xs font-normal text-zinc-600">
                  {recentPlayback.audioTitle}
                </span>
              </span>
            </span>
          </Button>
        </section>
      ) : !onNavigate ? (
        <p className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          <Music2 aria-hidden="true" className="size-4" />
          Seus repertórios estão disponíveis em Cantos.
        </p>
      ) : null}
    </section>
  );
}
