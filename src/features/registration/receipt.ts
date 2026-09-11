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
    { label: "Valor pago", value: paidCents !== undefined ? formatCurrencyBRL(paidCents) : undefined },
    { label: "Forma de pagamento", value: formatPaymentMethod(receipt.paymentMethod, receipt.installments) },
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

export async function downloadReceiptPdf(receipt: ReceiptData, options?: { siteUrl?: string }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 56;

  doc.setFillColor(15, 76, 74);
  doc.rect(0, 0, pageWidth, 132, "F");

  const logoDataUrl = await loadEventLogoDataUrl();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth - marginX - 78, 26, 78, 78);
    } catch {
      /* logo is decorative */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Comprovante de inscrição", marginX, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("II Encontro de Coros Diocesanos e Litúrgicos do Ceará", marginX, 80);
  doc.text("20 a 22 de novembro de 2026 — Quixadá (CE)", marginX, 98);

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Inscrição confirmada", marginX, 160);

  let y = 196;
  for (const row of buildReceiptRows(receipt)) {
    doc.setDrawColor(230, 230, 230);
    doc.line(marginX, y - 16, pageWidth - marginX, y - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(row.label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(doc.splitTextToSize(row.value, pageWidth - marginX * 2 - 190), marginX + 190, y);
    y += 38;
  }

  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y - 16, pageWidth - marginX, y - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Documento gerado automaticamente pelo site do evento. Pagamento processado pela InfinitePay.",
    marginX,
    y + 12,
  );

  const code = formatOrderCode(receipt.orderNsu);
  doc.save(code ? `comprovante-inscricao-${code}.pdf` : "comprovante-inscricao.pdf");
}
