import {
  ART_FORMATS,
  ART_PHRASES,
  getPhotoPlacement,
  type ArtFormat,
  type ArtPhrase,
  type ArtStyle,
  type PhotoAdjustment,
  type PhotoRect,
} from "./photoArt";
import { drawYoungFrameArtwork } from "./young-style/drawYoungFrameArtwork";
import { drawQuixadaFrameArtwork } from "./quixada-style/drawQuixadaFrameArtwork";

export type ArtAssets = { darkLogo: HTMLImageElement; lightLogo: HTMLImageElement };
export type ArtConfiguration = {
  style: ArtStyle;
  format: ArtFormat;
  phrase: ArtPhrase;
  adjustment: PhotoAdjustment;
};
type RenderOptions = ArtConfiguration & { photo: HTMLImageElement | null; assets: ArtAssets };

const GOLD = "#ffc400";
const INK = "#141414";

export function getPhotoFrame(style: ArtStyle, format: ArtFormat): PhotoRect {
  const { height } = ART_FORMATS[format];
  const story = format === "story";
  if (style === "amarela") {
    return { x: 140, y: story ? 340 : 230, width: 800, height: story ? 1050 : 700 };
  }
  if (style === "melodia") {
    return { x: 145, y: story ? 360 : 220, width: 790, height: story ? 1000 : 710 };
  }
  if (style === "quixada") {
    return { x: 105, y: story ? 350 : 228, width: 870, height: story ? 1060 : 735 };
  }
  return {
    x: style === "criativa" ? 98 : 82,
    y: story ? 325 : 234,
    width: style === "criativa" ? 884 : 916,
    height: height - (story ? 830 : 635),
  };
}

