import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfCoverPreview } from "./PdfCoverPreview";
import { renderPdfCover } from "@/lib/pdf-cover.client";

vi.mock("@/lib/pdf-cover.client", () => ({ renderPdfCover: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe("PDF cover preview", () => {
  it("loads only near the viewport and shows an accessible cover image", async () => {
    let intersect!: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const getUrl = vi.fn(async () => "https://private.test/book.pdf");
    vi.mocked(renderPdfCover).mockResolvedValue(new Blob(["cover"], { type: "image/png" }));
    URL.createObjectURL = vi.fn(() => "blob:cover");
    URL.revokeObjectURL = vi.fn();
    const view = render(<PdfCoverPreview sourceKey="book" title="Livro" getUrl={getUrl} />);
    expect(getUrl).not.toHaveBeenCalled();
    act(() =>
      intersect(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    const image = await screen.findByRole("img", { name: "Capa de Livro" });
    expect(image).toHaveAttribute("src", "blob:cover");
    expect(image.parentElement).toHaveStyle({ aspectRatio: "210 / 297" });
    expect(getUrl).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover");
  });

  it("keeps a readable fallback when the PDF cannot be loaded", async () => {
    vi.mocked(renderPdfCover).mockRejectedValue(new Error("PDF unavailable"));
    render(<PdfCoverPreview sourceKey="bad" title="Guia" getUrl={async () => "bad.pdf"} />);
    expect(await screen.findByText("Prévia indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("aborts loading on unmount and never creates an image for a stale result", async () => {
    let finish!: (blob: Blob) => void;
    vi.mocked(renderPdfCover).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    URL.createObjectURL = vi.fn();
    const view = render(
      <PdfCoverPreview sourceKey="old" title="Antigo" getUrl={async () => "old.pdf"} />,
    );
    await waitFor(() => expect(renderPdfCover).toHaveBeenCalled());
    const signal = vi.mocked(renderPdfCover).mock.calls[0][1];
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(new Blob(["old"])));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
