import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

// Exact signed URLs keep different access grants separate. Never persist private covers.
const covers = new Map<string, { blob: Blob; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 24;

/** Render only the first page; the caller owns the resulting image's lifetime. */
export async function renderPdfCover(url: string, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  for (const [key, entry] of covers) {
    if (entry.expiresAt <= Date.now()) covers.delete(key);
  }
  const cached = covers.get(url);
  if (cached) {
    covers.delete(url);
    covers.set(url, cached);
    return cached.blob;
  }
  // Let PDF.js request just the byte ranges needed for page one. It falls back
  // to a complete response when the server does not support range requests.
  const task = getDocument({
    url,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
  });
  let destruction: Promise<void> | undefined;
  const destroy = () => (destruction ??= task.destroy());
  const abort = () => {
    void destroy().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  const canvas = document.createElement("canvas");
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    signal.throwIfAborted();
    const natural = page.getViewport({ scale: 1 });
    // Bound memory for unusually tall or wide pages; CSS contains it inside A4.
    const viewport = page.getViewport({
      scale: Math.min(600 / natural.width, 850 / natural.height),
    });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;
    signal.throwIfAborted();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Prévia indisponível"))),
        "image/png",
      );
    });
    signal.throwIfAborted();
    if (blob.size <= MAX_CACHE_BYTES) {
      covers.set(url, { blob, expiresAt: Date.now() + CACHE_TTL_MS });
      let bytes = [...covers.values()].reduce((total, entry) => total + entry.blob.size, 0);
      for (const [key, entry] of covers) {
        if (covers.size <= MAX_CACHE_ENTRIES && bytes <= MAX_CACHE_BYTES) break;
        covers.delete(key);
        bytes -= entry.blob.size;
      }
    }
    return blob;
  } finally {
    signal.removeEventListener("abort", abort);
    await destroy();
    canvas.width = 0;
    canvas.height = 0;
  }
}
