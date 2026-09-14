import { afterEach, describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist";
import { renderPdfCover } from "./pdf-cover.client";

vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.mjs" }));

afterEach(() => vi.unstubAllGlobals());

describe("PDF cover renderer", () => {
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

  it("rejects expired HTTP access without passing an error response to the PDF parser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 })),
    );
    await expect(renderPdfCover("expired.pdf", new AbortController().signal)).rejects.toThrow(
      "carregar o PDF",
    );
    expect(getDocument).not.toHaveBeenCalled();
  });
});
