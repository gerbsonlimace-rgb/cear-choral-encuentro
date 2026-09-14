import { FileText, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";

const loadPdfRenderer = createClientOnlyFn(() => import("@/lib/pdf-cover.client"));

type PdfCoverPreviewProps = {
  sourceKey: string;
  title: string;
  getUrl: () => Promise<string>;
};

export function PdfCoverPreview({ sourceKey, title, getUrl }: PdfCoverPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const resolveUrl = useRef(getUrl);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    resolveUrl.current = getUrl;
  }, [getUrl]);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let started = false;
    const load = async () => {
      if (started) return;
      started = true;
      try {
        const url = await resolveUrl.current();
        controller.signal.throwIfAborted();
        const { renderPdfCover } = await loadPdfRenderer();
        controller.signal.throwIfAborted();
        const blob = await renderPdfCover(url, controller.signal);
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ key: sourceKey, url: objectUrl });
        setFailedKey(null);
      } catch {
        if (!controller.signal.aborted) setFailedKey(sourceKey);
      }
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                void load();
              }
            },
            { rootMargin: "200px" },
          );
    if (observer && container.current) observer.observe(container.current);
    else void load();
    return () => {
      observer?.disconnect();
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceKey]);

  const visibleImage = image?.key === sourceKey ? image.url : null;
  const failed = failedKey === sourceKey;
  return (
    <div
      ref={container}
      style={{ aspectRatio: "210 / 297" }}
      className="relative w-full overflow-hidden rounded-lg border border-zinc-200 bg-white"
    >
      {visibleImage ? (
        <img
          src={visibleImage}
          alt={`Capa de ${title}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-zinc-400">
          {failed ? (
            <FileText aria-hidden="true" className="size-8" />
          ) : (
            <LoaderCircle
              aria-hidden="true"
              className="size-6 animate-spin motion-reduce:animate-none"
            />
          )}
          <span className="text-xs">{failed ? "Prévia indisponível" : "Carregando capa…"}</span>
        </div>
      )}
    </div>
  );
}
