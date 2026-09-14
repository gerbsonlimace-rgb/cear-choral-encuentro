import { CalendarDays, Camera, ChevronRight, Files, Music2, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

import type { ParticipantRegistrationView } from "./participant.domain";
import { ChoristerWelcomeCard } from "./ChoristerWelcomeCard";
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

export function ChoristerHomeTab({
  participant,
  loadNotices,
  recentPlayback,
  onContinuePlayback,
  onNavigate,
}: ChoristerHomeTabProps) {
  return (
    <section aria-labelledby="chorister-home-title" className="space-y-6">
      <ChoristerWelcomeCard participant={participant} />

      <ChoristerNotices loadNotices={loadNotices} />

      <Link
        to="/participante/minha-foto"
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
      </Link>

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
