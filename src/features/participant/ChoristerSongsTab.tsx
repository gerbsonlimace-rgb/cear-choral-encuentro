import { FileText, Music2, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchChoristerSongs,
  type ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";

type Song = ChoristerPortalFeed["event"]["songs"][number];
type VoiceFilter = "all" | "principal" | "soprano" | "contralto" | "tenor" | "baixo" | "todos";

const voiceLabels: Record<Exclude<VoiceFilter, "all">, string> = {
  principal: "Principal",
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  todos: "Todos",
};

type ChoristerSongsTabProps = {
  songs: ChoristerPortalFeed["event"]["songs"];
  onPlay: (audioId: string) => void;
  onOpenSong: (songId: string) => void;
  onOpenScore: (assetId: string) => void;
};

function orderedSongs(songs: ChoristerPortalFeed["event"]["songs"]) {
  return [...songs].sort((first, second) => first.order - second.order);
}

function availableVoices(song: Song, voice: VoiceFilter) {
  return song.audios.filter((audio) => voice === "all" || audio.voicePart === voice);
}

export function ChoristerSongsTab({
  songs,
  onPlay,
  onOpenSong,
  onOpenScore,
}: ChoristerSongsTabProps) {
  const [query, setQuery] = useState("");
  const [voice, setVoice] = useState<VoiceFilter>("all");
  const visibleSongs = useMemo(
    () => searchChoristerSongs(orderedSongs(songs), query),
    [query, songs],
  );

  return (
    <section aria-labelledby="chorister-songs-title" className="space-y-4">
      <header>
        <p className="text-sm font-medium text-amber-700">Repertório oficial</p>
        <h1
          id="chorister-songs-title"
          className="mt-1 font-display text-2xl font-semibold text-zinc-950"
        >
          Cantos
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="relative block">
          <span className="sr-only">Buscar cantos</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="search"
            aria-label="Buscar cantos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou tipo"
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-10 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          />
        </label>
        <Select value={voice} onValueChange={(value) => setVoice(value as VoiceFilter)}>
          <SelectTrigger aria-label="Filtrar por naipe" className="min-h-11 h-11 bg-white">
            <SelectValue placeholder="Todos os naipes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-11">
              Todos os naipes
            </SelectItem>
            {Object.entries(voiceLabels).map(([value, label]) => (
              <SelectItem key={value} value={value} className="min-h-11">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div aria-label="Cantos publicados" role="region" className="space-y-3">
        {visibleSongs.map((song) => {
          const audios = availableVoices(song, voice);
          const voiceSummary = song.audios.length
            ? song.audios.map((audio) => voiceLabels[audio.voicePart]).join(", ")
            : null;
          const firstScore = song.sheetMusic[0];

          return (
            <article
              key={song.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
                    {song.liturgicalType}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-zinc-950">
                    {song.name}
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 shrink-0 px-3 text-amber-800 hover:bg-amber-50"
                  aria-label={`Abrir canto ${song.name}`}
                  onClick={() => onOpenSong(song.id)}
                >
                  Abrir canto
                </Button>
              </div>

              {voiceSummary ? (
                <p className="mt-3 text-sm text-zinc-600">Vozes disponíveis: {voiceSummary}</p>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">
                  Este canto ainda não possui áudio publicado.
                </p>
              )}

              {song.audios.length > 0 && audios.length === 0 && (
                <p className="mt-3 text-sm text-zinc-600">
                  Não há áudio publicado para este naipe.
                </p>
              )}
              {audios.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {audios.map((audio) => (
                    <Button
                      key={audio.id}
                      type="button"
                      variant="outline"
                      className="min-h-11 border-amber-300 text-zinc-900 hover:bg-amber-50"
                      onClick={() => onPlay(audio.id)}
                    >
                      <Play aria-hidden="true" className="size-4 fill-current" />
                      Tocar {voiceLabels[audio.voicePart]}
                    </Button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                {firstScore ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3 text-zinc-700 hover:bg-zinc-100"
                    onClick={() => onOpenScore(firstScore.id)}
                  >
                    <FileText aria-hidden="true" className="size-4" />
                    Abrir partitura de {song.name}
                  </Button>
                ) : (
                  <p className="flex min-h-11 items-center text-sm text-zinc-500">
                    Partitura ainda não publicada.
                  </p>
                )}
                {(song.lyrics || song.chords) && (
                  <p className="flex min-h-11 items-center text-sm text-zinc-500">
                    <Music2 aria-hidden="true" className="mr-2 size-4" />
                    Letra e cifra disponíveis no detalhe.
                  </p>
                )}
              </div>
            </article>
          );
        })}
        {visibleSongs.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
            Nenhum canto encontrado.
          </p>
        )}
      </div>
    </section>
  );
}
