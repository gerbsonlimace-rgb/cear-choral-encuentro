import { getPhotoPlacement, type PhotoAdjustment } from "./photoArt";
import type { ReadyArt } from "./readyArts";
import { appendPhotoOpening } from "./photoOpenings";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

type ReadyArtAssets = {
  overlay: HTMLImageElement;
};

type RenderReadyArtOptions = ReadyArtAssets & {
  art: ReadyArt;
  photo: HTMLImageElement | null;
  adjustment: PhotoAdjustment;
};

export function renderReadyArt(canvas: HTMLCanvasElement, options: RenderReadyArtOptions) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu preparar a imagem.");

  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  context.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (options.photo) {
    context.save();
    context.beginPath();
    appendPhotoOpening(context, options.art.id);
    context.clip();
    const placement = getPhotoPlacement(
      options.photo.naturalWidth,
      options.photo.naturalHeight,
      options.art.photoFrame,
      options.adjustment,
    );
    context.drawImage(options.photo, placement.x, placement.y, placement.width, placement.height);
    context.restore();
  }

  // Exclude the entire photo opening, including sample pixels left in the asset.
  context.save();
  context.beginPath();
  context.rect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  appendPhotoOpening(context, options.art.id);
  context.clip("evenodd");
  context.drawImage(options.overlay, 0, 0, STORY_WIDTH, STORY_HEIGHT);
  context.restore();

  // A clean inner border also covers the antialiased sample pixels at the cut edge.
  context.save();
  context.beginPath();
  appendPhotoOpening(context, options.art.id);
  context.strokeStyle = "#ffffff";
  context.lineWidth =
    options.art.id === "quixada" ? 4 : options.art.id.startsWith("quixada-eu-vou") ? 8 : 10;
  context.stroke();
  context.restore();
}
