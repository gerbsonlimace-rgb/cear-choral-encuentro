import { FileText, Home, Music2, Pause, Play, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  ChoristerTab,
  ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";

import { ChoristerHomeTab } from "./ChoristerHomeTab";
import { ChoristerSongsTab } from "./ChoristerSongsTab";
import type { ParticipantRegistrationView } from "./participant.domain";

export type ChoristerAppShellProps = {
  participant: ParticipantRegistrationView;
  feed: ChoristerPortalFeed;
  onChangePassword: () => void;
  onDownloadReceipt: () => void;
  onLogout: () => void;
  onPlay: (audioId: string) => void;
  onOpenSong: (songId: string) => void;
  onOpenScore: (assetId: string) => void;
  initialTab?: ChoristerTab;
  onTabChange?: (tab: ChoristerTab) => void;
};

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "cantos", label: "Cantos", icon: Music2 },
  { id: "partituras", label: "Partituras", icon: FileText },
  { id: "perfil", label: "Meu Perfil", icon: UserRound },
] as const satisfies ReadonlyArray<{ id: ChoristerTab; label: string; icon: typeof Home }>;

const playerVoiceLabels = {
  principal: "Principal",
  soprano: "Soprano",
  contralto: "Contralto",
  tenor: "Tenor",
  baixo: "Baixo",
  todos: "Todos",
} as const;

function isIntentionalPlaybackCancellation(error: unknown) {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

export function ChoristerAppShell({
  participant,
  feed,
  onChangePassword: _onChangePassword,
  onDownloadReceipt: _onDownloadReceipt,
  onLogout: _onLogout,
  onPlay,
  onOpenSong,
  onOpenScore,
  initialTab = "home",
  onTabChange,
}: ChoristerAppShellProps) {
  const [selectedTab, setSelectedTab] = useState<ChoristerTab>(initialTab);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<"ready" | "ended" | "error">("ready");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackGenerationRef = useRef(0);
  const audioById = useMemo(
    () =>
      new Map(
        feed.event.songs.flatMap((song) =>
          song.audios.map((audio) => [audio.id, { audio, song }] as const),
        ),
      ),
    [feed.event.songs],
  );
  const selectedAudio = selectedAudioId ? audioById.get(selectedAudioId) : undefined;

  useEffect(() => {
    playbackGenerationRef.current += 1;
    return () => {
      playbackGenerationRef.current += 1;
    };
  }, [selectedAudio?.audio.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isPlaying) {
      audio.pause();
      return;
    }

    const generation = playbackGenerationRef.current;
    void audio.play().catch((error: unknown) => {
      if (
        generation !== playbackGenerationRef.current ||
        isIntentionalPlaybackCancellation(error)
      ) {
        return;
      }
      setIsPlaying(false);
      setPlayerStatus("error");
    });
  }, [isPlaying, selectedAudio?.audio.id]);

  function selectTab(tab: ChoristerTab) {
    setSelectedTab(tab);
    onTabChange?.(tab);
  }

  function handlePlay(audioId: string) {
    if (selectedAudioId !== audioId) {
      const previousAudio = audioRef.current;
      if (previousAudio) {
        previousAudio.pause();
        previousAudio.removeAttribute("src");
        previousAudio.load();
      }
      setSelectedAudioId(audioId);
    }
    setIsPlaying(true);
    setPlayerStatus("ready");
    onPlay(audioId);
  }

  return (
    <div className="min-h-svh bg-[#f9f7f2] text-zinc-950">
      <div className="mx-auto min-h-svh max-w-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-amber-200 bg-zinc-950 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-amber-300 uppercase">
              II Encontro de Coros
            </p>
            <p className="mt-1 text-sm text-zinc-300">Área do coralista</p>
          </div>
          <span className="rounded-full border border-amber-300/50 px-3 py-1 text-xs font-semibold text-amber-200">
            {feed.event.location ?? "Encontro"}
          </span>
        </header>

        <main className="px-4 pt-5 pb-[calc(8.75rem+env(safe-area-inset-bottom))] sm:px-6">
          {selectedTab === "home" && (
            <ChoristerHomeTab
              participant={participant}
              event={feed.event}
              onOpenSongs={() => selectTab("cantos")}
              onOpenScores={() => selectTab("partituras")}
            />
          )}
          {selectedTab === "cantos" && (
            <ChoristerSongsTab
              songs={feed.event.songs}
              onPlay={handlePlay}
              onOpenSong={onOpenSong}
              onOpenScore={onOpenScore}
            />
          )}
          {selectedTab === "partituras" && (
            <section
              aria-labelledby="scores-pending-title"
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <h1 id="scores-pending-title" className="font-display text-xl font-semibold">
                Partituras
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                As partituras do repertório estarão disponíveis aqui.
              </p>
            </section>
          )}
          {selectedTab === "perfil" && (
            <section
              aria-labelledby="profile-pending-title"
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <h1 id="profile-pending-title" className="font-display text-xl font-semibold">
                Meu Perfil
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                Seus dados de inscrição estarão disponíveis aqui.
              </p>
            </section>
          )}
        </main>

        {selectedAudio && (
          <section
            aria-label="Player persistente"
            className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-10 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-amber-300 bg-zinc-950 p-3 text-white shadow-xl sm:right-6 sm:left-6"
          >
            <audio
              ref={audioRef}
              aria-label="Reprodutor de áudio"
              src={selectedAudio.audio.signedUrl}
              preload="metadata"
              onEnded={() => {
                setIsPlaying(false);
                setPlayerStatus("ended");
              }}
              onError={() => {
                setIsPlaying(false);
                setPlayerStatus("error");
              }}
            />
            <Button
              type="button"
              size="icon"
              className="min-h-11 min-w-11 rounded-full bg-amber-400 text-zinc-950 hover:bg-amber-300"
              aria-label={
                isPlaying
                  ? `Pausar ${selectedAudio.song.name}`
                  : `Reproduzir ${selectedAudio.song.name}`
              }
              onClick={() => setIsPlaying((playing) => !playing)}
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="size-4 fill-current" />
              ) : (
                <Play aria-hidden="true" className="size-4 fill-current" />
              )}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selectedAudio.song.name}</p>
              <p className="truncate text-xs text-zinc-300">
                {selectedAudio.audio.title} · {playerVoiceLabels[selectedAudio.audio.voicePart]}
              </p>
            </div>
            {playerStatus === "error" ? (
              <p role="alert" className="text-right text-xs text-amber-200">
                Não foi possível reproduzir este áudio. Tente novamente.
              </p>
            ) : (
              <span className="text-xs text-amber-200">
                {playerStatus === "ended" ? "Concluído" : isPlaying ? "Reproduzindo" : "Pronto"}
              </span>
            )}
          </section>
        )}

        <nav
          aria-label="Navegação principal do app"
          className="fixed right-0 bottom-0 left-0 z-20 mx-auto flex max-w-2xl border-t border-amber-200 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(24,24,27,0.08)]"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectTab(tab.id)}
                className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold text-zinc-600 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 aria-[current=page]:bg-zinc-950 aria-[current=page]:text-amber-200"
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
