import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render only the first page; the caller owns the resulting image's lifetime. */
export async function renderPdfCover(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Não foi possível carregar o PDF.");
  const data = await response.arrayBuffer();
  signal.throwIfAborted();
  const task = getDocument({ data, useSystemFonts: true });
  const abort = () => {
    void task.destroy().catch(() => undefined);
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
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Prévia indisponível"))),
        "image/png",
      );
    });
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
    canvas.width = 0;
    canvas.height = 0;
  }
}
