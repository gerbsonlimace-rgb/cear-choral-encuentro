import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Files,
  Music2,
  Play,
} from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import type { ParticipantRegistrationView } from "./participant.domain";
import { ChoristerNotices } from "./ChoristerNotices";
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
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "coralista";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ChoristerHomeTab({
  participant,
  loadNotices,
  recentPlayback,
  onContinuePlayback,
  onNavigate,
}: ChoristerHomeTabProps) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section aria-labelledby="chorister-home-title" className="space-y-6">
      <header className="flex items-center gap-4 border-b border-zinc-200 pb-5">
        <Avatar className="size-14 border border-zinc-200 bg-zinc-50 sm:size-16">
          {participant.identity.photoUrl && !photoFailed ? (
            <img
              src={participant.identity.photoUrl}
              alt={`Foto de ${participant.identity.name}`}
              className="h-full w-full object-cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <AvatarFallback
              role="img"
              aria-label="Foto não disponível"
              className="bg-zinc-100 font-semibold text-zinc-700"
            >
              {getInitials(participant.identity.name)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">Bem-vindo</p>
          <h1
            id="chorister-home-title"
            className="truncate text-2xl font-semibold tracking-tight text-zinc-950"
          >
            {getFirstName(participant.identity.name)}
          </h1>
          <p className="mt-0.5 truncate text-sm text-zinc-600">
            {participant.registration.choirName}
          </p>
        </div>
      </header>

      <section
        aria-label="Status do acesso"
        className="grid grid-cols-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        {[
          ["Inscrição", "Confirmada"],
          ["Pagamento", participant.payment.status === "paid" ? "Pago" : "Pendente"],
          ["Acesso", "Liberado"],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={
              index > 0 ? "border-l border-zinc-100 px-2.5 py-4 sm:px-4" : "px-2.5 py-4 sm:px-4"
            }
          >
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              {label}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-zinc-900">
              <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-600" />
              {value}
            </p>
          </div>
        ))}
      </section>

      <ChoristerNotices loadNotices={loadNotices} />

      <a
        href="/minha-foto"
        className="flex min-h-20 items-center gap-3 rounded-2xl bg-[#ffc400] p-4 text-left text-black transition-colors hover:bg-[#f2ba00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black text-[#ffc400]">
          <Camera aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">Crie sua foto do encontro</span>
          <span className="mt-0.5 block text-xs font-medium text-black/70">
            Escolha a arte e compartilhe
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </a>

      {onNavigate && (
        <section aria-labelledby="home-shortcuts-title" className="space-y-3">
          <h2 id="home-shortcuts-title" className="text-sm font-semibold text-zinc-900">
            Seu encontro, à mão
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                tab: "cantos",
                title: "Explorar cantos",
                description: "Áudios e partituras",
                icon: Music2,
              },
              {
                tab: "documentos",
                title: "Ver documentos",
                description: "Guias e materiais",
                icon: Files,
              },
              {
                tab: "guia",
                title: "Consultar programação",
                description: "Horários e locais",
                icon: CalendarDays,
              },
            ].map(({ tab, title, description, icon: Icon }) => (
              <button
                key={tab}
                type="button"
                aria-label={title}
                onClick={() => onNavigate(tab as "cantos" | "documentos" | "guia")}
                className="flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">{title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>
        </section>
      )}

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
