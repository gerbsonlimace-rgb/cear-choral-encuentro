import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { adminPdfLogoBase64 } from "@/features/admin/admin-pdf-logo";
import {
  formatFeedbackScore,
  summarizeFeedback,
  type AdminFeedbackRow,
} from "./adminEventFeedback.domain";

export type FeedbackPdfFile = { base64: string; fileName: string };

// A5 portrait: one reading column with body type large enough for a phone.
const W = 420;
const H = 595;
const M = 24;
const WIDTH = W - M * 2;
const ink = rgb(0.094, 0.094, 0.106);
const muted = rgb(0.32, 0.32, 0.36);
const gold = rgb(0.65, 0.49, 0);
const soft = rgb(1, 0.973, 0.84);
const rule = rgb(0.88, 0.88, 0.89);
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

export async function buildEventFeedbackPdf(
  rows: AdminFeedbackRow[],
  now = new Date(),
): Promise<FeedbackPdfFile> {
  const doc = await PDFDocument.create();
  doc.setTitle("Resultados das avaliações | Encontro de Coros");
  doc.setAuthor("Encontro de Coros");
  doc.setCreationDate(now);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(adminPdfLogoBase64);
  const summary = summarizeFeedback(rows);
  let replacedSymbols = false;
  let page = doc.addPage([W, H]);
  let y = 0;
  let sectionTitle = "Resultados gerais";

  function clean(value: string) {
    return Array.from(value.normalize("NFC"))
      .map((char) => {
        if (char === "\n") return char;
        if (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) return " ";
        try {
          regular.encodeText(char);
          return char;
        } catch {
          replacedSymbols = true;
          return "[símbolo]";
        }
      })
      .join("");
  }

  function line(text: string, x: number, baseline: number, size = 12, font = regular, color = ink) {
    page.drawText(clean(text), { x, y: baseline, size, font, color });
  }

  function header(title: string, continued = false) {
    const scale = Math.min(105 / logo.width, 44 / logo.height);
    page.drawImage(logo, { x: M, y: 539, width: logo.width * scale, height: logo.height * scale });
    line("Encontro de Coros", 149, 565, 12, bold);
    line("Relatório de avaliações", 149, 547, 11, regular, muted);
    page.drawLine({
      start: { x: M, y: 530 },
      end: { x: W - M, y: 530 },
      thickness: 1,
      color: rule,
    });
    line(title, M, 502, 21, bold);
    y = 480;
    if (continued) {
      line("Continuação", M, y, 11, regular, muted);
      y -= 24;
    }
  }

  function newPage(title = sectionTitle, continued = false) {
    page = doc.addPage([W, H]);
    sectionTitle = title;
    header(title, continued);
  }

  function ensure(height: number) {
    if (y - height < 48) newPage(sectionTitle, true);
  }

  // Character-level fallback also handles URLs and words without spaces.
  function wrap(text: string, font: PDFFont, size: number, width = WIDTH) {
    const result: string[] = [];
    for (const paragraph of clean(text).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          current = candidate;
          continue;
        }
        if (current) {
          result.push(current);
          current = "";
        }
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > width) {
            result.push(current);
            current = "";
          }
          current += char;
        }
      }
      result.push(current);
    }
    return result;
  }

  function paragraph(text: string, size = 12, font = regular, color = ink) {
    for (const textLine of wrap(text, font, size)) {
      ensure(size + 5);
      line(textLine, M, y, size, font, color);
      y -= size + 5;
    }
    y -= 5;
  }

  function heading(text: string) {
    ensure(54);
    line(text, M, y, 15, bold);
    y -= 25;
  }

  function distribution(values: number[], count: number) {
    ensure(115);
    for (const score of [5, 4, 3, 2, 1]) {
      const amount = values[score - 1];
      const fraction = count ? amount / count : 0;
      line(`${score}/5`, M, y, 11, bold);
      page.drawRectangle({ x: 61, y: y + 1, width: 216, height: 7, color: rule });
      if (fraction)
        page.drawRectangle({ x: 61, y: y + 1, width: 216 * fraction, height: 7, color: gold });
      line(`${amount} · ${Math.round(fraction * 100)}%`, 291, y, 11, regular, muted);
      y -= 19;
    }
    y -= 9;
  }

  function comments(items: { text: string; date: string; rating: number | null }[], empty: string) {
    heading(`Comentários (${items.length})`);
    if (!items.length) {
      paragraph(empty, 12, regular, muted);
      return;
    }
    items.forEach((item, i) => {
      const blockHeight = wrap(item.text, regular, 12).length * 17 + 35;
      // Keep a short comment together; long comments can continue on later pages.
      ensure(blockHeight <= 400 ? blockHeight : 70);
      page.drawLine({
        start: { x: M, y: y + 14 },
        end: { x: W - M, y: y + 14 },
        thickness: 0.6,
        color: rule,
      });
      paragraph(
        `${i + 1}. ${dateTime.format(new Date(item.date))} · ${item.rating === null ? "Não utilizei" : `Nota ${item.rating}/5`}`,
        10,
        bold,
        muted,
      );
      paragraph(item.text);
      y -= 9;
    });
  }

  header(sectionTitle);
  paragraph(`Emitido em ${dateTime.format(now)} · Todas as avaliações`, 10, regular, muted);
  if (!rows.length) {
    paragraph("Nenhuma avaliação recebida até a emissão deste relatório.");
  } else {
    page.drawRectangle({ x: M, y: y - 66, width: WIDTH, height: 75, color: soft });
    line(formatFeedbackScore(summary.average), M + 12, y - 25, 32, bold);
    line("Média geral de 5", M + 12, y - 48, 11);
    line(String(summary.total), 245, y - 25, 26, bold);
    line("avaliações recebidas", 245, y - 48, 11);
    y -= 90;
    paragraph(
      `${Math.round((summary.positive / summary.total) * 100)}% deram notas 4 ou 5 · ${summary.withComments} com comentários`,
      11,
    );
    heading("Notas da avaliação geral");
    distribution(summary.distribution, summary.total);
    heading("Resumo por critério");
    for (const aspect of summary.aspects) {
      ensure(23);
      line(aspect.label, M, y, 12);
      line(
        aspect.average === null ? "Sem notas" : `${formatFeedbackScore(aspect.average)} / 5`,
        198,
        y,
        12,
        bold,
      );
      line(`${aspect.count} respostas`, 307, y, 10, regular, muted);
      y -= 23;
    }

    newPage("Comentários gerais");
    paragraph("Sugestões e observações sobre o encontro, na íntegra.", 11, regular, muted);
    comments(
      rows
        .filter((row) => row.suggestion.trim())
        .map((row) => ({ text: row.suggestion, date: row.created_at, rating: row.overall })),
      "Nenhuma sugestão geral foi enviada.",
    );

    for (const aspect of summary.aspects) {
      newPage(aspect.label);
      paragraph(aspect.description, 11, regular, muted);
      y -= 12;
      paragraph(
        aspect.average === null
          ? "Sem notas para este critério."
          : `Média: ${formatFeedbackScore(aspect.average)} / 5`,
        22,
        bold,
      );
      paragraph(`${aspect.count} respostas com nota · Não utilizaram: ${aspect.notUsed}`, 11);
      if (aspect.key === "food" || aspect.key === "lodging")
        paragraph("“Não utilizei” fica fora da média e dos percentuais.", 10, regular, muted);
      heading("Distribuição das notas");
      distribution(
        [1, 2, 3, 4, 5].map((score) => rows.filter((row) => row[aspect.key] === score).length),
        aspect.count,
      );
      comments(
        rows
          .filter((row) => row.criterion_comments[aspect.key]?.trim())
          .map((row) => ({
            text: row.criterion_comments[aspect.key]!,
            date: row.created_at,
            rating: row[aspect.key],
          })),
        "Nenhum comentário foi enviado para este critério.",
      );
    }
  }

  if (replacedSymbols)
    paragraph("Símbolos sem suporte na fonte aparecem como [símbolo].", 10, regular, muted);
  const pages = doc.getPages();
  pages.forEach((item, i) => {
    item.drawLine({
      start: { x: M, y: 36 },
      end: { x: W - M, y: 36 },
      thickness: 0.6,
      color: rule,
    });
    item.drawText("Uso da administração · Respostas sem identificação", {
      x: M,
      y: 22,
      size: 8.5,
      font: regular,
      color: muted,
    });
    item.drawText(`${i + 1} / ${pages.length}`, {
      x: 358,
      y: 22,
      size: 9,
      font: regular,
      color: muted,
    });
  });
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { base64: await doc.saveAsBase64(), fileName: `resultados-avaliacoes-${stamp}.pdf` };
}
