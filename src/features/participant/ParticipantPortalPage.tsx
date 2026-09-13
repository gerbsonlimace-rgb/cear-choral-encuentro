import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChoristerPortalCollection,
  ChoristerPortalCollectionState,
  ChoristerTab,
  ChoristerPortalFeed,
  ChoristerPortalFeedState,
} from "@/features/chorister-app/choristerApp.domain";
import { supabase } from "@/integrations/supabase/client";
import { getChoristerPortalCollection } from "@/lib/chorister-event-collection.functions";
import { getParticipantAccess, getParticipantRegistration } from "@/lib/participant.functions";

import type { ParticipantAccess } from "./participant-auth.server";
import { ChoristerAppShell } from "./ChoristerAppShell";
import type { PdfAsset } from "./ChoristerScoresTab";
import type { ParticipantRegistrationView } from "./participant.domain";
import { downloadParticipantReceipt } from "./participant-receipt";
import { ParticipantPasswordDialog } from "./ParticipantPasswordDialog";

type Props = {
  onMissingAccess: () => void;
  onSignedOut: () => void;
  checkAccess?: () => Promise<ParticipantAccess>;
  loadRegistration?: () => Promise<ParticipantRegistrationView>;
  loadFeed?: () => Promise<ChoristerPortalFeedState>;
  loadCollection?: () => Promise<ChoristerPortalCollectionState>;
  signOut?: () => Promise<{ error: unknown }>;
  reauthenticateForPasswordChange?: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: unknown }>;
  updatePassword?: (password: string) => Promise<{ error: unknown }>;
  getSignedInEmail?: () => Promise<{ email: string | null; error: unknown }>;
  downloadReceipt?: (view: ParticipantRegistrationView) => Promise<void>;
  initialTab?: ChoristerTab;
  initialEventId?: string;
  onTabChange?: (tab: ChoristerTab) => void;
  onEventChange?: (eventId: string | null) => void;
};

type Gate =
  | "checking"
  | "loading"
  | "ready"
  | "not_published"
  | "unavailable"
  | "error"
  | "redirecting"
  | "leaving";

type ContentStatus = "ready" | "not_published" | "unavailable";
type AudioAsset = ChoristerPortalFeed["event"]["songs"][number]["audios"][number];
type PortalContentState = ChoristerPortalFeedState | ChoristerPortalCollectionState;
type PortalEvent = ChoristerPortalCollection["events"][number];

const EMPTY_PORTAL_FEED: ChoristerPortalFeed = {
  status: "published",
  event: {
    id: "00000000-0000-4000-8000-000000000000",
    name: "II Encontro de Coros Diocesanos e Litúrgicos",
    date: "2026-11-20",
    location: null,
    coverImageUrl: null,
    songs: [],
    documents: [],
  },
};

const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();

function publishedEvents(state: PortalContentState): PortalEvent[] | null {
  if (state.status !== "published") return null;
  return "events" in state ? state.events : [state.event];
}

function findScoreAsset(events: PortalEvent[], assetId: string): PdfAsset | undefined {
  return events
    .flatMap((event) => [...event.songs.flatMap((song) => song.sheetMusic), ...event.documents])
    .find((asset) => asset.id === assetId);
}

function findAudioAsset(events: PortalEvent[], assetId: string): AudioAsset | undefined {
  return events
    .flatMap((event) => event.songs)
    .flatMap((song) => song.audios)
    .find((audio) => audio.id === assetId);
}

