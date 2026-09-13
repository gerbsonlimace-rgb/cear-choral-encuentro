import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileMusic,
  Files,
  Home,
  MapPin,
  Music2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { isSignedUrlExpired } from "@/features/chorister-app/choristerApp.domain";
import type {
  ChoristerPortalCollection,
  ChoristerTab,
  ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";
import { cn } from "@/lib/utils";

import { ChoristerEventGuideTab, type ParticipantGuideActivity } from "./ChoristerEventGuideTab";
import { ChoristerHomeTab } from "./ChoristerHomeTab";
import { ChoristerProfileTab } from "./ChoristerProfileTab";
import { ChoristerSongsTab } from "./ChoristerSongsTab";
import { ChoristerSongPlayer } from "./ChoristerSongPlayer";
import { ChoristerScoresTab, type PdfAsset, type PdfAssetAction } from "./ChoristerScoresTab";
import type { ParticipantRegistrationView } from "./participant.domain";

type AudioAsset = ChoristerPortalFeed["event"]["songs"][number]["audios"][number];

export type ChoristerAppShellProps = {
  participant: ParticipantRegistrationView;
  feed: ChoristerPortalFeed;
  events?: ChoristerPortalCollection["events"];
  onChangePassword: () => void;
  onDownloadReceipt: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  onPlay: (audioId: string) => void;
  onOpenSong: (songId: string) => void;
  onOpenScore: PdfAssetAction;
  onDownloadScore: PdfAssetAction;
  onRenewAudio?: (audioId: string) => Promise<AudioAsset | undefined>;
  contentStatus?: "ready" | "not_published" | "unavailable";
  onRetryContent?: () => void;
  initialTab?: ChoristerTab;
  onTabChange?: (tab: ChoristerTab) => void;
  initialEventId?: string;
  onEventChange?: (eventId: string | null) => void;
  loadGuideActivities?: () => Promise<ParticipantGuideActivity[]>;
};

const loadPublishedGuideOnly = async (): Promise<ParticipantGuideActivity[]> => [];

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "guia", label: "Programação", icon: CalendarDays },
  { id: "cantos", label: "Kit Ensaio", icon: Music2 },
  { id: "documentos", label: "Documentos", icon: Files },
  { id: "perfil", label: "Meu Perfil", icon: UserRound },
] as const satisfies ReadonlyArray<{ id: ChoristerTab; label: string; icon: typeof Home }>;

