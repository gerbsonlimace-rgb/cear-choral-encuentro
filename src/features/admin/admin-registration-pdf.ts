import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getAdminFinancialState, type AdminRegistrationRow, type AdminRegistrationPdfExportQuery } from "./admin.domain";
import { getAdminRafflePending, getAdminRegistrationPendingCents, formatAdminRafflePending } from "./admin-raffle.domain";
import { adminPdfLogoBase64 } from "./admin-pdf-logo";

export type AdminPdfFile = { fileName: string; base64: string };
const ink = rgb(0.10, 0.10, 0.11);
const muted = rgb(0.38, 0.38, 0.40);
const rule = rgb(0.83, 0.83, 0.84);
const shade = rgb(0.96, 0.96, 0.96);
const statusLabels = { all: "Todos", pending: "Taxa pendente", partially_paid: "Parcialmente pago", paid: "Pago", exempt: "Isento", legacy: "Histórico" };
const roleLabels: Record<string, string> = { coralista: "Coralista", regente: "Regente", instrumentista: "Instrumentista" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function summarizePdfRegistrations(rows: AdminRegistrationRow[]) {
  return rows.reduce((total, row) => {
    const state = getAdminFinancialState(row);
    const raffle = getAdminRafflePending(row, state);
    total.pendingMoneyCents += getAdminRegistrationPendingCents(row, state) ?? 0;
    total.raffleCents += raffle?.cents ?? 0;
    total.raffleTickets = total.raffleTickets === null || raffle?.tickets === null
      ? null : total.raffleTickets + (raffle?.tickets ?? 0);
    return total;
  }, { total: rows.length, pendingMoneyCents: 0, raffleCents: 0, raffleTickets: 0 as number | null });
}

function printable(value: string, font: PDFFont) {
  return Array.from(value.normalize("NFC").replace(/[\r\n\t]/g, " ")).map((char) => {
    try { font.encodeText(char); return char; } catch { return "?"; }
  }).join("");
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

export async function buildRegistrationsPdf(rows: AdminRegistrationRow[], query: AdminRegistrationPdfExportQuery, now: Date): Promise<AdminPdfFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(adminPdfLogoBase64);
  const summary = summarizePdfRegistrations(rows);
  doc.setTitle("Lista de inscritos | II Encontro de Coros");
  doc.setCreationDate(now);
  const widths = [140, 113, 66, 139, 80, 83, 79, 78];
  const headers = ["Nome", "Coro", "Função", "E-mail", "WhatsApp", "Situação", "Valor pago", "Taxa pendente"];
  const choir = query.choirName ?? (query.choirId === "all" ? "Todos" : query.choirId === "other" ? "Outros coros" : rows.find((row) => row.choirId === query.choirId)?.choirName ?? "Coro selecionado");
  const filters = `Pagamento: ${statusLabels[query.paymentStatus]} · Coro: ${choir} · Função: ${query.musicalProfile === "all" ? "Todas" : roleLabels[query.musicalProfile] ?? query.musicalProfile} · Acesso: ${query.loginStatus === "never" ? "Nunca fez login" : query.loginStatus === "has" ? "Já fez login" : "Todos"}${query.search ? ` · Pesquisa: ${query.search}` : ""}`;
  const filterLines = wrap(filters, 778, font, 8);
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(now);
  let page = doc.addPage([842, 595]);
  let y = 0;
  function header() {
    const logoSize = logo.scaleToFit(100, 56);
    page.drawImage(logo, { x: 32, y: 520, ...logoSize });
    page.drawText("II Encontro de Coros Diocesanos e Litúrgicos do Ceará", { x: 148, y: 556, font: bold, size: 14, color: ink });
    page.drawText(`Lista de inscritos · Emitido em ${date}`, { x: 148, y: 535, font, size: 9, color: muted });
    filterLines.forEach((line, i) => page.drawText(line, { x: 32, y: 504 - i * 11, font, size: 8, color: muted }));
    const summaryY = 482 - filterLines.length * 11;
    const metrics = [
      ["Total de inscritos", String(summary.total)],
      ["Total pendente taxa de inscrição", money(summary.pendingMoneyCents)],
      ["Total pendente em rifas", formatAdminRafflePending({ cents: summary.raffleCents, tickets: summary.raffleTickets })],
    ];
    metrics.forEach(([label, value], i) => {
      const x = 32 + i * 260;
      page.drawText(label ?? "", { x, y: summaryY, font, size: 9, color: muted });
      page.drawText(value ?? "", { x, y: summaryY - 18, font: bold, size: 12, color: ink });
    });
    y = summaryY - 34;
    page.drawRectangle({ x: 32, y: y - 26, width: 778, height: 26, color: shade });
    let x = 32;
    headers.forEach((label, i) => {
      page.drawText(label, { x: x + 5, y: y - 16, font: bold, size: 8, color: ink });
      x += widths[i] ?? 0;
    });
    y -= 26;
  }
  header();
  if (!rows.length) page.drawText("Nenhuma inscrição encontrada para os filtros selecionados.", { x: 37, y: y - 24, font, size: 10, color: muted });
  rows.forEach((row) => {
    const state = getAdminFinancialState(row);
    const cells = [row.name, row.choirName, roleLabels[row.musicalProfile ?? ""] ?? row.musicalProfile ?? row.role, row.email, row.phone, statusLabels[state.status], state.status === "legacy" ? "Não informado" : money(state.confirmedPrincipalCents), state.status === "legacy" ? "Não informado" : money(getAdminRegistrationPendingCents(row, state) ?? 0)];
    const lines = cells.map((cell, i) => wrap(cell, (widths[i] ?? 80) - 10, font, 8));
    const height = Math.max(...lines.map((cell) => cell.length)) * 11 + 14;
    if (y - height < 44) { page = doc.addPage([842, 595]); header(); }
    let x = 32;
    lines.forEach((cell, i) => {
      cell.forEach((line, j) => page.drawText(line, { x: x + 5, y: y - 16 - j * 11, font, size: 8, color: ink }));
      x += widths[i] ?? 0;
    });
    y -= height;
    page.drawLine({ start: { x: 32, y }, end: { x: 810, y }, thickness: 0.5, color: rule });
  });
  doc.getPages().forEach((p, i) => p.drawText(`Página ${i + 1} de ${doc.getPageCount()}`, { x: 710, y: 24, font, size: 8, color: muted }));
  const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Fortaleza" }).format(now);
  const suffix = query.choirName ? `-${query.choirName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 80) || "coro"}` : "";
  return { fileName: `inscricoes${suffix}-${stamp}.pdf`, base64: await doc.saveAsBase64() };
}