export function ParticipantPortalPage({
  onMissingAccess,
  onSignedOut,
  checkAccess = getParticipantAccess,
  loadRegistration = getParticipantRegistration,
  loadFeed,
  loadCollection = getChoristerPortalCollection,
  signOut = defaultSignOut,
  reauthenticateForPasswordChange,
  updatePassword,
  getSignedInEmail,
  downloadReceipt = downloadParticipantReceipt,
  initialTab,
  initialEventId,
  onTabChange,
  onEventChange,
}: Props) {
  const [gate, setGate] = useState<Gate>("checking");
  const [view, setView] = useState<ParticipantRegistrationView | null>(null);
  const [feed, setFeed] = useState<ChoristerPortalFeed | null>(null);
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [contentStatus, setContentStatus] = useState<ContentStatus>("ready");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const signingOut = useRef(false);
  const loadContent = loadFeed ?? loadCollection;

  const loadPortal = useCallback(async () => {
    const current = ++revision.current;
    setView(null);
    setFeed(null);
    setEvents([]);
    setContentStatus("ready");
    setGate("checking");
    try {
      const access = await checkAccess();
      if (current !== revision.current || !mounted.current) return;
      if (access.status !== "authorized") {
        setGate("redirecting");
        onMissingAccess();
        return;
      }

      setGate("loading");
      const registration = await loadRegistration();
      if (current !== revision.current || !mounted.current) return;

      let portalContent: PortalContentState;
      try {
        portalContent = await loadContent();
      } catch {
        if (current === revision.current && mounted.current) {
          setView(registration);
          setFeed(EMPTY_PORTAL_FEED);
          setEvents([EMPTY_PORTAL_FEED.event]);
          setContentStatus("unavailable");
          setGate("ready");
        }
        return;
      }
      if (current !== revision.current || !mounted.current) return;
      if (portalContent.status === "not_published") {
        setView(registration);
        setFeed(EMPTY_PORTAL_FEED);
        setEvents([EMPTY_PORTAL_FEED.event]);
        setContentStatus("not_published");
        setGate("ready");
        return;
      }
      if (portalContent.status === "unavailable") {
        setView(registration);
        setFeed(EMPTY_PORTAL_FEED);
        setEvents([EMPTY_PORTAL_FEED.event]);
        setContentStatus("unavailable");
        setGate("ready");
        return;
      }

      const nextEvents = publishedEvents(portalContent);
      if (!nextEvents?.length) throw new Error("Portal collection is empty");
      setView(registration);
      setFeed({ status: "published", event: nextEvents[0] });
      setEvents(nextEvents);
      setContentStatus("ready");
      setGate("ready");
    } catch {
      if (current === revision.current && mounted.current) setGate("error");
    }
  }, [checkAccess, loadContent, loadRegistration, onMissingAccess]);

  useEffect(() => {
    mounted.current = true;
    void loadPortal();
    return () => {
      mounted.current = false;
    };
  }, [loadPortal]);

  const renewScoreAsset = useCallback(
    async (asset: PdfAsset): Promise<PdfAsset | undefined> => {
      const current = revision.current;
      try {
        const refreshedContent = await loadContent();
        const refreshedEvents = publishedEvents(refreshedContent);
        if (current !== revision.current || !mounted.current || !refreshedEvents?.length) {
          return undefined;
        }
        const refreshedAsset = findScoreAsset(refreshedEvents, asset.id);
        if (!refreshedAsset) return undefined;
        setFeed({ status: "published", event: refreshedEvents[0] });
        setEvents(refreshedEvents);
        return refreshedAsset;
      } catch {
        return undefined;
      }
    },
    [loadContent],
  );

  const renewAudio = useCallback(
    async (audioId: string): Promise<AudioAsset | undefined> => {
      const current = revision.current;
      try {
        const refreshedContent = await loadContent();
        const refreshedEvents = publishedEvents(refreshedContent);
        if (current !== revision.current || !mounted.current || !refreshedEvents?.length) {
          return undefined;
        }
        const refreshedAudio = findAudioAsset(refreshedEvents, audioId);
        if (!refreshedAudio) return undefined;
        setFeed({ status: "published", event: refreshedEvents[0] });
        setEvents(refreshedEvents);
        setContentStatus("ready");
        return refreshedAudio;
      } catch {
        return undefined;
      }
    },
    [loadContent],
  );

  async function logout() {
    if (signingOut.current) return;
    signingOut.current = true;
    revision.current += 1;
    flushSync(() => {
      setView(null);
      setFeed(null);
      setEvents([]);
      setGate("leaving");
    });
    try {
      const result = await signOut();
      if (result.error) throw result.error;
      onSignedOut();
    } catch {
      setGate("error");
    } finally {
      signingOut.current = false;
    }
  }

  if (gate === "ready" && view && feed) {
    return (
      <>
        <ChoristerAppShell
          participant={view}
          feed={feed}
          events={events}
          onChangePassword={() => setPasswordDialogOpen(true)}
          onDownloadReceipt={() => downloadReceipt(view)}
          onLogout={logout}
          onPlay={() => undefined}
          onOpenSong={() => undefined}
          onOpenScore={renewScoreAsset}
          onDownloadScore={renewScoreAsset}
          onRenewAudio={renewAudio}
          contentStatus={contentStatus}
          onRetryContent={() => void loadPortal()}
          initialTab={initialTab}
          initialEventId={initialEventId}
          onTabChange={onTabChange}
          onEventChange={onEventChange}
        />
        <ParticipantPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          getSignedInEmail={getSignedInEmail}
          reauthenticate={reauthenticateForPasswordChange}
          updatePassword={updatePassword}
        />
      </>
    );
  }

  return (
    <main className="chorister-app flex min-h-svh items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md space-y-4 text-center" aria-live="polite" aria-atomic="true">
        {gate === "checking" && (
          <>
            <p className="text-sm text-muted-foreground">Verificando acesso…</p>
            <Skeleton className="h-28 w-full" />
          </>
        )}
        {gate === "loading" && (
          <>
            <p className="text-sm text-muted-foreground">Carregando seus dados…</p>
            <Skeleton className="h-28 w-full" />
          </>
        )}
        {gate === "redirecting" && (
          <p className="text-sm text-muted-foreground">Redirecionando para entrar…</p>
        )}
        {gate === "leaving" && <p className="text-sm text-muted-foreground">Saindo…</p>}
        {gate === "not_published" && (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Os materiais do encontro ainda não foram publicados.
            </CardContent>
          </Card>
        )}
        {gate === "unavailable" && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p role="alert" className="text-sm">
                Não foi possível carregar os materiais do encontro. Tente novamente.
              </p>
              <Button size="sm" onClick={() => void loadPortal()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
        {gate === "error" && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p role="alert" className="text-sm">
                Não foi possível carregar seus dados. Tente novamente.
              </p>
              <Button size="sm" onClick={() => void loadPortal()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
