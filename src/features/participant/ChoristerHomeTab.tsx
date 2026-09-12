import { CalendarDays, ChevronRight, FileText, MapPin, Music2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";

import type { ParticipantRegistrationView } from "./participant.domain";

type ChoristerHomeTabProps = {
  participant: ParticipantRegistrationView;
  event: ChoristerPortalFeed["event"];
  onOpenSongs: () => void;
  onOpenScores: () => void;
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "coralista";
}

export function ChoristerHomeTab({
  participant,
  event,
  onOpenSongs,
  onOpenScores,
}: ChoristerHomeTabProps) {
  const scoreCount =
    event.songs.reduce((count, song) => count + song.sheetMusic.length, 0) + event.documents.length;
  const songLabel = `${event.songs.length} ${event.songs.length === 1 ? "canto publicado" : "cantos publicados"}`;
  const scoreLabel = `${scoreCount} ${scoreCount === 1 ? "material publicado" : "materiais publicados"}`;

  return (
    <section aria-labelledby="chorister-home-title" className="space-y-5">
      <header>
        <p className="text-sm font-medium text-amber-700">
          Olá, {getFirstName(participant.identity.name)}
        </p>
        <h1
          id="chorister-home-title"
          className="mt-1 font-display text-2xl font-semibold text-zinc-950"
        >
          Seu encontro começa aqui
        </h1>
      </header>

      <article className="overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-lg">
        <div className="border-b border-amber-300/35 bg-amber-400 px-5 py-3 text-xs font-bold tracking-[0.2em] text-zinc-950 uppercase">
          Evento oficial
        </div>
        <div className="space-y-4 p-5">
          <h2 className="font-display text-2xl leading-tight">{event.name}</h2>
          <div className="space-y-2 text-sm text-zinc-200">
            <p className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 text-amber-300" />
              <span>20–22 de novembro de 2026</span>
            </p>
            <p className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4 text-amber-300" />
              <span>{event.location ?? "Local a confirmar"}</span>
            </p>
          </div>
        </div>
      </article>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 h-auto justify-between border-amber-300 bg-white px-4 py-3 text-left text-zinc-950 hover:bg-amber-50"
          aria-label={`Ensaiar cantos, ${songLabel}`}
          onClick={onOpenSongs}
        >
          <span className="flex items-center gap-3">
            <Music2 aria-hidden="true" className="size-5 text-amber-700" />
            <span>
              <span className="block font-semibold">Ensaiar cantos</span>
              <span className="block text-xs font-normal text-zinc-600">{songLabel}</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 h-auto justify-between border-amber-300 bg-white px-4 py-3 text-left text-zinc-950 hover:bg-amber-50"
          aria-label={`Abrir partituras, ${scoreLabel}`}
          onClick={onOpenScores}
        >
          <span className="flex items-center gap-3">
            <FileText aria-hidden="true" className="size-5 text-amber-700" />
            <span>
              <span className="block font-semibold">Abrir partituras</span>
              <span className="block text-xs font-normal text-zinc-600">{scoreLabel}</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-zinc-800">
        Escolha o áudio do seu próprio naipe para ensaiar com mais segurança.
      </aside>
    </section>
  );
}
