import { describe, expect, it, vi } from "vitest";

import { DEFAULT_ADJUSTMENT } from "./photoArt";
import { READY_ARTS } from "./readyArts";
import { renderReadyArt } from "./renderReadyArt";

function canvasRecorder() {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
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
  it("shows the complete approved example before a participant adds a photo", () => {
    const { canvas, context } = canvasRecorder();
    const example = {} as HTMLImageElement;

    renderReadyArt(canvas, {
      art: READY_ARTS[0],
      example,
      overlay: {} as HTMLImageElement,
      photo: null,
      adjustment: DEFAULT_ADJUSTMENT,
    });

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(example, 0, 0, 1080, 1920);
  });

  it("places the participant photo first and restores the exact artwork overlay", () => {
    const { canvas, context } = canvasRecorder();
    const photo = { naturalWidth: 800, naturalHeight: 1200 } as HTMLImageElement;
    const overlay = {} as HTMLImageElement;

    renderReadyArt(canvas, {
      art: READY_ARTS[2],
      example: {} as HTMLImageElement,
      overlay,
      photo,
      adjustment: { zoom: 1.2, x: 0.1, y: -0.2 },
    });

    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenLastCalledWith(overlay, 0, 0, 1080, 1920);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
  });
});
