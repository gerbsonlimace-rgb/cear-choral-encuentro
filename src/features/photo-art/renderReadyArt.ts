import { getPhotoPlacement, type PhotoAdjustment } from "./photoArt";
import type { ReadyArt } from "./readyArts";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

type ReadyArtAssets = {
  example: HTMLImageElement;
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

  if (!options.photo) {
    context.drawImage(options.example, 0, 0, STORY_WIDTH, STORY_HEIGHT);
    return;
  }

  const placement = getPhotoPlacement(
    options.photo.naturalWidth,
    options.photo.naturalHeight,
    options.art.photoFrame,
    options.adjustment,
  );
  context.drawImage(options.photo, placement.x, placement.y, placement.width, placement.height);
  context.drawImage(options.overlay, 0, 0, STORY_WIDTH, STORY_HEIGHT);
}
