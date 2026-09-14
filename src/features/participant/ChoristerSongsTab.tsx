import { Download, MoreHorizontal, Pause, Play, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isSignedUrlExpired,
  searchChoristerSongs,
  type ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";
import { cn } from "@/lib/utils";

import { getChoristerVoiceStyle, type ChoristerVoicePart } from "./choristerVoiceStyles";

type Song = ChoristerPortalFeed["event"]["songs"][number];
type MainVoice = "soprano" | "contralto" | "tenor" | "baixo";

const mainVoices: MainVoice[] = ["soprano", "contralto", "tenor", "baixo"];
const voiceLabels: Record<ChoristerVoicePart, string> = {
  principal: "Principal",
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  todos: "4 Vozes",
};

type ChoristerSongsTabProps = {
  songs: ChoristerPortalFeed["event"]["songs"];
  headingId?: string;
  eventName?: string;
  initialVoicePart?: string | null;
  onPlay: (audioId: string) => void;
  onOpenSong: (songId: string) => void;
  onOpenScore: (assetId: string) => void;
  onRenewAudio?: (audioId: string) => Promise<Song["audios"][number] | undefined>;
  activeAudioId?: string | null;
  isPlaying?: boolean;
  playerStatus?: "ready" | "refreshing" | "ended" | "error";
  currentTime?: number;
  duration?: number;
  onTogglePlayback?: () => void;
  onSeek?: (seconds: number) => void;
  onVoiceChange?: (voice: MainVoice) => void;
};

function orderedSongs(songs: ChoristerPortalFeed["event"]["songs"]) {
  return [...songs].sort((first, second) => first.order - second.order);
}

function isMainVoice(value: string | null | undefined): value is MainVoice {
  return mainVoices.includes(value as MainVoice);
}

function resolveInitialVoice(
  requestedVoice: string | null | undefined,
  songs: ChoristerPortalFeed["event"]["songs"],
) {
  if (
    isMainVoice(requestedVoice) &&
    songs.some((song) => song.audios.some((audio) => audio.voicePart === requestedVoice))
  ) {
    return requestedVoice;
  }
  for (const voice of mainVoices) {
    if (songs.some((song) => song.audios.some((audio) => audio.voicePart === voice))) {
      return voice;
    }
  }
  return "soprano";
}

function audioForVoice(song: Song, voice: MainVoice) {
  return song.audios.find((audio) => audio.voicePart === voice);
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ChoristerSongsTab({
  songs,
  headingId = "chorister-songs-title",
  eventName,
  initialVoicePart,
  onPlay,
  onOpenSong,
  onOpenScore,
  onRenewAudio,
  activeAudioId,
  isPlaying = false,
  playerStatus = "ready",
  currentTime = 0,
  duration = 0,
  onTogglePlayback,
  onSeek,
  onVoiceChange,
}: ChoristerSongsTabProps) {
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadGeneration = useRef(0);
  const pendingMenuAction = useRef<(() => void) | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<MainVoice>(() =>
    resolveInitialVoice(initialVoicePart, songs),
  );
  const visibleSongs = useMemo(
    () => searchChoristerSongs(orderedSongs(songs), query),
    [query, songs],
  );
  const hasActiveSearch = query.trim().length > 0;

  useEffect(
    () => () => {
      downloadGeneration.current += 1;
    },
    [songs],
  );

  async function downloadAudio(song: Song, audio: Song["audios"][number]) {
    const generation = ++downloadGeneration.current;
    setDownloadingId(audio.id);
    setDownloadError(null);
    try {
      const asset = isSignedUrlExpired(audio.expiresAt) ? await onRenewAudio?.(audio.id) : audio;
      if (generation !== downloadGeneration.current) return;
      if (!asset || asset.id !== audio.id || isSignedUrlExpired(asset.expiresAt)) {
        throw new Error("Audio unavailable");
      }
      const url = new URL(asset.signedUrl);
      const extension = url.pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "";
      const filename =
        `${song.name} - ${voiceLabels[audio.voicePart as ChoristerVoicePart] ?? audio.title}${extension}`.replace(
          /[<>:"/\\|?*]/g,
          "-",
        );
      url.searchParams.set("download", filename);
      const anchor = document.createElement("a");
      anchor.href = url.toString();
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      if (generation === downloadGeneration.current) setDownloadError(song.id);
    } finally {
      if (generation === downloadGeneration.current) setDownloadingId(null);
    }
  }

  useEffect(() => {
    setSelectedVoice(resolveInitialVoice(initialVoicePart, songs));
  }, [eventName, initialVoicePart, songs]);

  function selectVoice(voice: MainVoice) {
    if (voice === selectedVoice) return;
    setSelectedVoice(voice);
    onVoiceChange?.(voice);
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 text-zinc-950">
      <h2 id={headingId} className="sr-only">
        Músicas
      </h2>

      <label className="relative block">
        <span className="sr-only">
          {eventName ? `Buscar cantos em ${eventName}` : "Buscar cantos"}
        </span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="search"
          aria-label={eventName ? `Buscar cantos em ${eventName}` : "Buscar cantos"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar música, tipo ou voz..."
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white py-2 pr-20 pl-10 text-base sm:text-sm text-zinc-950 outline-none placeholder:text-slate-500 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-500/20"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-medium text-zinc-500">
          {visibleSongs.length} {visibleSongs.length === 1 ? "canto" : "cantos"}
        </span>
      </label>

      <div className="flex min-h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
        <span className="mr-0.5 shrink-0 pl-0.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Voz
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {mainVoices.map((voice) => {
            const selected = selectedVoice === voice;
            const style = getChoristerVoiceStyle(voice, selected);

            return (
              <button
                key={voice}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={voiceLabels[voice]}
                onClick={() => selectVoice(voice)}
                className={cn(
                  "min-h-11 min-w-0 flex-1 rounded-lg px-1 text-[11px] font-semibold transition-colors sm:text-xs",
                  selected
                    ? `${style.border} ${style.text} bg-white border shadow-sm ring-1 ring-current`
                    : "border border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950",
                )}
              >
                {voiceLabels[voice]}
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveSearch ? (
        <div className="flex min-h-9 items-center justify-between gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
            {visibleSongs.length} {visibleSongs.length === 1 ? "resultado" : "resultados"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 px-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={() => setQuery("")}
          >
            <X aria-hidden="true" className="size-3.5" />
            Limpar filtros
          </Button>
        </div>
      ) : null}

      <div
        aria-label="Músicas do evento"
        role="region"
        className="divide-y divide-zinc-100 border-y border-zinc-200"
      >
        {visibleSongs.map((song) => {
          const audio = audioForVoice(song, selectedVoice);
          const activeAudio = audio?.id === activeAudioId ? audio : undefined;

          return (
            <article
              key={song.id}
              className={cn("px-1 py-3 transition-colors", activeAudio && "bg-zinc-50")}
            >
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  disabled={!audio}
                  aria-label={
                    audio
                      ? `${activeAudio && isPlaying ? "Pausar" : "Tocar"} ${voiceLabels[selectedVoice]} de ${song.name}`
                      : `Sem áudio para ${voiceLabels[selectedVoice]} de ${song.name}`
                  }
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
                    activeAudio
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  )}
                  onClick={() => {
                    if (!audio) return;
                    if (activeAudio) onTogglePlayback?.();
                    else onPlay(audio.id);
                  }}
                >
                  {activeAudio && isPlaying ? (
                    <Pause aria-hidden="true" className="size-4 fill-current" />
                  ) : (
                    <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold leading-5 text-zinc-950">
                        {song.name}
                      </h3>
                      <p className="mt-0.5 break-words text-xs leading-5 text-zinc-500">
                        {song.liturgicalType}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Opções de ${song.name}`}
                          className="-my-0.5 grid size-11 shrink-0 place-items-center rounded-lg text-zinc-400 outline-none hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-500"
                        >
                          <MoreHorizontal aria-hidden="true" className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="chorister-app border-zinc-200 bg-white text-zinc-700"
                        onCloseAutoFocus={() => {
                          const action = pendingMenuAction.current;
                          pendingMenuAction.current = null;
                          if (action) window.setTimeout(action, 0);
                        }}
                      >
                        <DropdownMenuItem
                          className="min-h-11"
                          disabled={!audio || downloadingId === audio.id}
                          onSelect={() => {
                            if (audio) void downloadAudio(song, audio);
                          }}
                        >
                          <Download aria-hidden="true" />
                          {audio && downloadingId === audio.id
                            ? "Preparando download…"
                            : "Baixar áudio"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="min-h-11"
                          onSelect={() => {
                            pendingMenuAction.current = () => onOpenSong(song.id);
                          }}
                        >
                          Letra e cifra
                        </DropdownMenuItem>
                        {song.sheetMusic[0] ? (
                          <DropdownMenuItem
                            className="min-h-11"
                            onSelect={() => {
                              pendingMenuAction.current = () => onOpenScore(song.sheetMusic[0].id);
                            }}
                          >
                            Abrir partitura
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {!audio ? (
                    <span className="sr-only">Sem áudio para {voiceLabels[selectedVoice]}.</span>
                  ) : null}
                  {downloadError === song.id ? (
                    <p role="alert" className="text-[11px] text-red-600">
                      Não foi possível baixar o áudio. Tente novamente.
                    </p>
                  ) : null}

                  {activeAudio ? (
                    <div role="region" aria-label={`Player de ${song.name}`}>
                      <div className="flex min-w-0 items-center gap-2 text-[10px] tabular-nums text-zinc-500">
                        <span>{formatAudioTime(currentTime)}</span>
                        <input
                          type="range"
                          min="0"
                          max={duration > 0 ? duration : 0}
                          step="1"
                          value={duration > 0 ? Math.min(currentTime, duration) : 0}
                          disabled={duration <= 0}
                          aria-label="Progresso do áudio"
                          className="min-h-11 min-w-0 flex-1 cursor-pointer accent-zinc-700 disabled:opacity-50"
                          onChange={(event) => onSeek?.(Number(event.currentTarget.value))}
                        />
                        <span>{formatAudioTime(duration)}</span>
                      </div>
                      {playerStatus === "error" ? (
                        <p role="alert" className="text-[11px] text-red-600">
                          Não foi possível reproduzir este áudio. Tente novamente.
                        </p>
                      ) : playerStatus === "refreshing" ? (
                        <p role="status" className="text-[11px] text-zinc-500">
                          Atualizando áudio…
                        </p>
                      ) : playerStatus === "ended" ? (
                        <p role="status" className="text-[11px] text-zinc-500">
                          Concluído
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {song.audios.length === 0 ? (
                <span className="sr-only">Este canto ainda não possui áudio publicado.</span>
              ) : null}
            </article>
          );
        })}
        {visibleSongs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">Nenhum canto encontrado.</p>
        ) : null}
      </div>
    </section>
  );
}
