export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  let shareable = false;
  try {
    shareable = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
      && typeof navigator.share === "function" && Boolean(navigator.canShare?.({ files: [file] }));
  } catch { /* Embedded browsers may deny file sharing even when the API exists. */ }
  if (shareable) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function openPreparedPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return opened;
}