export type ReceiptData = {
  orderNsu?: string;
  participantName?: string;
  choirName?: string;
  paymentMethod: "pix" | "credit_card";
  installments: number;
  amountCents?: number;
  paidAmountCents?: number;
  paidAt?: string;
};

export const RECEIPT_ITEM_DESCRIPTION = "Inscrição — II Encontro de Coros Diocesanos e Litúrgicos";

export function formatCurrencyBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPaymentMethod(method: "pix" | "credit_card", installments: number) {
  if (method === "pix") return "Pix";
  return `Cartão em ${installments} ${installments === 1 ? "parcela" : "parcelas"}`;
}

export function formatPaidAt(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatOrderCode(orderNsu: string | undefined) {
  if (!orderNsu) return undefined;
  return orderNsu.split("-")[0]?.toUpperCase();
}

export function buildReceiptRows(receipt: ReceiptData) {
  const paidCents = receipt.paidAmountCents ?? receipt.amountCents;

  return [
    { label: "Participante", value: receipt.participantName },
    { label: "Coro", value: receipt.choirName },
    { label: "Tipo", value: RECEIPT_ITEM_DESCRIPTION },
    {
      label: "Valor pago",
      value: paidCents !== undefined ? formatCurrencyBRL(paidCents) : undefined,
    },
    {
      label: "Forma de pagamento",
      value: formatPaymentMethod(receipt.paymentMethod, receipt.installments),
    },
    { label: "Data e hora", value: formatPaidAt(receipt.paidAt) },
    { label: "Código do pedido", value: formatOrderCode(receipt.orderNsu) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
}

export const PARTICIPANT_AREA_PATH = "/participante";

async function loadEventLogoDataUrl(): Promise<string | undefined> {
  try {
    const logoUrl = (await import("@/assets/logo-coros-branco.png")).default as unknown as string;
    const response = await fetch(logoUrl);
    if (!response.ok) return undefined;
    const blob = await response.blob();

    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

const HEADER_HEIGHT = 132;
const MARGIN_X = 56;
const BRAND = { r: 15 / 255, g: 76 / 255, b: 74 / 255 };
const INK = { r: 20 / 255, g: 20 / 255, b: 20 / 255 };
const MUTED = { r: 110 / 255, g: 110 / 255, b: 110 / 255 };
const FAINT = { r: 120 / 255, g: 120 / 255, b: 120 / 255 };
const LINE = { r: 230 / 255, g: 230 / 255, b: 230 / 255 };
const WHITE = { r: 1, g: 1, b: 1 };

type PdfFontLike = { widthOfTextAtSize(text: string, size: number): number };

function wrapText(text: string, font: PdfFontLike, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function saveBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReceiptPdf(receipt: ReceiptData, options?: { siteUrl?: string }) {
  const { PDFDocument, PageSizes, StandardFonts, PDFName, PDFString, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);

  // Header
  page.drawRectangle({
    x: 0,
    y: pageHeight - HEADER_HEIGHT,
    width: pageWidth,
    height: HEADER_HEIGHT,
    color: color(BRAND),
  });

  const logoDataUrl = await loadEventLogoDataUrl();
  if (logoDataUrl) {
    try {
      const logo = await doc.embedPng(logoDataUrl);
      page.drawImage(logo, {
        x: pageWidth - MARGIN_X - 78,
        y: pageHeight - 26 - 78,
        width: 78,
        height: 78,
      });
    } catch {
      /* logo is decorative */
    }
  }

  page.drawText("Comprovante de inscrição", {
    x: MARGIN_X,
    y: pageHeight - 56,
    size: 17,
    font: fontBold,
    color: color(WHITE),
  });
  page.drawText("II Encontro de Coros Diocesanos e Litúrgicos do Ceará", {
    x: MARGIN_X,
    y: pageHeight - 80,
    size: 11,
    font: fontRegular,
    color: color(WHITE),
  });
  page.drawText("20 a 22 de novembro de 2026 — Quixadá (CE)", {
    x: MARGIN_X,
    y: pageHeight - 98,
    size: 11,
    font: fontRegular,
    color: color(WHITE),
  });

  page.drawText("Inscrição confirmada", {
    x: MARGIN_X,
    y: pageHeight - 176,
    size: 13,
    font: fontBold,
    color: color(INK),
  });

  let y = pageHeight - 212;
  for (const row of buildReceiptRows(receipt)) {
    page.drawLine({
      start: { x: MARGIN_X, y: y + 16 },
      end: { x: pageWidth - MARGIN_X, y: y + 16 },
      thickness: 1,
      color: color(LINE),
    });
    page.drawText(row.label, { x: MARGIN_X, y, size: 10, font: fontRegular, color: color(MUTED) });

    const valueMaxWidth = pageWidth - MARGIN_X * 2 - 190;
    const valueLines = wrapText(row.value, fontBold, 11, valueMaxWidth);
    valueLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN_X + 190,
        y: y - index * 14,
        size: 11,
        font: fontBold,
        color: color(INK),
      });
    });
    y -= 38 + Math.max(0, valueLines.length - 1) * 14;
  }

  page.drawLine({
    start: { x: MARGIN_X, y: y + 16 },
    end: { x: pageWidth - MARGIN_X, y: y + 16 },
    thickness: 1,
    color: color(LINE),
  });

  const baseUrl = (
    options?.siteUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://encontrocorosce.lovable.app")
  ).replace(/\/$/, "");
  const participantAreaUrl = `${baseUrl}${PARTICIPANT_AREA_PATH}`;

  page.drawText("Área do participante", {
    x: MARGIN_X,
    y: y - 6,
    size: 10,
    font: fontBold,
    color: color(INK),
  });

  const linkY = y - 24;
  page.drawText(participantAreaUrl, {
    x: MARGIN_X,
    y: linkY,
    size: 10,
    font: fontRegular,
    color: color(BRAND),
  });

  try {
    const linkWidth = fontRegular.widthOfTextAtSize(participantAreaUrl, 10);
    const linkRef = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [MARGIN_X, linkY - 2, MARGIN_X + linkWidth, linkY + 10],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(participantAreaUrl) },
      }),
    );
    const annotsKey = PDFName.of("Annots");
    const existing = page.node.get(annotsKey);
    if (existing) {
      doc.context.lookup(existing);
    }
    // Append to (or create) the page's Annots array.
    const annotsArray = existing
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc.context.lookup(existing) as any)
      : doc.context.obj([]);
    annotsArray.push(linkRef);
    if (!existing) page.node.set(annotsKey, annotsArray);
  } catch {
    /* link annotation is best-effort */
  }

  page.drawText("Acesse com o e-mail da inscrição e a senha inicial: CPF + ano de nascimento (AAAA).", {
    x: MARGIN_X,
    y: y - 42,
    size: 9,
    font: fontRegular,
    color: color(FAINT),
  });
  page.drawText("Documento gerado automaticamente pelo site do evento. Pagamento processado pela InfinitePay.", {
    x: MARGIN_X,
    y: y - 60,
    size: 9,
    font: fontRegular,
    color: color(FAINT),
  });

  const bytes = await doc.save();
  const code = formatOrderCode(receipt.orderNsu);
  saveBytes(bytes, code ? `comprovante-inscricao-${code}.pdf` : "comprovante-inscricao.pdf");
}
