import QRCode from "qrcode";

import backgroundUrl from "@/assets/raffle-share-background.png";
import logoUrl from "@/assets/logo-coros-diocesanos-regional.png";

import { createPixBrCode } from "./pixBrCode";

export type RaffleShareArtInput = {
  choirName: string;
  displayName: string;
  pixKey: string;
  city: string;
};

const W = 1080;
const H = 1920;
const PREVIEW_HEIGHT = 1560;
const ink = "#211b17";
const gold = "#d99400";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a arte do encontro."));
    image.src = src;
  });
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function centered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color = ink,
) {
  centeredAt(ctx, text, W / 2, y, font, color);
}

function centeredAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color = ink,
) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let chunk = "";
      for (const char of word) {
        if (chunk && ctx.measureText(chunk + char).width > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else chunk += char;
      }
      line = chunk;
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function calendarIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeRect(x, y + 7, 29, 27);
  ctx.beginPath();
  ctx.moveTo(x, y + 16);
  ctx.lineTo(x + 29, y + 16);
  ctx.moveTo(x + 7, y + 1);
  ctx.lineTo(x + 7, y + 11);
  ctx.moveTo(x + 22, y + 1);
  ctx.lineTo(x + 22, y + 11);
  ctx.stroke();
  ctx.restore();
}

function trophyIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "#ffd95e";
  ctx.fillStyle = "#e8a817";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x + 12, y);
  ctx.lineTo(x + 84, y);
  ctx.lineTo(x + 76, y + 61);
  ctx.quadraticCurveTo(x + 48, y + 94, x + 20, y + 61);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 12, y + 22, 26, Math.PI / 2, Math.PI * 1.5);
  ctx.arc(x + 84, y + 22, 26, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillRect(x + 44, y + 85, 8, 22);
  ctx.fillRect(x + 23, y + 106, 50, 8);
  ctx.restore();
}

async function createRaffleCanvas(choirName: string, height: number) {
  await document.fonts?.ready;
  const [background, logo] = await Promise.all([
    loadImage(backgroundUrl),
    loadImage(logoUrl),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu criar a imagem. Tente outro navegador.");

  ctx.drawImage(background, 0, 0, W, H);
  const paper = ctx.createLinearGradient(0, 0, 0, 1230);
  paper.addColorStop(0, "rgba(255,251,238,.45)");
  paper.addColorStop(0.72, "rgba(255,251,238,.85)");
  paper.addColorStop(1, "rgba(255,251,238,.15)");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, 1260);

  ctx.drawImage(logo, 210, 20, 660, 363);
  centered(ctx, "RIFA", 473, '800 126px "Cinzel", Georgia, serif');
  centered(ctx, "BENEFICENTE", 550, '800 78px "Cinzel", Georgia, serif', gold);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(300, 574);
  ctx.lineTo(780, 574);
  ctx.stroke();

  centered(ctx, "Ajude o", 636, '700 39px "Manrope", sans-serif');
  let choirSize = 58;
  let choirLines: string[];
  do {
    ctx.font = `800 ${choirSize}px "Cinzel", Georgia, serif`;
    choirLines = wrap(ctx, choirName, 900);
    choirSize -= 2;
  } while (choirLines.length > 2 && choirSize >= 38);
  const choirLineHeight = Math.min(68, choirSize + 12);
  choirLines.forEach((line, i) =>
    centered(
      ctx,
      line,
      705 + i * choirLineHeight,
      `800 ${choirSize + 2}px "Cinzel", Georgia, serif`,
    ),
  );
  const afterChoir = 705 + choirLines.length * choirLineHeight + 5;
  centered(ctx, "a participar do", afterChoir, '600 32px "Manrope", sans-serif');
  centered(
    ctx,
    "II Encontro de Coros Diocesanos e Litúrgicos",
    afterChoir + 40,
    '700 30px "Manrope", sans-serif',
  );
  centered(
    ctx,
    "do Regional Nordeste 1 – CNBB!",
    afterChoir + 78,
    '800 33px "Manrope", sans-serif',
    "#9a6500",
  );

  const dateY = Math.max(878, afterChoir + 105);
  ctx.fillStyle = "rgba(255,211,102,.94)";
  rounded(ctx, 208, dateY, 664, 54, 12);
  ctx.fill();
  calendarIcon(ctx, 267, dateY + 9);
  centered(ctx, "Sorteio: 08/11/2026", dateY + 38, '800 34px "Manrope", sans-serif');

  const offerY = dateY + 80;
  const photoY = Math.max(1130, offerY + 164);

  ctx.fillStyle = "#ffd356";
  rounded(ctx, 52, offerY, 460, 142, 24);
  ctx.fill();
  ctx.strokeStyle = "#8e5c00";
  ctx.lineWidth = 4;
  ctx.stroke();
  centeredAt(ctx, "R$ 10,00", 282, offerY + 68, '900 65px "Cinzel", Georgia, serif');
  centeredAt(ctx, "por rifa", 282, offerY + 116, '800 34px "Manrope", sans-serif');

  ctx.fillStyle = "#211c19";
  rounded(ctx, 531, offerY, 497, 142, 24);
  ctx.fill();
  ctx.strokeStyle = "#ffd356";
  ctx.lineWidth = 4;
  ctx.stroke();
  trophyIcon(ctx, 556, offerY + 12);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff7df";
  ctx.font = '700 32px "Manrope", sans-serif';
  ctx.fillText("Prêmio", 690, offerY + 52);
  ctx.fillStyle = "#ffd356";
  ctx.font = '900 51px "Cinzel", Georgia, serif';
  ctx.fillText("R$ 1.000,00", 686, offerY + 110, 310);

  // Give the choir its own unobstructed photo area between the offer and Pix details.
  ctx.fillStyle = "#fff7e8";
  ctx.fillRect(0, photoY, W, H - photoY);
  const photoHeight = Math.min(420, 1560 - photoY);
  const cropHeight = (background.width * photoHeight) / W;
  ctx.drawImage(
    background,
    0,
    background.height * 0.68,
    background.width,
    cropHeight,
    0,
    photoY,
    W,
    photoHeight,
  );
  ctx.strokeStyle = "#d99400";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, photoY);
  ctx.lineTo(W, photoY);
  ctx.moveTo(0, photoY + photoHeight);
  ctx.lineTo(W, photoY + photoHeight);
  ctx.stroke();

  const pixY = photoY + photoHeight + 20;
  return { canvas, ctx, pixY };
}

