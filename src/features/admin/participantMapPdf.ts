import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { adminPdfLogoBase64 } from "./admin-pdf-logo";
import { CEARA_PATH, CEARA_VIEWBOX, projectCeara } from "./cearaGeo";
import type { ParticipantCount, ParticipantMapData } from "./participantMap.domain";

export type ParticipantMapPdfFile = { fileName: string; base64: string };

const ink = rgb(0.10, 0.12, 0.16);
const muted = rgb(0.40, 0.43, 0.48);
const rule = rgb(0.84, 0.86, 0.89);
const shade = rgb(0.96, 0.97, 0.98);
const accent = rgb(0.11, 0.42, 0.66);
const accents = [rgb(0.11, 0.42, 0.66), rgb(0.13, 0.58, 0.46), rgb(0.75, 0.45, 0.12), rgb(0.55, 0.30, 0.62)];

function printable(value: string, font: PDFFont): string {
  return Array.from(value.normalize("NFC").replace(/[\r\n\t]/g, " "))
    .map((char) => {
      try { font.encodeText(char); return char; } catch { return "?"; }
    })
    .join("");
}

function wrap(value: string, width: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of printable(value || "—", font)) {
    if (line && font.widthOfTextAtSize(line + char, size) > width) {
      const space = line.lastIndexOf(" ");
      if (space > 0) { lines.push(line.slice(0, space)); line = line.slice(space + 1); }
      else { lines.push(line); line = ""; }
    }
    line += char;
  }
  if (line) lines.push(line.trim());
  return lines.length ? lines : ["—"];
}

function drawHeader(page: PDFPage, logo: Awaited<ReturnType<PDFDocument["embedPng"]>>, title: string, subtitle: string, font: PDFFont, bold: PDFFont) {
  const size = logo.scaleToFit(74, 44);
  page.drawImage(logo, { x: 34, y: 536, ...size });
  page.drawText(printable("II Encontro de Coros Diocesanos e Litúrgicos do Ceará", font), {
    x: 120, y: 558, font: bold, size: 13, color: ink,
  });
  page.drawText(printable(title, font), { x: 120, y: 539, font: bold, size: 11, color: accent });
  page.drawText(printable(subtitle, font), { x: 120, y: 523, font, size: 8, color: muted });
  page.drawLine({ start: { x: 34, y: 512 }, end: { x: 808, y: 512 }, thickness: 1, color: rule });
}

function drawBars(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  title: string,
  items: ParticipantCount[],
  font: PDFFont,
  bold: PDFFont,
  color = accent,
  rowHeight = 22,
) {
  page.drawText(printable(title, font), { x, y, font: bold, size: 11, color: ink });
  const max = Math.max(1, ...items.map((item) => item.value));
  items.slice(0, 10).forEach((item, index) => {
    const top = y - 18 - index * rowHeight;
    page.drawText(printable(item.label, font), { x, y: top, font, size: 8, color: ink });
    page.drawText(String(item.value), { x: x + width, y: top, font: bold, size: 8, color: ink });
    const barWidth = Math.max(2, (item.value / max) * (width - 92));
    page.drawRectangle({ x: x + 88, y: top - 1, width: width - 92, height: 9, color: shade });
    page.drawRectangle({ x: x + 88, y: top - 1, width: barWidth, height: 9, color });
  });
  return y - 20 - Math.min(items.length, 10) * rowHeight;
}

async function embedRegentPhoto(doc: PDFDocument, url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 5_000_000) return null;
    try { return await doc.embedJpg(bytes); } catch { return await doc.embedPng(bytes); }
  } catch {
    return null;
  }
}

