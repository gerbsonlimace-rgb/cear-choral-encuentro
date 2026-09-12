import { Download, ExternalLink, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  isSignedUrlExpired,
  type ChoristerPortalFeed,
} from "@/features/chorister-app/choristerApp.domain";

export type PdfAsset = {
  id: string;
  title: string;
  signedUrl: string;
  expiresAt: string;
};

export type PdfAssetAction = (asset: PdfAsset) => PdfAsset | void | Promise<PdfAsset | void>;

type ChoristerScoresTabProps = {
  event: ChoristerPortalFeed["event"];
  onOpen: PdfAssetAction;
  onDownload: PdfAssetAction;
  initialAsset?: PdfAsset | null;
};

type RenewalAttempt = {
  assetId: string;
  generation: number;
  used: boolean;
  inFlight: boolean;
  promise: Promise<PdfAsset | undefined>;
};

function isRefreshedAsset(value: PdfAsset | void): value is PdfAsset {
  return Boolean(value?.id && value.signedUrl && value.expiresAt && value.title);
}

function orderedSongs(event: ChoristerPortalFeed["event"]) {
  return [...event.songs].sort((first, second) => first.order - second.order);
}

function orderedDocuments(event: ChoristerPortalFeed["event"]) {
  return [...event.documents].sort((first, second) => first.sortOrder - second.sortOrder);
}

