import { afterEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist";
import { renderPdfCover } from "./pdf-cover.client";

vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.mjs" }));

afterEach(() => vi.unstubAllGlobals());

describe("PDF cover renderer", () => {
  function mockPdf() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      })),
    );
    const cover = new Blob(["cover"], { type: "image/png" });
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    const destroy = vi.fn(async () => undefined);
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ getPage: async () => page }),
      destroy,
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
      callback(cover),
    );
    return { cover, destroy };
  }

  it("starts PDF.js with range loading instead of waiting for a complete download", async () => {
    mockPdf();
    await renderPdfCover("range.pdf", new AbortController().signal);
    expect(fetch).not.toHaveBeenCalled();
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "range.pdf",
        disableAutoFetch: true,
        disableStream: true,
      }),
    );
  });

  it("reuses a recent cover but never reuses it for a different signed URL", async () => {
    const { cover } = mockPdf();
    expect(await renderPdfCover("cached.pdf?token=one", new AbortController().signal)).toBe(cover);
    expect(await renderPdfCover("cached.pdf?token=one", new AbortController().signal)).toBe(cover);
    expect(getDocument).toHaveBeenCalledTimes(1);
    await renderPdfCover("cached.pdf?token=two", new AbortController().signal);
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it("expires cached covers instead of retaining private previews indefinitely", async () => {
    mockPdf();
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    await renderPdfCover("expires.pdf", new AbortController().signal);
    clock.mockReturnValue(121000);
    await renderPdfCover("expires.pdf", new AbortController().signal);
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it("does not start any work for an already aborted request", async () => {
    mockPdf();
    const controller = new AbortController();
    controller.abort();
    await expect(renderPdfCover("cancelled.pdf", controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("evicts older covers when their total size exceeds the memory budget", async () => {
    mockPdf();
    const largeCover = new Blob([new Uint8Array(5 * 1024 * 1024)]);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
      callback(largeCover),
    );
    await renderPdfCover("large-one.pdf", new AbortController().signal);
    await renderPdfCover("large-two.pdf", new AbortController().signal);
    await renderPdfCover("large-two.pdf", new AbortController().signal);
    expect(getDocument).toHaveBeenCalledTimes(2);
    await renderPdfCover("large-one.pdf", new AbortController().signal);
    expect(getDocument).toHaveBeenCalledTimes(3);
  });

  it("destroys an interrupted PDF once and never caches the unfinished cover", async () => {
    const { destroy } = mockPdf();
    let finish!: (blob: Blob | null) => void;
    let encoding!: () => void;
    const started = new Promise<void>((resolve) => {
      encoding = resolve;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      finish = callback;
      encoding();
    });
    const controller = new AbortController();
    const pending = renderPdfCover("interrupted.pdf", controller.signal);
    const rejection = expect(pending).rejects.toThrow();
    await started;
    controller.abort();
    finish(new Blob(["cancelled"]));
    await rejection;
    expect(destroy).toHaveBeenCalledTimes(1);
    mockPdf();
    await renderPdfCover("interrupted.pdf", new AbortController().signal);
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it("renders only page one and preserves a landscape page within the memory limit", async () => {
    const cover = new Blob(["cover"], { type: "image/png" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) })),
    );
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 1000 * scale, height: 500 * scale }),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    const getPage = vi.fn(async () => page);
    const destroy = vi.fn(async () => undefined);
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ getPage, numPages: 20 }),
      destroy,
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
      callback(cover),
    );
    expect(await renderPdfCover("private.pdf", new AbortController().signal)).toBe(cover);
    expect(getPage).toHaveBeenCalledExactlyOnceWith(1);
    expect(page.render).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 600, height: 300 },
        background: "#ffffff",
      }),
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("releases a failed PDF load and retries instead of caching an access error", async () => {
    const destroy = vi.fn(async () => undefined);
    vi.mocked(getDocument).mockImplementation(
      () =>
        ({
          promise: Promise.reject(new Error("Não foi possível carregar o PDF.")),
          destroy,
        }) as never,
    );
    await expect(renderPdfCover("expired.pdf", new AbortController().signal)).rejects.toThrow(
      "carregar o PDF",
    );
    await expect(renderPdfCover("expired.pdf", new AbortController().signal)).rejects.toThrow();
    expect(destroy).toHaveBeenCalledTimes(2);
    expect(getDocument).toHaveBeenCalledTimes(2);
  });
});
