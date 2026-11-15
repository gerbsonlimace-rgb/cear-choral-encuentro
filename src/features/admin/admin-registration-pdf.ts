import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  getAdminFinancialState,
  getRegistrationDisplayName,
  type AdminRegistrationRow,
  type AdminRegistrationPdfExportQuery,
} from "./admin.domain";
import { getAdminRafflePending, getAdminRegistrationPendingCents, formatAdminRafflePending } from "./admin-raffle.domain";
import { adminPdfLogoBase64 } from "./admin-pdf-logo";

export type AdminPdfFile = { fileName: string; base64: string };
const ink = rgb(0.10, 0.10, 0.11);
const muted = rgb(0.38, 0.38, 0.40);
const rule = rgb(0.83, 0.83, 0.84);
const shade = rgb(0.96, 0.96, 0.96);
const paidColor = rgb(0.08, 0.54, 0.28);
const pendingColor = rgb(0.77, 0.16, 0.16);
const statusLabels = { all: "Todos", pending: "Taxa pendente", partially_paid: "Parcialmente pago", paid: "Pago", exempt: "Isento", legacy: "Histórico" };
const roleLabels: Record<string, string> = { coralista: "Coralista", regente: "Regente", instrumentista: "Instrumentista" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type PaymentIndicator = "paid" | "pending" | "none";
type FinancialCell = { value: string; indicator: PaymentIndicator };

export function getPdfFinancialColumns(row: AdminRegistrationRow): { registration: FinancialCell; raffles: FinancialCell } {
  const state = getAdminFinancialState(row);
  const registrationPending = getAdminRegistrationPendingCents(row, state);
  const raffle = getAdminRafflePending(row, state);
  const registrationValue = row.registrationPriceCents ?? row.amountCents;
  return {
    registration: {
      value: registrationValue === null || registrationValue === undefined ? "Não informado" : money(registrationValue),
      indicator: state.status === "legacy" ? "none" : registrationPending === 0 && state.status !== "pending" ? "paid" : "pending",
    },
    raffles: raffle === null
      ? { value: "—", indicator: "none" }
      : { value: money(raffle.cents), indicator: raffle.cents === 0 ? "paid" : "pending" },
  };
}

export function getPdfHeaderDetails(rows: AdminRegistrationRow[], query: AdminRegistrationPdfExportQuery) {
  const choirNames = [...new Set(rows.map((row) => row.choirName?.trim()).filter(Boolean))];
  const regentNames = [...new Set(rows.map((row) => row.regentName?.trim()).filter(Boolean))];
  const choir = query.choirName
    ?? (choirNames.length === 1 ? choirNames[0] : query.choirId === "all" ? choirNames.length ? "Vários coros" : "Todos" : query.choirId === "other" ? "Outros coros" : "Coro selecionado");
  return {
    choir,
    regent: regentNames.length === 1 ? regentNames[0] : regentNames.length ? "Vários regentes" : "Não informado",
  };
}

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
  const widths = [100, 128, 112, 140, 78, 78, 80, 62];
  const headers = ["Nome no crachá", "Nome completo", "Coro", "E-mail", "WhatsApp", "Situação", "Valor inscrição", "Valor rifas"];
  const choir = query.choirName ?? (query.choirId === "all" ? "Todos" : query.choirId === "other" ? "Outros coros" : rows.find((row) => row.choirId === query.choirId)?.choirName ?? "Coro selecionado");
  const headerDetails = getPdfHeaderDetails(rows, query);
  const headerDetailLines = wrap(`Coro: ${headerDetails.choir} · Regente: ${headerDetails.regent}`, 662, font, 9);
  const filters = `Pagamento: ${statusLabels[query.paymentStatus]} · Coro: ${choir} · Função: ${query.musicalProfile === "all" ? "Todas" : roleLabels[query.musicalProfile] ?? query.musicalProfile} · Acesso: ${query.loginStatus === "never" ? "Nunca fez login" : query.loginStatus === "has" ? "Já fez login" : "Todos"}${query.search ? ` · Pesquisa: ${query.search}` : ""}`;
  const filterLines = wrap(filters, 778, font, 8);
  const filterStartY = 504 - headerDetailLines.length * 11;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(now);
  let page = doc.addPage([842, 595]);
  let y = 0;
  function header() {
    const logoSize = logo.scaleToFit(100, 56);
    page.drawImage(logo, { x: 32, y: 520, ...logoSize });
    page.drawText("II Encontro de Coros Diocesanos e Litúrgicos do Ceará", { x: 148, y: 556, font: bold, size: 14, color: ink });
    page.drawText(`Lista de inscritos · Emitido em ${date}`, { x: 148, y: 535, font, size: 9, color: muted });
    headerDetailLines.forEach((line, i) => page.drawText(line, { x: 148, y: 516 - i * 11, font: bold, size: 9, color: ink }));
    filterLines.forEach((line, i) => page.drawText(line, { x: 32, y: filterStartY - i * 11, font, size: 8, color: muted }));
    const summaryY = filterStartY - filterLines.length * 11 - 22;
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
    const financial = getPdfFinancialColumns(row);
    const cells: FinancialCell[] = [
      { value: getRegistrationDisplayName(row), indicator: "none" },
      { value: row.name, indicator: "none" },
      { value: row.choirName, indicator: "none" },
      { value: row.email, indicator: "none" },
      { value: row.phone, indicator: "none" },
      { value: statusLabels[state.status], indicator: "none" },
      financial.registration,
      financial.raffles,
    ];
    const lines = cells.map((cell, i) => wrap(cell.value, (widths[i] ?? 80) - (cell.indicator === "none" ? 10 : 22), font, 8));
    const height = Math.max(...lines.map((cell) => cell.length)) * 11 + 14;
    if (y - height < 44) { page = doc.addPage([842, 595]); header(); }
    let x = 32;
    lines.forEach((cell, i) => {
      const indicator = cells[i]?.indicator;
      if (indicator === "paid") {
        page.drawLine({ start: { x: x + 5, y: y - 12 }, end: { x: x + 8, y: y - 15 }, thickness: 1.5, color: paidColor });
        page.drawLine({ start: { x: x + 8, y: y - 15 }, end: { x: x + 15, y: y - 7 }, thickness: 1.5, color: paidColor });
      } else if (indicator === "pending") {
        page.drawLine({ start: { x: x + 5, y: y - 15 }, end: { x: x + 13, y: y - 7 }, thickness: 1.5, color: pendingColor });
        page.drawLine({ start: { x: x + 5, y: y - 7 }, end: { x: x + 13, y: y - 15 }, thickness: 1.5, color: pendingColor });
      }
      cell.forEach((line, j) => page.drawText(line, { x: x + (indicator === "none" ? 5 : 20), y: y - 16 - j * 11, font, size: 8, color: ink }));
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