/** Server-side infographic: summary charts, Ceará map and one section per choir. */
export async function buildParticipantMapInfographic(data: ParticipantMapData): Promise<ParticipantMapPdfFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(adminPdfLogoBase64);
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza", dateStyle: "long", timeStyle: "short",
  }).format(new Date(data.generatedAt));
  doc.setTitle("Mapa dos participantes | II Encontro de Coros");
  doc.setCreationDate(new Date(data.generatedAt));

  // Page 1 — general overview.
  let page = doc.addPage([842, 595]);
  drawHeader(page, logo, "Mapa geral dos participantes", `Emitido em ${date}`, font, bold);

  const metrics = [
    { label: "Participantes confirmados", value: String(data.total) },
    { label: "Coros", value: String(data.choirs.length) },
    { label: "Dioceses", value: String(data.dioceses.length) },
    { label: "Mulheres", value: String(data.genders.find((item) => item.key === "feminino")?.value ?? 0) },
    { label: "Homens", value: String(data.genders.find((item) => item.key === "masculino")?.value ?? 0) },
  ];
  metrics.forEach((metric, index) => {
    const width = 146;
    const x = 34 + index * (width + 8);
    page.drawRectangle({ x, y: 448, width, height: 48, color: shade });
    page.drawText(printable(metric.label, font), { x: x + 9, y: 479, font, size: 7, color: muted });
    page.drawText(metric.value, { x: x + 9, y: 458, font: bold, size: 19, color: ink });
  });

  drawBars(page, 34, 424, 214, "Distribuição por gênero", data.genders, font, bold, accent, 24);
  drawBars(page, 278, 424, 214, "Naipes", data.voices, font, bold, accents[1], 21);
  drawBars(page, 522, 424, 286, "Faixa etária", data.ageBands, font, bold, accents[3], 20);
  page.drawText(
    printable(
      `${data.inferredGenderCount} gênero(s) estimado(s) pelo nome; o gênero informado tem prioridade.`,
      font,
    ),
    { x: 34, y: 315, font, size: 7, color: muted },
  );

  // Ceará map with one point per diocese seat.
  const scale = 0.24;
  const mapX = 45;
  const mapY = 28;
  page.drawSvgPath(CEARA_PATH, {
    x: mapX, y: mapY, scale,
    color: rgb(0.93, 0.96, 0.99),
    borderColor: accent,
    borderWidth: 2.5,
  });
  const largest = Math.max(1, ...data.dioceses.map((item) => item.total));
  for (const seat of data.dioceses) {
    const point = projectCeara(seat.latitude, seat.longitude);
    const cx = mapX + point.x * scale;
    const cy = mapY + (CEARA_VIEWBOX.height - point.y) * scale;
    const radius = 5 + (seat.total / largest) * 17;
    const isCentral = seat.city === "Quixadá";
    if (isCentral) {
      page.drawCircle({ x: cx, y: cy, size: radius + 4, color: accent, opacity: 0.9 });
    }
    page.drawCircle({ x: cx, y: cy, size: radius, color: rgb(0.86, 0.36, 0.22), opacity: 0.75 });
    page.drawCircle({ x: cx, y: cy, size: 3, color: rgb(1, 1, 1) });
    if (isCentral) {
      page.drawText("QUIXADA - SEDE CENTRAL", {
        x: cx + radius + 5,
        y: cy - 2,
        font: bold,
        size: 5.6,
        color: ink,
      });
    }
  }
  page.drawText(printable("Participantes por sede diocesana", font), {
    x: 260, y: 250, font: bold, size: 11, color: ink,
  });
  data.dioceses.forEach((seat, index) => {
    const row = 230 - index * 20;
    if (row < 40) return;
    page.drawCircle({ x: 266, y: row + 2, size: 4, color: rgb(0.86, 0.36, 0.22) });
    page.drawText(printable(`${seat.city} · ${seat.diocese}`, font), {
      x: 278, y: row, font, size: 8, color: ink,
    });
    page.drawText(`${seat.choirs} coro(s) · ${seat.total}`, {
      x: 278, y: row - 9, font, size: 7, color: muted,
    });
  });

  // Pages 2+ — one card per choir with voices and the regent photo.
  const perPage = 4;
  for (let start = 0; start < data.choirs.length; start += perPage) {
    page = doc.addPage([842, 595]);
    drawHeader(page, logo, "Participantes por coro", `Página ${Math.floor(start / perPage) + 1} · ${data.choirs.length} coros`, font, bold);
    const group = data.choirs.slice(start, start + perPage);
    for (let index = 0; index < group.length; index += 1) {
      const choir = group[index];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 34 + column * 398;
      const y = 490 - row * 232;
      page.drawRectangle({ x, y: y - 212, width: 378, height: 212, color: shade });
      page.drawText(printable(choir.choirName, font), { x: x + 14, y: y - 20, font: bold, size: 12, color: ink });
      page.drawText(printable(`${choir.total} participantes · ${choir.diocese ?? "Sem diocese"}`, font), {
        x: x + 14, y: y - 36, font, size: 8, color: muted,
      });
      let photo: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null = null;
      if (choir.regentPhotoUrl) photo = await embedRegentPhoto(doc, choir.regentPhotoUrl);
      if (photo) {
        const size = photo.scaleToFit(62, 62);
        page.drawImage(photo, { x: x + 14, y: y - 108, ...size });
      } else {
        page.drawRectangle({ x: x + 14, y: y - 108, width: 62, height: 62, color: rgb(0.88, 0.90, 0.93) });
        const initials = printable((choir.regentName ?? "?").split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(), font);
        page.drawText(initials, { x: x + 30, y: y - 80, font: bold, size: 16, color: accent });
      }
      page.drawText(printable("Regente", font), { x: x + 88, y: y - 60, font, size: 7, color: muted });
      page.drawText(printable(choir.regentName ?? "Não informado", font), {
        x: x + 88, y: y - 76, font: bold, size: 10, color: ink,
      });
      page.drawText(printable(choir.city ? `Sede: ${choir.city}` : "Sem localização", font), {
        x: x + 88, y: y - 90, font, size: 8, color: muted,
      });
      drawBars(page, x + 14, y - 122, 348, "Naipes", choir.voices, font, bold, accents[index % accents.length], 16);
    }
  }
  if (data.choirs.length === 0) {
    page = doc.addPage([842, 595]);
    drawHeader(page, logo, "Participantes por coro", "Sem coros confirmados", font, bold);
    page.drawText("Nenhuma inscrição confirmada para exibir.", { x: 40, y: 460, font, size: 12, color: ink });
  }

  const bytes = await doc.save();
  return {
    fileName: `mapa-participantes-${new Date(data.generatedAt).toISOString().slice(0, 10)}.pdf`,
    base64: Buffer.from(bytes).toString("base64"),
  };
}
