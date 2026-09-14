import { describe, expect, it, vi } from "vitest";
import { ART_STYLES, getPhotoPlacement, validatePhoto, sharePhotoFile } from "./photoArt";

describe("photo art", () => {
  it("offers a Quixadá frame inspired by the event landmarks", () => {
    expect(ART_STYLES).toContainEqual({
      id: "quixada",
      name: "Quixadá",
      description: "Cedro, Galinha Choca e Santuário",
    });
  });

  it("covers the entire frame without distorting a landscape photo", () => {
    const result = getPhotoPlacement(
      1600,
      900,
      { x: 40, y: 100, width: 1000, height: 1000 },
      { zoom: 1, x: 0, y: 0 },
    );
    expect(result.x).toBeCloseTo(40 - ((1600 / 900) * 1000 - 1000) / 2);
    expect(result.y).toBe(100);
    expect(result.width).toBeCloseTo((1600 / 900) * 1000);
    expect(result.height).toBe(1000);
  });

  it.each([-1, 0, 1])("keeps every edge covered when repositioning at %s", (position) => {
    const rect = { x: 80, y: 160, width: 920, height: 1200 };
    const result = getPhotoPlacement(800, 1200, rect, { zoom: 2, x: position, y: position });
    expect(result.x).toBeLessThanOrEqual(rect.x);
    expect(result.y).toBeLessThanOrEqual(rect.y);
    expect(result.x + result.width).toBeGreaterThanOrEqual(rect.x + rect.width);
    expect(result.y + result.height).toBeGreaterThanOrEqual(rect.y + rect.height);
    expect(result.width / result.height).toBeCloseTo(800 / 1200);
  });

  it("rejects unsupported formats, empty and oversized photos with actionable messages", () => {
    expect(validatePhoto({ type: "image/heic", size: 10 })).toBeNull();
    expect(validatePhoto({ type: "image/svg+xml", size: 10 })).toMatch(/JPG, PNG, WebP ou HEIC/);
    expect(validatePhoto({ type: "image/jpeg", size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    expect(validatePhoto({ type: "image/png", size: 0 })).toMatch(/vazio/);
    expect(validatePhoto({ type: "image/jpeg", size: 1024 })).toBeNull();
  });

  it("passes the actual PNG file to native sharing", async () => {
    const file = new File(["png"], "minha-foto.png", { type: "image/png" });
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await sharePhotoFile(file, { canShare: () => true, share })).toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
  });

  it("offers download when file sharing is unsupported", async () => {
    const share = vi.fn();
    const file = new File(["png"], "foto.png");
    expect(await sharePhotoFile(file, {})).toBe("unsupported");
    expect(await sharePhotoFile(file, { canShare: () => false, share })).toBe("unsupported");
    expect(share).not.toHaveBeenCalled();
  });

  it("does not download or report an error when native sharing is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    expect(
      await sharePhotoFile(new File(["png"], "foto.png"), { canShare: () => true, share }),
    ).toBe("cancelled");
  });

  it("preserves real sharing failures so the UI can offer recovery", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Blocked"));
    await expect(
      sharePhotoFile(new File(["png"], "foto.png"), { canShare: () => true, share }),
    ).rejects.toThrow("Blocked");
  });
});
