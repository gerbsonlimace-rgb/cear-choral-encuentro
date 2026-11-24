import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackSurprise } from "./FeedbackSurprise";

describe("feedback surprise preparation", () => {
  const createObjectURL = vi.fn(() => "blob:prepared-surprise");
  const revokeObjectURL = vi.fn();
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("downloads during answers, reveals only after completion and releases its buffer", async () => {
    const blob = new Blob(["test-video"], { type: "video/mp4" });
    const fetchVideo = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchVideo);
    const { rerender, unmount } = render(<FeedbackSurprise url="/final.mp4" completed={false} />);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(blob));
    expect(fetchVideo).toHaveBeenCalledWith(
      "/final.mp4",
      expect.objectContaining({ cache: "force-cache", signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.queryByRole("button", { name: "Finalizar e ver surpresa" }),
    ).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    rerender(<FeedbackSurprise url="/final.mp4" completed />);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar e ver surpresa" }));
    expect(screen.getByLabelText("Vídeo de agradecimento do encontro")).toBeVisible();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à confirmação" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:prepared-surprise");
    expect(fetchVideo.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("keeps successful feedback independent from a video failure and offers retry", async () => {
    const fetchVideo = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, blob: async () => new Blob(["mp4"], { type: "video/mp4" }) });
    vi.stubGlobal("fetch", fetchVideo);
    render(<FeedbackSurprise url="/final.mp4" completed />);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar e ver surpresa" }));
    expect(await screen.findByText(/Sua avaliação já foi salva/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar o vídeo" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Vídeo de agradecimento do encontro")).toHaveAttribute(
        "src",
        "blob:prepared-surprise",
      ),
    );
  });

  it("shows loading when opened before the download finishes and never promises an unconfigured video", async () => {
    let finish!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { rerender } = render(<FeedbackSurprise url={null} completed />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<FeedbackSurprise url="/final.mp4" completed />);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar e ver surpresa" }));
    expect(screen.getByRole("status")).toHaveTextContent("Preparando sua surpresa");
    await act(async () =>
      finish({ ok: true, blob: async () => new Blob(["mp4"], { type: "video/mp4" }) }),
    );
    expect(screen.getByLabelText("Vídeo de agradecimento do encontro")).toBeVisible();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("offers recovery when the downloaded media cannot be decoded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          blob: async () => new Blob(["mp4"], { type: "video/mp4" }),
        }),
    );
    render(<FeedbackSurprise url="/final.mp4" completed />);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Finalizar e ver surpresa" }));
    fireEvent.error(screen.getByLabelText("Vídeo de agradecimento do encontro"));
    expect(screen.getByRole("alert")).toHaveTextContent("Sua avaliação já foi salva");
    expect(screen.getByRole("button", { name: "Tentar carregar o vídeo" })).toBeVisible();
  });
});