export function ChoristerScoresTab({ event, onOpen, onDownload, initialAsset }: ChoristerScoresTabProps) {
  const [viewerAsset, setViewerAsset] = useState<PdfAsset | null>(null);
  const [viewerStatus, setViewerStatus] = useState<"ready" | "refreshing" | "error">("ready");
  const mountedRef = useRef(false);
  const viewerGenerationRef = useRef(0);
  const renewalAttemptRef = useRef<RenewalAttempt | null>(null);
  const lifecycleAssetIdRef = useRef<string | null>(null);
  const renewalUsedAssetIdsRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      viewerGenerationRef.current += 1;
    };
  }, []);

  function isCurrentGeneration(generation: number) {
    return mountedRef.current && viewerGenerationRef.current === generation;
  }

  function isCurrentAttempt(attempt: RenewalAttempt) {
    return isCurrentGeneration(attempt.generation) && renewalAttemptRef.current === attempt;
  }

  function renew(
    asset: PdfAsset,
    { required }: { required: boolean },
  ): Promise<PdfAsset | undefined> {
    const generation = viewerGenerationRef.current;
    if (!isCurrentGeneration(generation)) return Promise.resolve(undefined);
    const existingAttempt = renewalAttemptRef.current;
    if (renewalUsedAssetIdsRef.current.has(asset.id)) {
      if (existingAttempt?.assetId === asset.id) return existingAttempt.promise;
      return Promise.resolve(undefined);
    }

    renewalUsedAssetIdsRef.current.add(asset.id);
    if (required) setViewerStatus("refreshing");
    const attempt: RenewalAttempt = {
      assetId: asset.id,
      generation,
      used: true,
      inFlight: true,
      promise: Promise.resolve(undefined),
    };
    renewalAttemptRef.current = attempt;

    let renewal: PdfAsset | void | Promise<PdfAsset | void>;
    try {
      renewal = onOpen(asset);
    } catch {
      attempt.inFlight = false;
      if (isCurrentAttempt(attempt) && required) setViewerStatus("error");
      return attempt.promise;
    }

    attempt.promise = Promise.resolve(renewal)
      .then((refreshed) => {
        attempt.inFlight = false;
        if (!isCurrentAttempt(attempt)) return undefined;
        if (!isRefreshedAsset(refreshed) || isSignedUrlExpired(refreshed.expiresAt)) {
          if (required) setViewerStatus("error");
          return undefined;
        }
        setViewerAsset(refreshed);
        setViewerStatus("ready");
        return refreshed;
      })
      .catch(() => {
        attempt.inFlight = false;
        if (isCurrentAttempt(attempt) && required) setViewerStatus("error");
        return undefined;
      });
    return attempt.promise;
  }

  function open(asset: PdfAsset) {
    if (lifecycleAssetIdRef.current === asset.id && renewalUsedAssetIdsRef.current.has(asset.id)) {
      return;
    }

    viewerGenerationRef.current += 1;
    lifecycleAssetIdRef.current = asset.id;
    renewalAttemptRef.current = null;
    renewalUsedAssetIdsRef.current.clear();
    setViewerAsset(asset);
    setViewerStatus("ready");
    void renew(asset, { required: isSignedUrlExpired(asset.expiresAt) });
  }

  useEffect(() => {
    if (initialAsset) open(initialAsset);
    // The shell changes the asset id to request a new viewer lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsset?.id]);

  async function download(asset: PdfAsset) {
    const generation = viewerGenerationRef.current;
    if (!isCurrentGeneration(generation)) return;
    if (renewalUsedAssetIdsRef.current.has(asset.id)) {
      if (!isSignedUrlExpired(asset.expiresAt)) triggerDownload(asset, generation);
      else setViewerStatus("error");
      return;
    }

    renewalUsedAssetIdsRef.current.add(asset.id);
    try {
      const refreshed = await onDownload(asset);
      if (!isCurrentGeneration(generation)) return;
      const downloadable = isRefreshedAsset(refreshed) ? refreshed : asset;
      if (isSignedUrlExpired(downloadable.expiresAt)) throw new Error("Expired asset");
      triggerDownload(downloadable, generation);
    } catch {
      if (isCurrentGeneration(generation)) setViewerStatus("error");
    }
  }

  function triggerDownload(asset: PdfAsset, generation: number) {
    if (!isCurrentGeneration(generation)) return;
    const anchor = document.createElement("a");
    anchor.href = asset.signedUrl;
    anchor.download = asset.title;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function openInNewTab() {
    if (!viewerAsset) return;
    const asset = viewerAsset;
    const generation = viewerGenerationRef.current;
    const popup = window.open("", "_blank");
    if (!popup) {
      setViewerStatus("error");
      return;
    }
    try {
      popup.opener = null;
    } catch {
      popup.close();
      setViewerStatus("error");
      return;
    }

    if (isSignedUrlExpired(asset.expiresAt)) {
      void renew(asset, { required: true }).then((refreshed) => {
        if (
          !refreshed ||
          !isCurrentGeneration(generation) ||
          isSignedUrlExpired(refreshed.expiresAt)
        ) {
          popup.close();
          if (isCurrentGeneration(generation)) setViewerStatus("error");
          return;
        }
        popup.location.href = refreshed.signedUrl;
      });
      return;
    }

    if (isSignedUrlExpired(asset.expiresAt)) {
      popup.close();
      setViewerStatus("error");
      return;
    }
    popup.location.href = asset.signedUrl;
  }

  function viewerFailed() {
    if (!viewerAsset) return;
    const attempt = renewalAttemptRef.current;
    if (attempt?.assetId === viewerAsset.id && attempt.generation === viewerGenerationRef.current) {
      if (attempt.inFlight) viewerGenerationRef.current += 1;
      setViewerStatus("error");
      return;
    }
    if (renewalUsedAssetIdsRef.current.has(viewerAsset.id)) {
      setViewerStatus("error");
      return;
    }
    void renew(viewerAsset, { required: true });
  }

  function closeViewer() {
    viewerGenerationRef.current += 1;
    renewalAttemptRef.current = null;
    lifecycleAssetIdRef.current = null;
    renewalUsedAssetIdsRef.current.clear();
    setViewerAsset(null);
    setViewerStatus("ready");
  }

  const songsWithScores = orderedSongs(event).filter((song) => song.sheetMusic.length > 0);
  const documents = orderedDocuments(event);

  return (
    <section aria-labelledby="chorister-scores-title" className="space-y-5">
      <header>
        <p className="text-sm font-medium text-amber-700">Materiais publicados</p>
        <h1
          id="chorister-scores-title"
          className="mt-1 font-display text-2xl font-semibold text-zinc-950"
        >
          Partituras
        </h1>
      </header>

      {songsWithScores.length > 0 && (
        <section aria-labelledby="repertoire-scores-title" className="space-y-3">
          <h2
            id="repertoire-scores-title"
            className="font-display text-lg font-semibold text-zinc-950"
          >
            Repertório
          </h2>
          {songsWithScores.map((song) => (
            <article
              key={song.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
                {song.liturgicalType}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-zinc-950">{song.name}</h2>
              <ul className="mt-3 space-y-2" aria-label={`Partituras de ${song.name}`}>
                {song.sheetMusic.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3"
                  >
                    <span className="flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-800">
                      <FileText aria-hidden="true" className="size-4 text-amber-700" />
                      {asset.title}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-3 text-zinc-700 hover:bg-white"
                        onClick={() => void open(asset)}
                      >
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-3 text-zinc-700 hover:bg-white"
                        onClick={() => void download(asset)}
                      >
                        <Download aria-hidden="true" className="size-4" />
                        Baixar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {documents.length > 0 && (
        <section aria-labelledby="event-documents-title" className="space-y-3">
          <h2
            id="event-documents-title"
            className="font-display text-lg font-semibold text-zinc-950"
          >
            Manuais e documentos
          </h2>
          <div className="space-y-2">
            {documents.map((asset) => (
              <article
                key={asset.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex min-h-11 items-center gap-2">
                  <FileText aria-hidden="true" className="size-4 text-amber-700" />
                  <h3 className="text-sm font-semibold text-zinc-950">{asset.title}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3"
                    onClick={() => void open(asset)}
                  >
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3"
                    onClick={() => void download(asset)}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Baixar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {songsWithScores.length === 0 && documents.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
          Nenhuma partitura ou material foi publicado ainda.
        </p>
      )}

      {viewerAsset && (
        <section
          aria-label={`Visualizador de ${viewerAsset.title}`}
          className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="truncate font-display text-lg font-semibold text-zinc-950">
              {viewerAsset.title}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Fechar visualizador"
              onClick={closeViewer}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
          {viewerStatus === "ready" && (
            <iframe
              key={viewerAsset.signedUrl}
              title={`PDF ${viewerAsset.title}`}
              src={viewerAsset.signedUrl}
              className="h-[60svh] w-full rounded-lg border border-zinc-200"
              onErrorCapture={viewerFailed}
            />
          )}
          {viewerStatus === "refreshing" && (
            <p className="p-4 text-sm text-zinc-600">Atualizando acesso ao PDF…</p>
          )}
          {viewerStatus === "error" && (
            <p role="alert" className="p-4 text-sm text-zinc-700">
              Não foi possível abrir este PDF. Tente novamente.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void openInNewTab()}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Abrir em nova guia
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void download(viewerAsset)}
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar PDF
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
