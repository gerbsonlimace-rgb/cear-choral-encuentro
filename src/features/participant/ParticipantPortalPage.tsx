import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChoristerPortalFeed,
  ChoristerPortalFeedState,
} from "@/features/chorister-app/choristerApp.domain";
import { supabase } from "@/integrations/supabase/client";
import { getChoristerPortalFeed } from "@/lib/chorister-app.functions";
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
  signOut?: () => Promise<{ error: unknown }>;
  reauthenticateForPasswordChange?: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: unknown }>;
  updatePassword?: (password: string) => Promise<{ error: unknown }>;
  getSignedInEmail?: () => Promise<{ email: string | null; error: unknown }>;
  downloadReceipt?: (view: ParticipantRegistrationView) => Promise<void>;
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

const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();

function findScoreAsset(feed: ChoristerPortalFeed, assetId: string): PdfAsset | undefined {
  return [...feed.event.songs.flatMap((song) => song.sheetMusic), ...feed.event.documents].find(
    (asset) => asset.id === assetId,
  );
}

export function ParticipantPortalPage({
  onMissingAccess,
  onSignedOut,
  checkAccess = getParticipantAccess,
  loadRegistration = getParticipantRegistration,
  loadFeed = getChoristerPortalFeed,
  signOut = defaultSignOut,
  reauthenticateForPasswordChange,
  updatePassword,
  getSignedInEmail,
  downloadReceipt = downloadParticipantReceipt,
}: Props) {
  const [gate, setGate] = useState<Gate>("checking");
  const [view, setView] = useState<ParticipantRegistrationView | null>(null);
  const [feed, setFeed] = useState<ChoristerPortalFeed | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const signingOut = useRef(false);

  const loadPortal = useCallback(async () => {
    const current = ++revision.current;
    setView(null);
    setFeed(null);
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

      let portalFeed: ChoristerPortalFeedState;
      try {
        portalFeed = await loadFeed();
      } catch {
        if (current === revision.current && mounted.current) setGate("unavailable");
        return;
      }
      if (current !== revision.current || !mounted.current) return;
      if (portalFeed.status === "not_published") {
        setGate("not_published");
        return;
      }
      if (portalFeed.status === "unavailable") {
        setGate("unavailable");
        return;
      }

      setView(registration);
      setFeed(portalFeed);
      setGate("ready");
    } catch {
      if (current === revision.current && mounted.current) setGate("error");
    }
  }, [checkAccess, loadFeed, loadRegistration, onMissingAccess]);

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
        const refreshedFeed = await loadFeed();
        if (
          current !== revision.current ||
          !mounted.current ||
          refreshedFeed.status !== "published"
        ) {
          return undefined;
        }
        const refreshedAsset = findScoreAsset(refreshedFeed, asset.id);
        if (!refreshedAsset) return undefined;
        setFeed(refreshedFeed);
        return refreshedAsset;
      } catch {
        return undefined;
      }
    },
    [loadFeed],
  );

  async function logout() {
    if (signingOut.current) return;
    signingOut.current = true;
    revision.current += 1;
    flushSync(() => {
      setView(null);
      setFeed(null);
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
          onChangePassword={() => setPasswordDialogOpen(true)}
          onDownloadReceipt={() => downloadReceipt(view)}
          onLogout={logout}
          onPlay={() => undefined}
          onOpenSong={() => undefined}
          onOpenScore={renewScoreAsset}
          onDownloadScore={renewScoreAsset}
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
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
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
