import { useEffect, useRef, useState } from "react";
import { Gift, LoaderCircle, X } from "lucide-react";
import "./feedback-surprise.css";

type Props = { url: string | null; posterUrl?: string | null; completed: boolean };

export function FeedbackSurprise({ url, posterUrl, completed }: Props) {
  const [prepared, setPrepared] = useState<{ source: string; blobUrl: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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

  function reveal() {
    dialog.current?.showModal();
    // Run inside the click gesture, after successful feedback submission.
    // Native controls remain available if a mobile browser blocks playback.
    if (blobUrl)
      void video.current?.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotSupportedError") setFailed(true);
      });
  }

  return (
    <>
      {completed && (
        <button className="feedback-submit feedback-surprise-start" type="button" onClick={reveal}>
          <Gift size={20} aria-hidden="true" /> Finalizar e ver surpresa
        </button>
      )}
      <dialog
        ref={dialog}
        className="feedback-surprise-dialog"
        aria-labelledby="feedback-surprise-title"
        onClose={() => video.current?.pause()}
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
          {!blobUrl && !failed && (
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
          <video
            ref={video}
            hidden={!blobUrl || failed}
            src={blobUrl}
            poster={posterUrl ?? undefined}
            controls
            playsInline
            preload="auto"
            aria-label="Vídeo de agradecimento do encontro"
            onError={() => setFailed(true)}
          />
        </div>
      </dialog>
    </>
  );
}