function drawStaff(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  for (let line = 0; line < 5; line += 1) {
    ctx.beginPath();
    ctx.moveTo(0, line * 15);
    ctx.bezierCurveTo(110, -90 + line * 15, 220, 100 + line * 15, 410, -50 + line * 15);
    ctx.stroke();
  }
  for (const [noteX, noteY] of [
    [90, -7],
    [218, 33],
    [332, 10],
  ]) {
    ctx.beginPath();
    ctx.ellipse(noteX, noteY, 11, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(noteX + 9, noteY - 54, 3, 54);
  }
  ctx.restore();
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

function drawPhotoPath(ctx: CanvasRenderingContext2D, frame: PhotoRect, style: ArtStyle) {
  ctx.beginPath();
  if (style === "classica") {
    const radius = frame.width / 2;
    ctx.moveTo(frame.x, frame.y + frame.height);
    ctx.lineTo(frame.x, frame.y + radius);
    ctx.arc(frame.x + radius, frame.y + radius, radius, Math.PI, 0);
    ctx.lineTo(frame.x + frame.width, frame.y + frame.height);
    ctx.closePath();
    return;
  }
  if (style === "melodia") {
    ctx.ellipse(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      frame.width / 2,
      frame.height / 2,
      -0.04,
      0,
      Math.PI * 2,
    );
    return;
  }
  if (style === "quixada") {
    ctx.roundRect(frame.x, frame.y, frame.width, frame.height, [110, 34, 110, 34]);
    return;
  }
  ctx.roundRect(
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    style === "leve" ? [185, 32, 185, 32] : 12,
  );
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, frame: PhotoRect, light: boolean) {
  ctx.fillStyle = light ? "#efece5" : "#2b2a26";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.fillStyle = light ? "#d4cec0" : "#49463c";
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height * 0.38;
  ctx.beginPath();
  ctx.arc(centerX, centerY, frame.width * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    frame.y + frame.height,
    frame.width * 0.34,
    frame.height * 0.42,
    0,
    Math.PI,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawFrameArtwork(
  ctx: CanvasRenderingContext2D,
  style: ArtStyle,
  width: number,
  height: number,
  frame: PhotoRect,
) {
  if (style === "classica") {
    const gold = ctx.createLinearGradient(0, 0, width, height);
    gold.addColorStop(0, "#ffcf18");
    gold.addColorStop(0.5, "#b48014");
    gold.addColorStop(1, "#ffe49b");
    ctx.strokeStyle = gold;
    ctx.lineWidth = 32;
    ctx.beginPath();
    ctx.moveTo(-20, height * 0.65);
    ctx.bezierCurveTo(225, height * 0.35, -175, 330, 110, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(950, height);
    ctx.bezierCurveTo(1260, height - 310, 985, height * 0.6, 1110, height * 0.38);
    ctx.stroke();
    drawStaff(ctx, 795, 210, "#b68a26");
    drawStaff(ctx, -110, height - 215, "#9c771f", 0.85);
    return;
  }

  if (style === "leve") {
    ctx.fillStyle = "#fff3bc";
    ctx.beginPath();
    ctx.ellipse(35, 280, 275, 430, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(1060, height - 470, 120, 310, 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e0b300";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(1052, height - 477, 150, 343, 0.55, 0, Math.PI * 2);
    ctx.stroke();
    drawStaff(ctx, -80, height - 180, "#c79b00", 0.8);
    return;
  }

  if (style === "amarela") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    for (let line = 0; line < 4; line += 1) {
      ctx.beginPath();
      ctx.moveTo(-25, 285 + line * 27);
      ctx.bezierCurveTo(130, 190 + line * 27, 250, 430 + line * 27, 410, 310 + line * 27);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    drawSparkle(ctx, 92, 190, 24);
    drawSparkle(ctx, 1005, frame.y + frame.height - 40, 18);
    ctx.strokeStyle = "rgba(20,20,20,.24)";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.roundRect(frame.x + 18, frame.y + 22, frame.width, frame.height, 58);
    ctx.stroke();
    return;
  }

  if (style === "melodia") {
    ctx.fillStyle = "#dff3ff";
    ctx.beginPath();
    ctx.ellipse(785, 410, 285, 390, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0a8";
    ctx.beginPath();
    ctx.ellipse(350, 455, 310, 420, -0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(555, 505, 365, 445, 0.16, 0, Math.PI * 2);
    ctx.fill();
    drawStaff(ctx, -55, 710, INK, 0.82);
    return;
  }

  if (style === "quixada") {
    ctx.fillStyle = "#f7edd8";
    ctx.beginPath();
    ctx.ellipse(925, 245, 250, 330, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9edf2";
    ctx.beginPath();
    ctx.ellipse(95, height - 270, 280, 390, -0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(92, 170, 52, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.strokeStyle = "#f0f0ee";
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 24; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(width / 2, frame.y + frame.height / 2);
  ctx.rotate(-0.035);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-frame.width / 2 - 32, -frame.height / 2 - 32, frame.width + 64, frame.height + 86);
  ctx.restore();
}

/** The same canvas produces the preview and the downloadable PNG. */
export function renderPhotoArt(canvas: HTMLCanvasElement, options: RenderOptions) {
  const { photo, assets, style, format, phrase, adjustment } = options;
  const { width, height } = ART_FORMATS[format];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a arte. Tente abrir em outro navegador.");

  const light = style !== "classica";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = style === "amarela" ? GOLD : light ? "#ffffff" : "#090909";
  ctx.fillRect(0, 0, width, height);
  const frame = getPhotoFrame(style, format);
  drawFrameArtwork(ctx, style, width, height, frame);

  ctx.save();
  drawPhotoPath(ctx, frame, style);
  ctx.clip();
  if (photo) {
    const placement = getPhotoPlacement(photo.naturalWidth, photo.naturalHeight, frame, adjustment);
    ctx.fillStyle = light ? "#eeeae0" : "#242424";
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.drawImage(photo, placement.x, placement.y, placement.width, placement.height);
  } else {
    drawPlaceholder(ctx, frame, light);
  }
  ctx.restore();

  if (style === "criativa") {
    drawYoungFrameArtwork(ctx, { width, height, frame });
  }
  if (style === "quixada") {
    drawQuixadaFrameArtwork(ctx, { width, height, frame });
  }

  if (style === "classica") {
    drawPhotoPath(ctx, frame, style);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (style === "amarela" || style === "melodia" || style === "quixada") {
    drawPhotoPath(ctx, frame, style);
    ctx.strokeStyle = style === "quixada" ? "#ffc400" : "#ffffff";
    ctx.lineWidth = style === "amarela" ? 14 : style === "quixada" ? 6 : 8;
    ctx.stroke();
  }
  ctx.fillStyle = style === "classica" ? GOLD : INK;
  drawSparkle(ctx, style === "criativa" ? 77 : 1000, frame.y + 30, 26);
  if (style === "leve") drawSparkle(ctx, 77, frame.y + frame.height - 60, 20);

  const logo = light ? assets.lightLogo : assets.darkLogo;
  const logoWidth = style === "melodia" ? 330 : 340;
  const logoHeight = (logoWidth * logo.naturalHeight) / logo.naturalWidth;
  const logoX = style === "melodia" ? 58 : (width - logoWidth) / 2;
  if (style === "amarela") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect((width - 440) / 2, format === "story" ? 84 : 14, 440, logoHeight + 28, 52);
    ctx.fill();
  }
  ctx.drawImage(logo, logoX, format === "story" ? 120 : 26, logoWidth, logoHeight);

  const selectedPhrase = ART_PHRASES.find((item) => item.id === phrase) ?? ART_PHRASES[0];
  const lines = selectedPhrase.lines;
  const blockTop = frame.y + frame.height + (style === "criativa" ? 84 : 50);
  const blockHeight = 224;
  let fontSize = lines.length === 1 ? 126 : lines.length === 3 ? 49 : 72;
  const fontFamily = style === "classica" ? "Georgia" : "Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const maxTextWidth = 908;
  const widestLine = Math.max(...lines.map((line) => ctx.measureText(line).width));
  if (widestLine > maxTextWidth) fontSize *= maxTextWidth / widestLine;
  const lineHeight = fontSize * 1.22;
  const firstLineY = blockTop + blockHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = light ? INK : index === lines.length - 1 ? GOLD : "#ffffff";
    if (style === "amarela" && index === lines.length - 1) {
      const measured = ctx.measureText(line).width;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(
        (width - measured) / 2 - 30,
        firstLineY + index * lineHeight - fontSize * 0.55,
        measured + 60,
        fontSize * 1.12,
        fontSize * 0.5,
      );
      ctx.fill();
      ctx.fillStyle = "#ffffff";
    } else if (light && index === lines.length - 1) {
      const measured = ctx.measureText(line).width;
      ctx.fillStyle = GOLD;
      ctx.fillRect(
        (width - measured) / 2 - 12,
        firstLineY + index * lineHeight + fontSize * 0.1,
        measured + 24,
        fontSize * 0.42,
      );
      ctx.fillStyle = INK;
    }
    ctx.fillText(line, width / 2, firstLineY + index * lineHeight);
  });

  ctx.fillStyle = light ? "#323232" : "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.fillText("QUIXADÁ · CEARÁ", width / 2, height - (format === "story" ? 165 : 86));
  ctx.font = "23px Arial";
  ctx.fillText("20 a 22 de novembro de 2026", width / 2, height - (format === "story" ? 126 : 47));
}
