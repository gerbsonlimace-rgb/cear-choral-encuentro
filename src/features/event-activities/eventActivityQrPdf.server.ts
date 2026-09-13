import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type QrPdfActivity = {
  title: string;
  activityDate: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  qrPngDataUrl: string;
};

export type QrPdfInput = {
  generatedAt: Date;
  logoBytes: Uint8Array;
  activities: QrPdfActivity[];
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("O QR Code gerado não é uma imagem PNG válida.");
  return Uint8Array.from(Buffer.from(match[1], "base64"));
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCenteredLines(
  page: PDFPage,
  lines: string[],
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.09, 0.09, 0.11),
) {
  const pageWidth = page.getWidth();
  lines.forEach((line, index) => {
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: (pageWidth - width) / 2, y: y - index * (size + 5), size, font, color });
  });
}

function formatDateTime(activity: QrPdfActivity): string {
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${activity.activityDate}T12:00:00Z`));
  const time = activity.startsAt
    ? activity.endsAt
      ? `${activity.startsAt} às ${activity.endsAt}`
      : activity.startsAt
    : "Horário livre";
  return `${date} • ${time}`;
}

export async function buildEventActivityQrPdf(input: QrPdfInput) {
  if (input.activities.length === 0) {
    throw new Error("Nenhuma atividade ativa com QR Code está disponível para impressão.");
  }

  const document = await PDFDocument.create();
  document.setTitle("QR Codes da programação — Encontro de Coros do Ceará");
  document.setAuthor("Encontro de Coros do Ceará");
  document.setCreator("Painel administrativo do Encontro de Coros do Ceará");
  document.setCreationDate(input.generatedAt);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(input.logoBytes);

  for (const activity of input.activities) {
    const page = document.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const logoWidth = 110;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, {
      x: (width - logoWidth) / 2,
      y: height - 58 - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    page.drawLine({
      start: { x: 48, y: height - 125 },
      end: { x: width - 48, y: height - 125 },
      thickness: 1,
      color: rgb(0.88, 0.86, 0.82),
    });

    const titleLines = wrapText(activity.title, bold, 24, width - 96).slice(0, 3);
    drawCenteredLines(page, titleLines, height - 175, bold, 24);
    const titleBottom = height - 175 - (titleLines.length - 1) * 29;
    drawCenteredLines(page, [formatDateTime(activity)], titleBottom - 38, regular, 13, rgb(0.32, 0.32, 0.35));
    if (activity.location) {
      drawCenteredLines(
        page,
        wrapText(activity.location, regular, 12, width - 120).slice(0, 2),
        titleBottom - 64,
        regular,
        12,
        rgb(0.32, 0.32, 0.35),
      );
    }

    const qr = await document.embedPng(dataUrlToBytes(activity.qrPngDataUrl));
    const qrSize = 330;
    page.drawImage(qr, {
      x: (width - qrSize) / 2,
      y: 205,
      width: qrSize,
      height: qrSize,
    });
    drawCenteredLines(page, ["Escaneie para confirmar sua presença"], 165, bold, 14);
    drawCenteredLines(
      page,
      ["Abra o leitor no Portal do Participante"],
      137,
      regular,
      11,
      rgb(0.38, 0.38, 0.4),
    );
    page.drawText("encontrocorosce.com.br", {
      x: 48,
      y: 44,
      size: 9,
      font: regular,
      color: rgb(0.45, 0.45, 0.47),
    });
  }

  return {
    bytes: await document.save(),
    filename: `qrcodes-programacao-${input.generatedAt.toISOString().slice(0, 10)}.pdf`,
  };
}
