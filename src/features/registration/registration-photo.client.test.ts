import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareRegistrationPhoto } from "./registration-photo";

describe("registration photo preparation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reduces a high-resolution photo to the badge upload dimensions", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2400, height: 1600, close })),
    );

    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback) =>
        callback(new Blob(["reduced-photo"], { type: "image/webp" })),
      ),
    } as unknown as HTMLCanvasElement;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) =>
      tagName === "canvas" ? canvas : originalCreateElement(tagName, options),
    );

    const prepared = await prepareRegistrationPhoto(
      new File(["original-photo"], "participant.jpg", { type: "image/jpeg" }),
    );

    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(800);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 800);
    expect(prepared.payload.contentType).toBe("image/webp");
    expect(prepared.previewUrl).toMatch(/^data:image\/webp;base64,/);
    expect(close).toHaveBeenCalledOnce();
  });
});
