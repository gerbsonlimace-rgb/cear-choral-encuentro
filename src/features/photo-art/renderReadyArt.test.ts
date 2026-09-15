import { describe, expect, it, vi } from "vitest";

import { DEFAULT_ADJUSTMENT } from "./photoArt";
import { READY_ARTS } from "./readyArts";
import { renderReadyArt } from "./renderReadyArt";

function canvasRecorder() {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement;
  return { canvas, context };
}

describe("renderReadyArt", () => {
  it.each(READY_ARTS)("leaves $id empty before a participant adds a photo", (art) => {
    const { canvas, context } = canvasRecorder();
    const overlay = {} as HTMLImageElement;

    renderReadyArt(canvas, {
      art,
      overlay,
      photo: null,
      adjustment: DEFAULT_ADJUSTMENT,
    });

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(overlay, 0, 0, 1080, 1920);
    expect(context.clip).toHaveBeenCalledWith("evenodd");
  });

  it.each(READY_ARTS)("keeps the participant photo behind the clean $id frame", (art) => {
    const { canvas, context } = canvasRecorder();
    const photo = { naturalWidth: 800, naturalHeight: 1200 } as HTMLImageElement;
    const overlay = {} as HTMLImageElement;

    renderReadyArt(canvas, {
      art,
      overlay,
      photo,
      adjustment: { zoom: 1.2, x: 0.1, y: -0.2 },
    });

    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(context.drawImage).mock.calls[0][0]).toBe(photo);
    expect(context.drawImage).toHaveBeenLastCalledWith(overlay, 0, 0, 1080, 1920);
    expect(context.clip).toHaveBeenCalledWith("evenodd");
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
  });
});
