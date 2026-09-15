import { describe, expect, it, vi } from "vitest";
import { drawYoungFrameArtwork } from "./drawYoungFrameArtwork";

function createCanvasContextRecorder() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("drawYoungFrameArtwork", () => {
  it("draws a balanced organic frame and a subtle musical staff without covering the photo", () => {
    const ctx = createCanvasContextRecorder();

    drawYoungFrameArtwork(ctx, {
      width: 1080,
      height: 1350,
      frame: { x: 98, y: 234, width: 884, height: 715 },
    });

    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(11);
    expect(ctx.ellipse).toHaveBeenCalledTimes(7);
    expect(ctx.stroke).toHaveBeenCalledTimes(7);
    expect(ctx.fill).toHaveBeenCalledTimes(9);
  });

  it("scales stroke weight for a mobile-sized preview", () => {
    const ctx = createCanvasContextRecorder();

    drawYoungFrameArtwork(ctx, {
      width: 540,
      height: 675,
      frame: { x: 49, y: 117, width: 442, height: 357.5 },
    });

    expect(ctx.lineWidth).toBe(1.5);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
