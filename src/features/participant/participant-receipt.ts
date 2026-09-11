import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import eventLogoUrl from "@/assets/logo-coros-preto.png";

import type { ParticipantRegistrationView } from "./participant.domain";

const EVENT_NAME = "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB";
const DOCUMENT_TITLE = "Comprovante de inscrição - II Encontro de Coros";

type ReceiptResult = {
  bytes: Uint8Array;
  filename: string;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const paymentDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function sanitizeOrderCode(orderCode: string): string {
  return (
    orderCode
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "pagamento"
  );
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
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

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    maxWidth: number;
    lineHeight: number;
    color?: ReturnType<typeof rgb>;
  },
): number {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });
  return options.y - lines.length * options.lineHeight;
}

function formatMoney(value: number): string {
  return moneyFormatter.format(value / 100).replace(/\u00a0/g, " ");
}

function formatPaymentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid payment date");
  const parts = paymentDateFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${read("day")}/${read("month")}/${read("year")} às ${read("hour")}:${read("minute")}`;
}

function drawDetail(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  label: string,
  value: string,
  y: number,
): number {
  page.drawText(label.toUpperCase(), {
    x: 64,
    y,
    size: 8.5,
    font: fonts.bold,
    color: rgb(0.42, 0.4, 0.35),
  });
  const nextY = drawWrappedText(page, value, {
    x: 205,
    y: y - 1,
    size: 11,
    font: fonts.regular,
    maxWidth: 325,
    lineHeight: 14,
    color: rgb(0.12, 0.11, 0.09),
  });
  page.drawLine({
    start: { x: 64, y: nextY - 5 },
    end: { x: 531, y: nextY - 5 },
    thickness: 0.5,
    color: rgb(0.88, 0.86, 0.8),
  });
  return nextY - 20;
}

function requiredPayment(view: ParticipantRegistrationView) {
  const { orderNsu, paidAmountCents, paidAt } = view.payment;
  if (!orderNsu?.trim() || paidAmountCents == null || paidAmountCents < 0 || !paidAt) {
    throw new Error("Incomplete payment receipt data");
  }
  return { orderNsu: orderNsu.trim(), paidAmountCents, paidAt };
}

export async function buildParticipantReceipt(
  view: ParticipantRegistrationView,
  logoBytes: Uint8Array,
): Promise<ReceiptResult> {
  const payment = requiredPayment(view);
  const document = await PDFDocument.create();
  document.setTitle(DOCUMENT_TITLE);
  document.setAuthor(EVENT_NAME);
  document.setSubject("Comprovante de pagamento da inscrição");
  document.setKeywords(["comprovante", "inscrição", "pagamento", "encontro de coros"]);

  const page = document.addPage(PageSizes.A4);
  const [width, height] = PageSizes.A4;
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(Uint8Array.from(logoBytes));
  const logoSize = logo.scaleToFit(105, 72);
  const ink = rgb(0.12, 0.11, 0.09);
  const muted = rgb(0.42, 0.4, 0.35);
  const accent = rgb(0.45, 0.12, 0.08);

  page.drawRectangle({
    x: 0,
    y: height - 166,
    width,
    height: 166,
    color: rgb(0.97, 0.95, 0.89),
  });
  page.drawImage(logo, {
    x: 48,
    y: height - 48 - logoSize.height,
    width: logoSize.width,
    height: logoSize.height,
  });
  drawWrappedText(page, EVENT_NAME, {
    x: 178,
    y: height - 49,
    size: 14,
    font: bold,
    maxWidth: 365,
    lineHeight: 18,
    color: ink,
  });
  page.drawText("20 a 22 de novembro de 2026 - Quixadá, Ceará", {
    x: 178,
    y: height - 111,
    size: 9.5,
    font: regular,
    color: muted,
  });
  page.drawRectangle({ x: 0, y: height - 170, width, height: 4, color: accent });

  page.drawText("Comprovante de pagamento", {
    x: 48,
    y: height - 218,
    size: 23,
    font: bold,
    color: ink,
  });
  page.drawText("Inscrição confirmada", {
    x: 49,
    y: height - 241,
    size: 10.5,
    font: regular,
    color: muted,
  });
  page.drawRectangle({
    x: width - 116,
    y: height - 239,
    width: 68,
    height: 28,
    color: rgb(0.87, 0.94, 0.88),
    borderColor: rgb(0.27, 0.51, 0.31),
    borderWidth: 0.8,
  });
  page.drawText("PAGO", {
    x: width - 96,
    y: height - 229,
    size: 10,
    font: bold,
    color: rgb(0.17, 0.38, 0.21),
  });

  page.drawText("PARTICIPANTE", {
    x: 48,
    y: height - 294,
    size: 9,
    font: bold,
    color: accent,
  });
  page.drawRectangle({
    x: 48,
    y: height - 399,
    width: width - 96,
    height: 88,
    color: rgb(0.995, 0.992, 0.98),
    borderColor: rgb(0.86, 0.83, 0.75),
    borderWidth: 0.8,
  });
  page.drawText("Nome", { x: 64, y: height - 337, size: 8.5, font: bold, color: muted });
  drawWrappedText(page, view.identity.name, {
    x: 130,
    y: height - 338,
    size: 12,
    font: bold,
    maxWidth: 385,
    lineHeight: 15,
    color: ink,
  });
  page.drawText("CPF", { x: 64, y: height - 376, size: 8.5, font: bold, color: muted });
  page.drawText(view.identity.cpf, {
    x: 130,
    y: height - 377,
    size: 11,
    font: regular,
    color: ink,
  });

  page.drawText("DETALHES DO PAGAMENTO", {
    x: 48,
    y: height - 433,
    size: 9,
    font: bold,
    color: accent,
  });
  let detailY = height - 467;
  detailY = drawDetail(page, { regular, bold }, "Situação", "Pago", detailY);
  detailY = drawDetail(
    page,
    { regular, bold },
    "Forma de pagamento",
    view.payment.paymentMethod === "pix"
      ? "Pix"
      : view.payment.paymentMethod === "credit_card"
        ? "Cartão de crédito"
        : "Não informado",
    detailY,
  );
  detailY = drawDetail(
    page,
    { regular, bold },
    "Parcelas",
    view.payment.installments == null ? "Não informado" : `${view.payment.installments}x`,
    detailY,
  );
  detailY = drawDetail(
    page,
    { regular, bold },
    "Valor pago",
    formatMoney(payment.paidAmountCents),
    detailY,
  );
  detailY = drawDetail(
    page,
    { regular, bold },
    "Pago em",
    `${formatPaymentDate(payment.paidAt)} (horário de Fortaleza)`,
    detailY,
  );
  drawDetail(page, { regular, bold }, "Código do pedido", payment.orderNsu, detailY);

  page.drawText("Este comprovante foi gerado na área segura do participante.", {
    x: 48,
    y: 45,
    size: 8.5,
    font: regular,
    color: muted,
  });
  page.drawText("Guarde este documento para referência.", {
    x: 48,
    y: 31,
    size: 8.5,
    font: regular,
    color: muted,
  });
  return {
    bytes: await document.save(),
    filename: `comprovante-inscricao-${sanitizeOrderCode(payment.orderNsu)}.pdf`,
  };
}

export async function downloadParticipantReceipt(view: ParticipantRegistrationView): Promise<void> {
  const logoResponse = await fetch(eventLogoUrl);
  if (!logoResponse.ok) throw new Error("Unable to load receipt logo");
  const receipt = await buildParticipantReceipt(
    view,
    new Uint8Array(await logoResponse.arrayBuffer()),
  );
  const blob = new Blob([receipt.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;

  try {
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = receipt.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
