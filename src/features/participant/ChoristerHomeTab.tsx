import {
  CalendarDays,
  Camera,
  ChevronRight,
  Files,
  Music2,
  Play,
  type LucideIcon,
} from "lucide-react";
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

const shortcutClassName =
  "group relative flex min-h-28 min-w-0 flex-col items-start rounded-2xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 sm:p-3";

export function ChoristerHomeTab({
  participant,
  loadNotices,
  recentPlayback,
  onContinuePlayback,
  onNavigate,
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
            to="/participante/minha-foto"
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
