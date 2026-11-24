import { useEffect, useRef, useState } from "react";
import { Gift, LoaderCircle, X } from "lucide-react";
import "./feedback-surprise.css";

type Props = {
  url: string | null;
  posterUrl?: string | null;
  completed: boolean;
  onClaim: (claimId: string) => Promise<{ allowed: boolean }>;
  onConsumed?: () => void;
  initialClaimId?: string;
  onPlaybackStarted?: () => void;
};

export function FeedbackSurprise({
  url,
  posterUrl,
  completed,
  onClaim,
  onConsumed,
  initialClaimId,
  onPlaybackStarted,
}: Props) {
  const [prepared, setPrepared] = useState<{ source: string; blobUrl: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);
  const opening = useRef(false);
  const claimId = useRef<string | null>(initialClaimId ?? null);
  const hasClaim = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const blobUrl = prepared?.source === url ? prepared.blobUrl : undefined;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setFailed(false);
    setPrepared(null);
    // A full fetch is intentional: preload="auto" alone is only a browser hint.
    void fetch(url, { signal: controller.signal, cache: "force-cache", credentials: "omit" })
      .then(async (response) => {
        if (!response.ok) throw new Error("video_unavailable");
        const blob = await response.blob();
        if (
          !blob.size ||
          (blob.type && !blob.type.startsWith("video/") && blob.type !== "application/octet-stream")
        )
          throw new Error("invalid_video");
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPrepared({ source: url, blobUrl: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, attempt]);

  if (!url) return null;

  async function authorizeAndPlay() {
    if (!completed || !blobUrl || consumed || opening.current) return;
    opening.current = true;
    setClaiming(true);
    setClaimFailed(false);
    try {
      claimId.current ??= crypto.randomUUID();
      const permission = hasClaim.current ? { allowed: true } : await onClaim(claimId.current);
      if (!permission.allowed) {
        setConsumed(true);
        dialog.current?.close();
        onConsumed?.();
        return;
      }
      hasClaim.current = true;
      if (!dialog.current?.open) {
        setConsumed(true);
        onConsumed?.();
        return;
      }
      setAuthorized(true);
      // Run inside the click gesture, after successful feedback submission.
      // Native controls remain available if a mobile browser blocks playback.
      void video.current?.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotSupportedError") setFailed(true);
      });
    } catch {
      setClaimFailed(true);
    } finally {
      opening.current = false;
      setClaiming(false);
    }
  }
  function reveal() {
    if (consumed || !completed) return;
    dialog.current?.showModal();
    if (blobUrl && !failed) void authorizeAndPlay();
  }
  function closeView() {
    video.current?.pause();
    if (hasClaim.current) {
      setConsumed(true);
      onConsumed?.();
    }
  }

  return (
    <>
      {completed && !consumed && (
        <button className="feedback-submit feedback-surprise-start" type="button" onClick={reveal}>
          <Gift size={20} aria-hidden="true" /> Finalizar e ver surpresa
        </button>
      )}
      <dialog
        ref={dialog}
        className="feedback-surprise-dialog"
        aria-labelledby="feedback-surprise-title"
        onClose={closeView}
      >
        <header className="feedback-surprise-header">
          <h2 id="feedback-surprise-title">Uma lembrança do nosso encontro</h2>
          <button
            type="button"
            aria-label="Voltar à confirmação"
            onClick={() => dialog.current?.close()}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </header>
        <div className="feedback-surprise-screen">
          {(!blobUrl || claiming) && !failed && !claimFailed && (
            <p role="status">
              <LoaderCircle className="feedback-spinner" size={24} aria-hidden="true" /> Preparando
              sua surpresa…
            </p>
          )}
          {failed && (
            <div className="feedback-surprise-error" role="alert">
              <p>Sua avaliação já foi salva. Não foi possível carregar o vídeo agora.</p>
              <button
                className="feedback-submit"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Tentar carregar o vídeo
              </button>
            </div>
          )}
          {claimFailed && (
            <div className="feedback-surprise-error" role="alert">
              <p>Sua avaliação já foi salva. Não foi possível abrir o vídeo agora.</p>
              <button
                className="feedback-submit"
                type="button"
                onClick={() => void authorizeAndPlay()}
              >
                Tentar abrir o vídeo
              </button>
            </div>
          )}
          {blobUrl && !failed && !authorized && !claiming && !claimFailed && (
            <button
              className="feedback-submit"
              type="button"
              onClick={() => void authorizeAndPlay()}
            >
              Assistir ao vídeo
            </button>
          )}
          <video
            ref={video}
            hidden={!blobUrl || failed || !authorized}
            src={blobUrl}
            poster={posterUrl ?? undefined}
            controls
            playsInline
            preload="auto"
            aria-label="Vídeo de agradecimento do encontro"
            onError={() => setFailed(true)}
            onEnded={() => dialog.current?.close()}
            onPlaying={onPlaybackStarted}
          />
        </div>
      </dialog>
    </>
  );
}