/** Preview only: the logged-in choir is rendered without any example Pix details. */
export async function createRaffleSharePreviewImage(choirName: string): Promise<string> {
  const { canvas } = await createRaffleCanvas(choirName, PREVIEW_HEIGHT);
  return canvas.toDataURL("image/png");
}

/** Renders the participant's own shareable 1080×1920 PNG. No Pix data is uploaded. */
export async function createRaffleShareImage(input: RaffleShareArtInput): Promise<File> {
  const code = createPixBrCode({ key: input.pixKey, name: input.displayName, city: input.city });
  const [{ canvas, ctx, pixY }, qr] = await Promise.all([
    createRaffleCanvas(input.choirName, H),
    QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 2, width: 500 }).then(loadImage),
  ]);
  ctx.fillStyle = "rgba(255,255,255,.98)";
  rounded(ctx, 52, pixY, 976, H - pixY - 22, 30);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#805300";
  ctx.font = '800 31px "Manrope", sans-serif';
  ctx.fillText("PAGUE COM PIX", 105, pixY + 54);
  ctx.fillStyle = ink;
  let displaySize = 37;
  let displayLines: string[];
  do {
    ctx.font = `800 ${displaySize}px "Manrope", sans-serif`;
    displayLines = wrap(ctx, input.displayName, 600);
    displaySize -= 2;
  } while (displayLines.length > 2 && displaySize >= 25);
  displayLines.forEach((line, i) => ctx.fillText(line, 105, pixY + 107 + i * 38));
  ctx.fillStyle = "#705a42";
  ctx.font = '700 27px "Manrope", sans-serif';
  ctx.fillText("Chave Pix", 105, pixY + 192);
  ctx.fillStyle = ink;
  let keySize = 31;
  let keyLines: string[];
  do {
    ctx.font = `700 ${keySize}px "Manrope", sans-serif`;
    keyLines = wrap(ctx, input.pixKey, 600);
    keySize -= 2;
  } while (keyLines.length > 3 && keySize >= 23);
  keyLines.forEach((line, i) => ctx.fillText(line, 105, pixY + 232 + i * 35));
  ctx.fillStyle = "#fff";
  rounded(ctx, 736, pixY + 23, 272, 272, 14);
  ctx.fill();
  ctx.drawImage(qr, 742, pixY + 29, 260, 260);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Não foi possível salvar a imagem.")),
      "image/png",
    ),
  );
  return new File([blob], "rifa-beneficente-encontro-de-coros.png", { type: "image/png" });
}
