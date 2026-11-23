import eventLogoUrl from "@/assets/logo-coros-diocesanos-regional.png";
import { getPublicParticipantCard } from "@/lib/public-attendance.functions";
import type { PublicParticipantCard } from "./publicAttendance.domain";

type CardLink = { name: string; choirName: string; token: string };
type ZipFile = { name: string; bytes: Uint8Array };

const WIDTH = 1080;
const HEIGHT = 1920;
const palette = { ink: "#2e2428", muted: "#72676b", wine: "#672c3e", gold: "#b58a33", paper: "#faf7f0" };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar uma imagem do cartão."));
    image.src = src;
  });
}

function wrapText(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      context.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) context.fillText(line, x, y + lines * lineHeight);
  return lines + (line ? 1 : 0);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

async function renderCard(card: PublicParticipantCard): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar as imagens dos cartões.");

  context.fillStyle = palette.paper;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = palette.gold;
  context.fillRect(0, 0, WIDTH, 12);
  context.strokeStyle = "#ded6ca";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(78, 294);
  context.lineTo(1002, 294);
  context.stroke();

  const logo = await loadImage(eventLogoUrl);
  const logoScale = Math.min(350 / logo.width, 130 / logo.height);
  context.drawImage(logo, 78, 42, logo.width * logoScale, logo.height * logoScale);
  context.fillStyle = palette.muted;
  context.font = "bold 24px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText("II ENCONTRO DE COROS · QUIXADÁ 2026", WIDTH / 2, 256);

  const photoX = 170;
  const photoY = 465;
  const photoRadius = 132;
  context.fillStyle = "#f0eae0";
  context.strokeStyle = palette.gold;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  if (card.photoUrl) {
    try {
      const photo = await loadImage(card.photoUrl);
      context.save();
      context.beginPath();
      context.arc(photoX, photoY, photoRadius - 8, 0, Math.PI * 2);
      context.clip();
      const crop = Math.max((photoRadius * 2 - 16) / photo.width, (photoRadius * 2 - 16) / photo.height);
      const width = photo.width * crop;
      const height = photo.height * crop;
      context.drawImage(photo, photoX - width / 2, photoY - height * 0.38, width, height);
      context.restore();
    } catch {
      context.fillStyle = palette.wine;
      context.font = "64px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(initials(card.name), photoX, photoY);
    }
  } else {
    context.fillStyle = palette.wine;
    context.font = "64px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initials(card.name), photoX, photoY);
  }

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = palette.wine;
  context.font = "bold 22px Segoe UI, sans-serif";
  context.fillText("PARTICIPANTE", 365, 365);
  context.fillStyle = palette.ink;
  context.font = card.name.length > 28 ? "38px Georgia, serif" : "48px Georgia, serif";
  const nameLines = wrapText(context, card.name, 365, 422, 635, 58, 2);
  context.fillStyle = palette.muted;
  context.font = "28px Segoe UI, sans-serif";
  const choirY = 422 + nameLines * 58 + 4;
  const choirLines = wrapText(context, card.choirName, 365, choirY, 635, 38, 3);
  if (card.fullName && card.fullName !== card.name) {
    context.font = "23px Segoe UI, sans-serif";
    wrapText(context, card.fullName, 365, choirY + choirLines * 38 + 12, 635, 32, 2);
  }

  const qr = await loadImage(card.qrDataUrl);
  const qrSize = 700;
  const qrX = (WIDTH - qrSize) / 2;
  const qrY = 630;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#ded6ca";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 28);
  context.fill();
  context.stroke();
  context.drawImage(qr, qrX, qrY, qrSize, qrSize);

  context.fillStyle = palette.wine;
  context.font = "bold 24px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText("APRESENTE ESTE QR CODE EM CADA ATIVIDADE", WIDTH / 2, 1380);
  if (card.lodging) {
    context.strokeStyle = palette.gold;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(78, 1435);
    context.lineTo(1002, 1435);
    context.stroke();
    context.textAlign = "left";
    context.fillStyle = palette.wine;
    context.font = "bold 24px Segoe UI, sans-serif";
    context.fillText("SUA ACOMODAÇÃO", 78, 1485);
    context.fillStyle = palette.ink;
    context.font = "bold 48px Segoe UI, sans-serif";
    wrapText(context, card.lodging.room, 78, 1540, 924, 58, 1);
    context.fillStyle = palette.muted;
    context.font = "25px Segoe UI, sans-serif";
    if (card.lodging.location) context.fillText(card.lodging.location, 78, 1595);
    if (card.lodging.roommates.length) {
      context.fillStyle = palette.ink;
      context.font = "bold 27px Segoe UI, sans-serif";
      context.fillText("Com você:", 78, 1650);
      context.font = "24px Segoe UI, sans-serif";
      wrapText(context, card.lodging.roommates.join(" · "), 78, 1690, 924, 32, 3);
    }
  }

  context.textAlign = "center";
  context.fillStyle = palette.muted;
  context.font = "24px Segoe UI, sans-serif";
  context.fillText("20–22 NOV 2026 · QUIXADÁ, CE", WIDTH / 2, 1850);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível criar a imagem do cartão.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipImages(files: ZipFile[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length + file.bytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(file.bytes, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end].map(part => new Uint8Array(part)), { type: "application/zip" });
}

function fileStem(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "participante";
}

export async function downloadAllParticipantCardImages(cards: CardLink[], onProgress: (done: number, total: number) => void) {
  const files: ZipFile[] = new Array(cards.length);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    for (;;) {
      const index = nextIndex++;
      if (index >= cards.length) return;
      const row = cards[index];
      const card = await getPublicParticipantCard({ data: { token: row.token } });
      const bytes = await renderCard(card);
      const number = String(index + 1).padStart(3, "0");
      files[index] = { name: `${number}-${fileStem(row.name)}-${row.token.slice(0, 8)}.png`, bytes };
      completed += 1;
      onProgress(completed, cards.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, cards.length) }, worker));
  const url = URL.createObjectURL(zipImages(files));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cartoes-participantes-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
