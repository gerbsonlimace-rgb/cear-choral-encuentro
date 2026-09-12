import { FileText, Home, Music2, Pause, Play, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  isSignedUrlExpired,
} from "@/features/chorister-app/choristerApp.domain";
import type {
  ChoristerTab,
  ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";

import { ChoristerHomeTab } from "./ChoristerHomeTab";
import { ChoristerProfileTab } from "./ChoristerProfileTab";
import { ChoristerSongsTab } from "./ChoristerSongsTab";
import { ChoristerScoresTab, type PdfAsset, type PdfAssetAction } from "./ChoristerScoresTab";
import type { ParticipantRegistrationView } from "./participant.domain";

type AudioAsset = ChoristerPortalFeed["event"]["songs"][number]["audios"][number];

export type ChoristerAppShellProps = {
  participant: ParticipantRegistrationView;
  feed: ChoristerPortalFeed;
  onChangePassword: () => void;
  onDownloadReceipt: () => void;
  onLogout: () => void;
  onPlay: (audioId: string) => void;
  onOpenSong: (songId: string) => void;
  onOpenScore: PdfAssetAction;
  onDownloadScore: PdfAssetAction;
  onRenewAudio?: (audioId: string) => Promise<AudioAsset | undefined>;
  contentStatus?: "ready" | "not_published" | "unavailable";
  onRetryContent?: () => void;
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

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
  onDownloadScore,
  onRenewAudio,
  contentStatus = "ready",
  onRetryContent,
  initialTab = "home",
  onTabChange,
}: ChoristerAppShellProps) {
  const [portalFeed, setPortalFeed] = useState<ChoristerPortalFeed | null>(feed);
  const [leaving, setLeaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ChoristerTab>(initialTab);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [requestedScoreAsset, setRequestedScoreAsset] = useState<PdfAsset | null>(null);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, AudioAsset>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<
    "ready" | "refreshing" | "ended" | "error"
  >("ready");
  const [playAttempt, setPlayAttempt] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackGenerationRef = useRef(0);
  const audioActionRef = useRef(0);
  const audioRecoveryIdsRef = useRef(new Set<string>());
  const pendingAudioPositionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!leaving) setPortalFeed(feed);
  }, [feed, leaving]);

  const audioById = useMemo(
    () =>
      new Map(
        (portalFeed?.event.songs ?? []).flatMap((song) =>
          song.audios.map((audio) => [
            audio.id,
            { audio: audioOverrides[audio.id] ?? audio, song },
          ] as const),
        ),
      ),
    [audioOverrides, portalFeed],
  );
  const selectedAudio = selectedAudioId ? audioById.get(selectedAudioId) : undefined;
  const selectedSong = selectedSongId
    ? portalFeed?.event.songs.find((song) => song.id === selectedSongId)
    : undefined;

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
  }, [isPlaying, playAttempt, selectedAudio?.audio.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || pendingAudioPositionRef.current === null) return;

    const applyPendingPosition = () => {
      const position = pendingAudioPositionRef.current;
      if (position === null) return;
      const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : position;
      audio.currentTime = Math.min(position, max);
      pendingAudioPositionRef.current = null;
      setCurrentTime(audio.currentTime);
    };

    applyPendingPosition();
    audio.addEventListener("loadedmetadata", applyPendingPosition);
    return () => audio.removeEventListener("loadedmetadata", applyPendingPosition);
  }, [selectedAudio?.audio.signedUrl]);

  function selectTab(tab: ChoristerTab) {
    if (tab !== "partituras") setRequestedScoreAsset(null);
    setSelectedTab(tab);
    onTabChange?.(tab);
  }

  async function handlePlay(audioId: string) {
    const lookup = audioById.get(audioId);
    if (!lookup) return;

    const action = ++audioActionRef.current;
    playbackGenerationRef.current += 1;
    if (selectedAudioId !== audioId) {
      const previousAudio = audioRef.current;
      if (previousAudio) {
        previousAudio.pause();
        previousAudio.removeAttribute("src");
        previousAudio.load();
      }
      // A failed previous track may have queued a resume position. Never
      // apply that position to a newly selected track.
      pendingAudioPositionRef.current = null;
      setSelectedAudioId(audioId);
      setCurrentTime(0);
      setDuration(0);
    }

    audioRecoveryIdsRef.current.clear();
    const expired = isSignedUrlExpired(lookup.audio.expiresAt);
    setIsPlaying(false);
    setPlayerStatus(expired ? "refreshing" : "ready");

    if (expired) {
      if (!onRenewAudio) {
        setPlayerStatus("error");
        return;
      }
      const refreshed = await onRenewAudio(audioId).catch(() => undefined);
      if (action !== audioActionRef.current) return;
      if (!refreshed || isSignedUrlExpired(refreshed.expiresAt)) {
        setPlayerStatus("error");
        return;
      }
      setAudioOverrides((current) => ({ ...current, [audioId]: refreshed }));
    }

    if (action !== audioActionRef.current) return;
    setPlayAttempt((attempt) => attempt + 1);
    setIsPlaying(true);
    setPlayerStatus("ready");
    onPlay(audioId);
  }

  function togglePlayback() {
    if (isPlaying) {
      playbackGenerationRef.current += 1;
      setIsPlaying(false);
      return;
    }

    if (selectedAudio && isSignedUrlExpired(selectedAudio.audio.expiresAt)) {
      void handlePlay(selectedAudio.audio.id);
      return;
    }

    playbackGenerationRef.current += 1;
    setPlayAttempt((attempt) => attempt + 1);
    setIsPlaying(true);
    setPlayerStatus("ready");
  }

  function handleLogout() {
    audioActionRef.current += 1;
    playbackGenerationRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    flushSync(() => {
      setSelectedAudioId(null);
      setSelectedSongId(null);
      setRequestedScoreAsset(null);
      setIsPlaying(false);
      setPortalFeed(null);
      setLeaving(true);
    });
    _onLogout();
  }

  function openScoreFromSong(assetId: string) {
    const asset = portalFeed?.event.songs
      .flatMap((song) => song.sheetMusic)
      .find((score) => score.id === assetId);
    if (asset) {
      setRequestedScoreAsset(asset);
      selectTab("partituras");
    }
  }

  function openSongFromSongs(songId: string) {
    setSelectedSongId(songId);
    onOpenSong(songId);
  }

  async function recoverAudioAfterError() {
    const selected = selectedAudio;
    if (!selected) return;

    const audio = audioRef.current;
    const position = audio?.currentTime ?? 0;
    if (!onRenewAudio || audioRecoveryIdsRef.current.has(selected.audio.id)) {
      playbackGenerationRef.current += 1;
      setIsPlaying(false);
      setPlayerStatus("error");
      return;
    }

    audioRecoveryIdsRef.current.add(selected.audio.id);
    const action = ++audioActionRef.current;
    pendingAudioPositionRef.current = position;
    setIsPlaying(false);
    setPlayerStatus("refreshing");
    const refreshed = await onRenewAudio(selected.audio.id).catch(() => undefined);
    if (action !== audioActionRef.current) return;
    if (!refreshed || isSignedUrlExpired(refreshed.expiresAt)) {
      setPlayerStatus("error");
      return;
    }
    setAudioOverrides((current) => ({ ...current, [selected.audio.id]: refreshed }));
    setPlayAttempt((attempt) => attempt + 1);
    setIsPlaying(true);
    setPlayerStatus("ready");
    onPlay(selected.audio.id);
  }

  if (leaving || !portalFeed) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f9f7f2] px-4 text-sm text-zinc-600">
        Saindo…
      </main>
    );
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
            {portalFeed.event.location ?? "Encontro"}
          </span>
        </header>

        <main className="px-4 pt-5 pb-[calc(8.75rem+env(safe-area-inset-bottom))] sm:px-6">
          {contentStatus !== "ready" && (
            <aside
              role={contentStatus === "unavailable" ? "alert" : undefined}
              className="mb-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-zinc-800"
            >
              <p>
                {contentStatus === "not_published"
                  ? "Os materiais do encontro ainda não foram publicados."
                  : "Não foi possível carregar os materiais do encontro. Tente novamente."}
              </p>
              {contentStatus === "unavailable" && onRetryContent && (
                <Button type="button" size="sm" className="min-h-11" onClick={onRetryContent}>
                  Tentar novamente
                </Button>
              )}
            </aside>
          )}
          {selectedTab === "home" && (
            <ChoristerHomeTab
              participant={participant}
              event={portalFeed.event}
              onOpenSongs={() => selectTab("cantos")}
              onOpenScores={() => selectTab("partituras")}
            />
          )}
          {selectedTab === "cantos" && (
            <>
              <ChoristerSongsTab
                songs={portalFeed.event.songs}
                onPlay={(audioId) => void handlePlay(audioId)}
                onOpenSong={openSongFromSongs}
                onOpenScore={openScoreFromSong}
              />
              {selectedSong && (
                <section
                  aria-label={`Detalhe do canto ${selectedSong.name}`}
                  className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
                        {selectedSong.liturgicalType}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-semibold text-zinc-950">
                        {selectedSong.name}
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 shrink-0 px-3"
                      aria-label="Fechar detalhe"
                      onClick={() => setSelectedSongId(null)}
                    >
                      Fechar
                    </Button>
                  </div>
                  {selectedSong.lyrics ? (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">Letra</h3>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-800">
                        {selectedSong.lyrics}
                      </pre>
                    </div>
                  ) : null}
                  {selectedSong.chords ? (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">Cifra</h3>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-zinc-800">
                        {selectedSong.chords}
                      </pre>
                    </div>
                  ) : null}
                  {!selectedSong.lyrics && !selectedSong.chords && (
                    <p className="text-sm text-zinc-700">Este canto ainda não possui letra ou cifra publicada.</p>
                  )}
                </section>
              )}
            </>
          )}
          {selectedTab === "partituras" && (
            <ChoristerScoresTab
              event={portalFeed.event}
              onOpen={onOpenScore}
              onDownload={onDownloadScore}
              initialAsset={requestedScoreAsset}
            />
          )}
          {selectedTab === "perfil" && (
            <ChoristerProfileTab
              participant={participant}
              onChangePassword={_onChangePassword}
              onDownloadReceipt={() => _onDownloadReceipt()}
              onLogout={handleLogout}
            />
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
                playbackGenerationRef.current += 1;
                setIsPlaying(false);
                setPlayerStatus("ended");
              }}
              onError={() => void recoverAudioAfterError()}
              onLoadedMetadata={(event) => {
                const nextDuration = Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration
                  : 0;
                setDuration(nextDuration);
                if (pendingAudioPositionRef.current !== null) {
                  const position = pendingAudioPositionRef.current;
                  event.currentTarget.currentTime = Math.min(
                    position,
                    nextDuration > 0 ? nextDuration : position,
                  );
                  pendingAudioPositionRef.current = null;
                  setCurrentTime(event.currentTarget.currentTime);
                }
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
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
              onClick={togglePlayback}
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
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 0}
                step="1"
                value={duration > 0 ? Math.min(currentTime, duration) : 0}
                disabled={duration <= 0}
                aria-label="Progresso do áudio"
                className="mt-1 min-h-11 w-full accent-amber-400 disabled:opacity-50"
                onChange={(event) => {
                  const nextTime = Number(event.currentTarget.value);
                  if (!Number.isFinite(nextTime)) return;
                  if (audioRef.current) audioRef.current.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
              />
              <div className="flex justify-between text-[11px] text-zinc-400" aria-hidden="true">
                <span>{formatAudioTime(currentTime)}</span>
                <span>{formatAudioTime(duration)}</span>
              </div>
            </div>
            {playerStatus === "error" ? (
              <p role="alert" className="text-right text-xs text-amber-200">
                Não foi possível reproduzir este áudio. Tente novamente.
              </p>
            ) : playerStatus === "refreshing" ? (
              <span className="text-right text-xs text-amber-200">Atualizando áudio…</span>
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