function isIntentionalPlaybackCancellation(error: unknown) {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

const eventDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ChoristerAppShell({
  participant,
  feed,
  events,
  onChangePassword: _onChangePassword,
  onDownloadReceipt: _onDownloadReceipt,
  onLogout: _onLogout,
  onOpenAdmin,
  onPlay,
  onOpenSong,
  onOpenScore,
  onDownloadScore,
  onRenewAudio,
  contentStatus = "ready",
  onRetryContent,
  initialTab = "home",
  onTabChange,
  initialEventId,
  onEventChange,
  loadGuideActivities,
}: ChoristerAppShellProps) {
  const [portalFeed, setPortalFeed] = useState<ChoristerPortalFeed | null>(feed);
  const [portalEvents, setPortalEvents] = useState<ChoristerPortalCollection["events"]>(
    events ?? [feed.event],
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId ?? null);
  const [leaving, setLeaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ChoristerTab>(initialTab);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [requestedScoreAsset, setRequestedScoreAsset] = useState<PdfAsset | null>(null);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, AudioAsset>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<"ready" | "refreshing" | "ended" | "error">(
    "ready",
  );
  const [playAttempt, setPlayAttempt] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackGenerationRef = useRef(0);
  const audioActionRef = useRef(0);
  const audioRecoveryIdsRef = useRef(new Set<string>());
  const pendingAudioPositionRef = useRef<number | null>(null);
  const guideActivitiesPromiseRef = useRef<Promise<ParticipantGuideActivity[]> | null>(null);
  const guideActivitiesLoader = loadGuideActivities ?? loadPublishedGuideOnly;
  const loadGuideActivitiesOnce = useCallback(() => {
    if (!guideActivitiesPromiseRef.current) {
      guideActivitiesPromiseRef.current = guideActivitiesLoader();
    }
    return guideActivitiesPromiseRef.current;
  }, [guideActivitiesLoader]);

  useEffect(() => {
    void loadGuideActivitiesOnce().catch(() => undefined);
  }, [loadGuideActivitiesOnce]);

  useEffect(() => {
    if (!leaving) {
      setPortalFeed(feed);
      const nextEvents = events ?? [feed.event];
      setPortalEvents(nextEvents);
      setSelectedEventId((current) =>
        current && nextEvents.some((event) => event.id === current) ? current : null,
      );
    }
  }, [events, feed, leaving]);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSelectedEventId(initialEventId ?? null);
  }, [initialEventId]);

  const audioById = useMemo(
    () =>
      new Map(
        portalEvents.flatMap((event) =>
          event.songs.flatMap((song) =>
            song.audios.map(
              (audio) => [audio.id, { audio: audioOverrides[audio.id] ?? audio, song }] as const,
            ),
          ),
        ),
      ),
    [audioOverrides, portalEvents],
  );
  const selectedAudio = selectedAudioId ? audioById.get(selectedAudioId) : undefined;
  const selectedAudioEventId = selectedAudioId
    ? portalEvents.find((event) =>
        event.songs.some((song) => song.audios.some((audio) => audio.id === selectedAudioId)),
      )?.id
    : undefined;
  const selectedSong = selectedSongId
    ? portalEvents.flatMap((event) => event.songs).find((song) => song.id === selectedSongId)
    : undefined;
  const selectedEvent = selectedEventId
    ? portalEvents.find((event) => event.id === selectedEventId)
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
    if (tab !== "documentos") setRequestedScoreAsset(null);
    if (tab !== "cantos") {
      setSelectedEventId(null);
    } else if (portalEvents.length === 1) {
      setSelectedEventId(portalEvents[0].id);
      onEventChange?.(portalEvents[0].id);
    }
    setSelectedTab(tab);
    onTabChange?.(tab);
  }

  function openEvent(eventId: string) {
    setSelectedSongId(null);
    setRequestedScoreAsset(null);
    setSelectedEventId(eventId);
    setSelectedTab("cantos");
    onTabChange?.("cantos");
    onEventChange?.(eventId);
  }

  function closeEvent() {
    setSelectedSongId(null);
    setRequestedScoreAsset(null);
    setSelectedEventId(null);
    onEventChange?.(null);
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
    const asset = portalEvents
      .flatMap((event) => event.songs)
      .flatMap((song) => song.sheetMusic)
      .find((score) => score.id === assetId);
    if (asset) {
      const assetEvent = portalEvents.find(
        (event) =>
          event.documents.some((document) => document.id === assetId) ||
          event.songs.some((song) => song.sheetMusic.some((score) => score.id === assetId)),
      );
      if (assetEvent) onEventChange?.(null);
      setRequestedScoreAsset(asset);
      setSelectedTab("documentos");
      onTabChange?.("documentos");
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
      <main className="chorister-app flex min-h-svh items-center justify-center bg-white px-4 text-sm text-zinc-600">
        Saindo…
      </main>
    );
  }

  return (
    <div className="chorister-app min-h-svh bg-white font-body text-zinc-950">
      <div className="mx-auto min-h-svh max-w-6xl bg-white">
        <nav
          aria-label="Navegação principal do app"
          className="fixed right-0 bottom-0 left-0 z-20 mx-auto flex max-w-6xl border-t border-zinc-200 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:justify-center md:gap-2 md:border-t-0 md:border-b md:px-4 md:py-3"
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
                className={cn(
                  "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 sm:text-xs md:min-h-11 md:w-36 md:flex-none md:flex-row md:gap-2 md:px-3 md:text-sm",
                  active
                    ? "bg-zinc-100 font-semibold text-zinc-950"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                )}
              >
                <Icon aria-hidden="true" className="size-5 md:size-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <main className="mx-auto w-full max-w-4xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-12">
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
              onNavigate={selectTab}
              recentPlayback={
                selectedAudio
                  ? {
                      songName: selectedAudio.song.name,
                      audioTitle: selectedAudio.audio.title,
                    }
                  : undefined
              }
              onContinuePlayback={
                selectedAudio && selectedAudioEventId
                  ? () => {
                      openEvent(selectedAudioEventId);
                      if (!isPlaying) void handlePlay(selectedAudio.audio.id);
                    }
                  : undefined
              }
            />
          )}
          {selectedTab === "cantos" && (
            <section aria-labelledby="event-repertoire-title" className="space-y-5">
              {!selectedEvent ? (
                <>
                  <header className="space-y-1 border-b border-zinc-200 pb-4">
                    <p className="text-sm font-medium text-zinc-500">Biblioteca do encontro</p>
                    <h1
                      id="event-repertoire-title"
                      className="text-2xl font-semibold tracking-tight"
                    >
                      Cantos
                    </h1>
                    <p className="text-sm text-zinc-600">
                      Escolha uma celebração para abrir o repertório publicado.
                    </p>
                  </header>
                  <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                    {portalEvents.map((event) => {
                      const audioCount = event.songs.reduce(
                        (total, song) => total + song.audios.length,
                        0,
                      );
                      const scoreCount = event.songs.reduce(
                        (total, song) => total + song.sheetMusic.length,
                        event.documents.length,
                      );
                      return (
                        <button
                          key={event.id}
                          type="button"
                          aria-label={`Abrir evento ${event.name}`}
                          onClick={() => openEvent(event.id)}
                          className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 md:aspect-auto"
                        >
                          {event.coverImageUrl ? (
                            <img
                              src={event.coverImageUrl}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 size-full object-cover md:static md:h-24 md:w-full"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500 md:static md:h-10"
                            />
                          )}
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent md:hidden"
                          />
                          <div className="absolute inset-x-0 bottom-0 z-10 flex w-full items-end justify-between gap-2 p-3 text-white md:static md:items-start md:gap-3 md:px-4 md:pt-3 md:pb-0 md:text-zinc-950">
                            <div className="min-w-0">
                              <p className="hidden text-xs font-semibold tracking-wide text-zinc-500 uppercase md:block">
                                Celebração
                              </p>
                              <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-white md:mt-1 md:text-base md:text-zinc-950">
                                {event.name}
                              </h2>
                              <p className="mt-1 flex items-center gap-1 text-[11px] leading-none text-zinc-200 md:hidden">
                                <CalendarDays className="size-3" />
                                {eventDateFormatter.format(new Date(`${event.date}T12:00:00.000Z`))}
                              </p>
                            </div>
                            <ChevronRight className="mb-0.5 size-4 shrink-0 text-white transition-transform group-hover:translate-x-0.5 md:mt-1 md:mb-0 md:size-5 md:text-zinc-400" />
                          </div>
                          <div className="hidden w-full space-y-2 px-4 pt-3 pb-4 text-xs text-zinc-600 md:block">
                            <p className="flex items-center gap-2">
                              <CalendarDays className="size-4" />
                              {eventDateFormatter.format(new Date(`${event.date}T12:00:00.000Z`))}
                            </p>
                            <p className="flex items-center gap-2">
                              <MapPin className="size-4" />
                              <span className="truncate">
                                {event.location ?? "Local não publicado"}
                              </span>
                            </p>
                            <p className="flex items-center gap-2 font-medium text-zinc-800">
                              <FileMusic className="size-4" />
                              {audioCount} {audioCount === 1 ? "áudio" : "áudios"} ·{" "}
                              {event.songs.length} {event.songs.length === 1 ? "canto" : "cantos"} ·{" "}
                              {scoreCount} {scoreCount === 1 ? "partitura" : "partituras"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <header className="border-b border-zinc-200 pb-3">
                    <button
                      type="button"
                      onClick={closeEvent}
                      className="flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-medium text-zinc-500 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                    >
                      <ArrowLeft className="size-4" />
                      Voltar aos eventos
                    </button>
                    <div className="flex items-center gap-3">
                      {selectedEvent.coverImageUrl ? (
                        <img
                          src={selectedEvent.coverImageUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-lg border border-zinc-200 object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <h1
                          id="event-repertoire-title"
                          className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl"
                        >
                          {selectedEvent.name}
                        </h1>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {eventDateFormatter.format(
                            new Date(`${selectedEvent.date}T12:00:00.000Z`),
                          )}{" "}
                          · {selectedEvent.location ?? "Local não publicado"}
                        </p>
                      </div>
                    </div>
                  </header>
                  <ChoristerSongsTab
                    songs={selectedEvent.songs}
                    headingId={`chorister-songs-${selectedEvent.id}`}
                    eventName={selectedEvent.name}
                    initialVoicePart={participant.registration.voicePart}
                    onPlay={(audioId) => void handlePlay(audioId)}
                    onOpenSong={openSongFromSongs}
                    onOpenScore={openScoreFromSong}
                    activeAudioId={selectedAudio?.audio.id}
                    isPlaying={isPlaying}
                    playerStatus={playerStatus}
                    currentTime={currentTime}
                    duration={duration}
                    onTogglePlayback={togglePlayback}
                    onSeek={(nextTime) => {
                      if (!Number.isFinite(nextTime)) return;
                      if (audioRef.current) audioRef.current.currentTime = nextTime;
                      setCurrentTime(nextTime);
                    }}
                    onVoiceChange={() => setIsPlaying(false)}
                  />
                </>
              )}
              {selectedSong && selectedEvent && (
                <ChoristerSongPlayer
                  key={selectedSong.id}
                  song={selectedSong}
                  event={selectedEvent}
                  artworkUrl={selectedEvent.coverImageUrl}
                  initialVoicePart={participant.registration.voicePart}
                  activeAudioId={selectedAudio?.audio.id}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  playerStatus={playerStatus}
                  onClose={() => setSelectedSongId(null)}
                  onPlay={(audioId) => void handlePlay(audioId)}
                  onTogglePlayback={togglePlayback}
                  onSeek={(seconds) => {
                    if (!Number.isFinite(seconds)) return;
                    if (audioRef.current) audioRef.current.currentTime = seconds;
                    setCurrentTime(seconds);
                  }}
                  onOpenScore={onOpenScore}
                  onDownloadScore={onDownloadScore}
                />
              )}
            </section>
          )}
          {selectedTab === "documentos" && (
            <section aria-labelledby="documents-title" className="space-y-5">
              <header className="border-b border-zinc-200 pb-3">
                <h1 id="documents-title" className="text-2xl font-semibold tracking-tight">
                  Documentos
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Guias, livros e materiais gerais publicados por evento.
                </p>
              </header>
              {portalEvents.map((event) => {
                const requestedSongScoreBelongsToEvent = requestedScoreAsset
                  ? event.songs.some((song) =>
                      song.sheetMusic.some((score) => score.id === requestedScoreAsset.id),
                    )
                  : false;
                const assetIds = new Set(event.documents.map((document) => document.id));
                if (assetIds.size === 0 && !requestedSongScoreBelongsToEvent) return null;
                return (
                  <section
                    key={event.id}
                    aria-labelledby={`documents-event-${event.id}`}
                    className="space-y-3"
                  >
                    <div>
                      <h2
                        id={`documents-event-${event.id}`}
                        className="text-base font-semibold text-zinc-950"
                      >
                        {event.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {eventDateFormatter.format(new Date(`${event.date}T12:00:00.000Z`))}
                      </p>
                    </div>
                    <ChoristerScoresTab
                      event={event}
                      headingId={`chorister-scores-${event.id}`}
                      onOpen={onOpenScore}
                      onDownload={onDownloadScore}
                      initialAsset={
                        requestedScoreAsset &&
                        (assetIds.has(requestedScoreAsset.id) || requestedSongScoreBelongsToEvent)
                          ? requestedScoreAsset
                          : null
                      }
                      showSongScores={false}
                    />
                  </section>
                );
              })}
              {portalEvents.every((event) => event.documents.length === 0) &&
              !requestedScoreAsset ? (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
                  Nenhum documento geral foi publicado ainda.
                </p>
              ) : null}
            </section>
          )}
          {selectedTab === "guia" && (
            <ChoristerEventGuideTab
              events={portalEvents}
              loadActivities={loadGuideActivitiesOnce}
            />
          )}
          {selectedTab === "perfil" && (
            <ChoristerProfileTab
              participant={participant}
              onChangePassword={_onChangePassword}
              onDownloadReceipt={() => _onDownloadReceipt()}
              onLogout={handleLogout}
              onOpenAdmin={onOpenAdmin}
            />
          )}
        </main>

        {selectedAudio && (
          <audio
            ref={audioRef}
            aria-label="Reprodutor de áudio"
            className="hidden"
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
        )}
      </div>
    </div>
  );
}
