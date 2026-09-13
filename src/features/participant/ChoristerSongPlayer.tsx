import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, LoaderCircle, Music2, Pause, Play } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";
import { cn } from "@/lib/utils";
import { ChoristerScoresTab, type PdfAssetAction } from "./ChoristerScoresTab";
import { voiceStyles } from "./choristerVoiceStyles";

type Song = ChoristerPortalFeed["event"]["songs"][number];
export type ChoristerSongPlayerProps = {
  song: Song;
  event: ChoristerPortalFeed["event"];
  artworkUrl?: string | null;
  initialVoicePart?: string | null;
  activeAudioId?: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playerStatus: "ready" | "refreshing" | "ended" | "error";
  onClose: () => void;
  onPlay: (audioId: string) => void;
  onTogglePlayback: () => void;
  onSeek: (seconds: number) => void;
  onOpenScore: PdfAssetAction;
  onDownloadScore: PdfAssetAction;
};

function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const contentTabs = [
  { value: "lyrics", label: "Letra" },
  { value: "sheet", label: "Partitura" },
  { value: "chords", label: "Cifra" },
] as const;

export function ChoristerSongPlayer({
  song,
  event,
  artworkUrl,
  initialVoicePart,
  activeAudioId,
  isPlaying,
  currentTime,
  duration,
  playerStatus,
  onClose,
  onPlay,
  onTogglePlayback,
  onSeek,
  onOpenScore,
  onDownloadScore,
}: ChoristerSongPlayerProps) {
  const [tab, setTab] = useState("lyrics");
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [returnFocusTarget] = useState(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const currentAudio = song.audios.find((audio) => audio.id === activeAudioId);
  const preferredAudio =
    song.audios.find((audio) => audio.voicePart === initialVoicePart) ?? song.audios[0];
  const playing = Boolean(currentAudio && isPlaying);
  const refreshing = Boolean(currentAudio && playerStatus === "refreshing");
  const total = currentAudio && Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const position =
    currentAudio && Number.isFinite(currentTime) ? Math.max(0, Math.min(currentTime, total)) : 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-zinc-950/15" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
          }}
          className="chorister-app fixed inset-0 z-50 flex h-svh min-h-0 flex-col overflow-hidden bg-white text-zinc-950 outline-none sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:h-[min(52rem,94svh)] sm:w-[min(44rem,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-xl"
        >
          <header className="flex shrink-0 items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar player expandido"
              className="grid size-11 place-items-center rounded-full text-zinc-600 hover:bg-zinc-100"
            >
              <ChevronDown aria-hidden="true" className="size-5" />
            </button>
            <p className="min-w-0 truncate px-3 text-xs font-medium text-zinc-500">{event.name}</p>
            <div aria-hidden="true" className="flex shrink-0 gap-1.5">
              {contentTabs.map(({ value }) => (
                <span
                  key={value}
                  className={cn(
                    "h-1.5 rounded-full",
                    tab === value ? "w-5 bg-zinc-800" : "w-1.5 bg-zinc-200",
                  )}
                />
              ))}
            </div>
          </header>

          <section
            aria-label="Controles de reprodução"
            className="mx-3 shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="relative mt-0.5 size-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 disabled:opacity-50"
                disabled={!preferredAudio || refreshing}
                aria-label={`${playing ? "Pausar" : "Reproduzir"} ${song.name}`}
                onClick={() =>
                  currentAudio ? onTogglePlayback() : preferredAudio && onPlay(preferredAudio.id)
                }
              >
                {artworkUrl && !artworkFailed ? (
                  <img
                    src={artworkUrl}
                    alt=""
                    className="size-full object-cover"
                    onError={() => setArtworkFailed(true)}
                  />
                ) : (
                  <Music2 aria-hidden="true" className="m-auto size-9 text-zinc-300" />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-11 place-items-center rounded-full bg-zinc-900 text-white shadow-sm">
                    {refreshing ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-5 animate-spin motion-reduce:animate-none"
                      />
                    ) : playing ? (
                      <Pause aria-hidden="true" className="size-5 fill-current" />
                    ) : (
                      <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
                    )}
                  </span>
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm font-bold leading-5">{song.name}</DialogTitle>
                <p className="mt-0.5 text-xs text-zinc-500">{song.liturgicalType}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                  {song.audios.map((audio) => {
                    const style = voiceStyles[audio.voicePart];
                    const active = audio.id === activeAudioId;
                    const label = audio.voicePart === "todos" ? "4 Vozes" : style.label;
                    return (
                      <div key={audio.id} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label={`${active && isPlaying ? "Pausar" : "Tocar"} ${label}`}
                          title={audio.title}
                          disabled={active && refreshing}
                          onClick={() => (active ? onTogglePlayback() : onPlay(audio.id))}
                          className={cn(
                            "grid size-11 place-items-center rounded-full border transition-colors",
                            style.border,
                            style.text,
                            style.hoverBg,
                            active ? `${style.bg} ring-1 ring-current` : "bg-white",
                          )}
                        >
                          {active && refreshing ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-4 animate-spin motion-reduce:animate-none"
                            />
                          ) : active && isPlaying ? (
                            <Pause aria-hidden="true" className="size-4 fill-current" />
                          ) : (
                            <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                          )}
                        </button>
                        <span className={cn("text-[10px] font-semibold", style.text)}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums text-zinc-500">
              <span>{formatTime(position)}</span>
              <input
                type="range"
                min={0}
                max={total}
                step={0.1}
                value={position}
                disabled={total <= 0 || refreshing}
                aria-label="Progresso do áudio"
                className="min-h-11 min-w-0 flex-1 cursor-pointer accent-zinc-800 disabled:opacity-40"
                onChange={(e) => onSeek(Number(e.currentTarget.value))}
              />
              <span>{formatTime(total)}</span>
            </div>
            {song.audios.length === 0 && (
              <p className="text-xs text-zinc-500">Este canto ainda não possui áudio publicado.</p>
            )}
            {currentAudio && playerStatus === "error" && (
              <p role="alert" className="text-xs text-red-700">
                Não foi possível reproduzir este áudio. Tente novamente.
              </p>
            )}
            {refreshing && (
              <p role="status" className="text-xs text-zinc-500">
                Atualizando áudio…
              </p>
            )}
            {currentAudio && playerStatus === "ended" && (
              <p role="status" className="text-xs text-zinc-500">
                Concluído
              </p>
            )}
          </section>

          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <TabsList
              aria-label="Conteúdo da música"
              className="grid h-auto shrink-0 grid-cols-3 border border-zinc-200 bg-zinc-50 p-1"
            >
              {contentTabs.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="min-h-11 text-xs data-[state=active]:bg-white data-[state=active]:text-zinc-950"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="lyrics" className="min-h-0 flex-1 overflow-y-auto px-1 py-3">
              {song.lyrics ? (
                <p className="whitespace-pre-wrap break-words text-base leading-8">{song.lyrics}</p>
              ) : (
                <p className="py-8 text-center text-sm text-zinc-500">Letra não disponível.</p>
              )}
            </TabsContent>
            <TabsContent value="sheet" className="min-h-0 flex-1 overflow-y-auto py-2">
              {song.sheetMusic[0] ? (
                <ChoristerScoresTab
                  event={event}
                  initialAsset={song.sheetMusic[0]}
                  onOpen={onOpenScore}
                  onDownload={onDownloadScore}
                  viewerOnly
                />
              ) : (
                <p className="py-8 text-center text-sm text-zinc-500">Partitura não disponível.</p>
              )}
            </TabsContent>
            <TabsContent value="chords" className="min-h-0 flex-1 overflow-y-auto px-1 py-3">
              {song.chords ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7">
                  {song.chords}
                </pre>
              ) : (
                <p className="py-8 text-center text-sm text-zinc-500">Cifra não disponível.</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
