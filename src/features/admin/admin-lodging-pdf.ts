import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AdminRegistrationRow } from "./admin.domain";
import { adminPdfLogoBase64 } from "./admin-pdf-logo";
import type { LodgingPlan, NamedLodgingRoom } from "./admin-lodging.domain";
import { buildLodgingPersonSequence } from "./admin-lodging-sequence.domain";

export type AdminLodgingPdfFile = { fileName: string; base64: string; warnings: string[] };

type ReportPerson = {
  sequenceNumber: number;
  badgeName: string;
  name: string;
  cpf: string;
  phone: string;
  choirName: string;
  room: NamedLodgingRoom | null;
  star: boolean;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const LEFT = 28;
const RIGHT = 814;
const CONTENT_WIDTH = RIGHT - LEFT;
const TABLE_TOP = 444;
const TABLE_BOTTOM = 36;
const TABLE_HEADER_HEIGHT = 22;
const ROW_MIN_HEIGHT = 31;
const LINE_HEIGHT = 9;
const FONT_SIZE = 8;
const columnWidths = [38, 192, 87, 65, 103, 85, 215];
const ink = rgb(0.13, 0.15, 0.18);
const muted = rgb(0.37, 0.41, 0.46);
const rule = rgb(0.8, 0.83, 0.87);
const headerShade = rgb(0.94, 0.95, 0.96);
const alternateShade = rgb(0.985, 0.988, 0.992);
const gold = rgb(0.82, 0.61, 0.03);
const roomCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function printable(value: string, font: PDFFont) {
  return Array.from(value.normalize("NFC").replace(/[\r\n\t]/g, " "))
    .map((character) => {
      try {
        font.encodeText(character);
        return character;
      } catch {
        return "?";
      }
    })
    .join("");
}

function wrap(value: string, width: number, font: PDFFont, size: number): string[] {
  const words = printable(value || "", font)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitSingleLine(value: string, width: number, font: PDFFont, size: number) {
  const clean = printable(value || "—", font);
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let line = clean;
  while (line.length > 1 && font.widthOfTextAtSize(`${line}…`, size) > width) line = line.slice(0, -1);
  return `${line.trimEnd()}…`;
}

function roomSubline(room: NamedLodgingRoom | null) {
  if (!room) return "";
  if (room.floor.trim()) return room.floor.trim().toLocaleUpperCase("pt-BR");
  return room.location.trim().toLocaleUpperCase("pt-BR");
}

function roomLines(person: ReportPerson) {
  if (person.star) return ["INSCRIÇÃO", "SEM", "ACOMODAÇÃO"];
  if (!person.room) return ["SEM QUARTO"];
  return [person.room.name.toLocaleUpperCase("pt-BR"), roomSubline(person.room)].filter(Boolean);
}

function displayRowLines(person: ReportPerson, font: PDFFont, bold: PDFFont = font) {
  const badge = `${person.badgeName.toLocaleUpperCase("pt-BR")}${person.star ? " *" : ""}`;
  const full = person.name.toLocaleUpperCase("pt-BR");
  const cpf = `CPF: ${person.cpf || "NÃO INFORMADO"}`;
  const nameWidth = (columnWidths[1] ?? 192) - 12;
  return [
    ...wrap(badge, nameWidth, bold, 8.4),
    ...wrap(full, nameWidth, font, FONT_SIZE),
    ...wrap(cpf, nameWidth, font, 7.8),
  ];
}

function buildPeople(registrations: AdminRegistrationRow[], plan: LodgingPlan): ReportPerson[] {
  const roomByKey = new Map((plan.namedRooms ?? []).map((room) => [room.key, room]));
  const registrationsById = new Map(registrations.map((row) => [row.id, row]));
  const extrasById = new Map(plan.extraPeople.map((person) => [person.id, person]));
  const sequence = buildLodgingPersonSequence(registrations, plan);
  return sequence.map((person) => {
    const row = person.kind === "registration" ? registrationsById.get(person.id) : undefined;
    const extra = person.kind === "extra" ? extrasById.get(person.id) : undefined;
    return {
      sequenceNumber: person.sequenceNumber,
      badgeName: person.badgeName,
      name: person.name,
      cpf: row?.cpf ?? extra?.cpf ?? "",
      phone: row?.phone ?? "",
      choirName: person.choirName.trim() || "Coro a confirmar",
      room: roomByKey.get(person.roomKey ?? "") ?? null,
      star: row?.registrationPriceCents === 8000,
    };
  });
}

function drawTextLines(
  page: PDFPage,
  lines: string[],
  {
    x,
    top,
    width,
    font,
    size,
    lineHeight = LINE_HEIGHT,
    color = ink,
    maxLines,
  }: {
    x: number;
    top: number;
    width: number;
    font: PDFFont;
    size: number;
    lineHeight?: number;
    color?: ReturnType<typeof rgb>;
    maxLines?: number;
  },
) {
  const visible = maxLines ? lines.slice(0, maxLines) : lines;
  visible.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: top - size - index * lineHeight,
      font,
      size,
      color,
      maxWidth: width,
    });
  });
}

function drawVanChoices(page: PDFPage, x: number, top: number, font: PDFFont) {
  const box = 6;
  const y = top - 18;
  page.drawRectangle({ x: x + 8, y, width: box, height: box, borderColor: rule, borderWidth: 0.7 });
  page.drawText("SIM", { x: x + 18, y: y - 0.3, font, size: 7.6, color: ink });
  page.drawRectangle({
    x: x + 46,
    y,
    width: box,
    height: box,
    borderColor: rule,
    borderWidth: 0.7,
  });
  page.drawText("NÃO", { x: x + 56, y: y - 0.3, font, size: 7.6, color: ink });
}

function drawTableHeader(page: PDFPage, bold: PDFFont) {
  let x = LEFT;
  const y = TABLE_TOP - TABLE_HEADER_HEIGHT;
  const labels = [
    "Nº",
    "IDENTIFICAÇÃO (CRACHÁ / NOME / CPF)",
    "TELEFONE",
    "QUARTO",
    "RESTRIÇÃO ALIMENTAR",
    "USARÁ A VAN?",
    "ASSINATURA",
  ];
  labels.forEach((label, index) => {
    const width = columnWidths[index] ?? 0;
    page.drawRectangle({
      x,
      y,
      width,
      height: TABLE_HEADER_HEIGHT,
      color: headerShade,
      borderColor: rule,
      borderWidth: 0.55,
    });
    drawTextLines(page, [label], {
      x: x + 5,
      top: TABLE_TOP - 5,
      width: width - 10,
      font: bold,
      size: 8.2,
      lineHeight: 9,
    });
    x += width;
  });
}

function drawRow(
  page: PDFPage,
  person: ReportPerson,
  top: number,
  height: number,
  rowIndex: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const phoneLines = wrap(person.phone, (columnWidths[2] ?? 87) - 12, font, FONT_SIZE);
  const lodgingLines = roomLines(person);
  let x = LEFT;
  const bottom = top - height;
  columnWidths.forEach((width, columnIndex) => {
    page.drawRectangle({
      x,
      y: bottom,
      width,
      height,
      color: rowIndex % 2 === 1 ? alternateShade : rgb(1, 1, 1),
      borderColor: rule,
      borderWidth: 0.5,
    });
    if (columnIndex === 0) {
      const sequence = String(person.sequenceNumber).padStart(3, "0");
      const sequenceWidth = bold.widthOfTextAtSize(sequence, 8.4);
      page.drawText(sequence, {
        x: x + (width - sequenceWidth) / 2,
        y: bottom + (height - 8.4) / 2,
        font: bold,
        size: 8.4,
        color: ink,
      });
    } else if (columnIndex === 1) {
      const badgeLines = wrap(
        `${person.badgeName.toLocaleUpperCase("pt-BR")}${person.star ? " *" : ""}`,
        width - 10,
        bold,
        8.4,
      );
      drawTextLines(page, badgeLines, {
        x: x + 5,
        top: top - 3,
        width: width - 10,
        font: bold,
        size: 8.4,
        lineHeight: LINE_HEIGHT,
      });
      const fullLines = wrap(person.name.toLocaleUpperCase("pt-BR"), width - 10, font, FONT_SIZE);
      drawTextLines(page, fullLines, {
        x: x + 5,
        top: top - 3 - badgeLines.length * LINE_HEIGHT,
        width: width - 10,
        font,
        size: FONT_SIZE,
        lineHeight: LINE_HEIGHT,
      });
      const cpfLines = wrap(`CPF: ${person.cpf || "NÃO INFORMADO"}`, width - 10, font, 7.8);
      drawTextLines(page, cpfLines, {
        x: x + 5,
        top: top - 3 - (badgeLines.length + fullLines.length) * LINE_HEIGHT,
        width: width - 10,
        font,
        size: 7.8,
        lineHeight: 8.6,
        color: muted,
      });
    } else if (columnIndex === 2) {
      drawTextLines(page, phoneLines, {
        x: x + 5,
        top: top - Math.max(0, (height - FONT_SIZE) / 2),
        width: width - 10,
        font,
        size: FONT_SIZE,
      });
    } else if (columnIndex === 3) {
      if (person.star) {
        drawTextLines(page, lodgingLines, {
          x: x + 5,
          top: top - 3,
          width: width - 10,
          font,
          size: 6.8,
          lineHeight: 8,
        });
      } else {
        const roomName = lodgingLines.slice(0, 1);
        const locationLines = lodgingLines.slice(1);
        drawTextLines(page, roomName, {
          x: x + 5,
          top: top - 4,
          width: width - 10,
          font,
          size: 8.5,
          lineHeight: 9,
        });
        drawTextLines(page, locationLines, {
          x: x + 5,
          top: top - 14,
          width: width - 10,
          font,
          size: 7.5,
          lineHeight: 8,
          color: muted,
        });
      }
    } else if (columnIndex === 4) {
      page.drawLine({
        start: { x: x + 6, y: bottom + Math.min(8, height / 3) },
        end: { x: x + width - 6, y: bottom + Math.min(8, height / 3) },
        thickness: 0.45,
        color: rule,
      });
    } else if (columnIndex === 5) {
      drawVanChoices(page, x, top, font);
    }
    x += width;
  });
}

function drawPageHeader(
  page: PDFPage,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  choirName: string,
  count: number,
  pageNumber: number,
  continuation: boolean,
  font: PDFFont,
  bold: PDFFont,
) {
  const logoSize = logo.scaleToFit(118, 72);
  page.drawImage(logo, { x: LEFT, y: 510, ...logoSize });
  page.drawText("II ENCONTRO DE COROS DIOCESANOS E LITÚRGICOS", {
    x: 148,
    y: 556,
    font: bold,
    size: 14,
    color: ink,
  });
  page.drawText("REGIONAL NORDESTE 1 - CNBB  |  QUIXADÁ - CE  |  20 A 22 DE NOVEMBRO DE 2026", {
    x: 148,
    y: 537,
    font,
    size: 9,
    color: muted,
  });
  page.drawText("CONTROLE DE CREDENCIAMENTO", {
    x: 148,
    y: 516,
    font: bold,
    size: 14,
    color: ink,
  });
  page.drawLine({
    start: { x: LEFT, y: 500 },
    end: { x: RIGHT, y: 500 },
    thickness: 1.7,
    color: gold,
  });
  page.drawText(choirName.toLocaleUpperCase("pt-BR"), {
    x: LEFT,
    y: 473,
    font: bold,
    size: 18,
    color: ink,
    maxWidth: CONTENT_WIDTH,
  });
  const note = `${count} ${count === 1 ? "PESSOA" : "PESSOAS"}  ·  CP = CENTRO PASTORAL  |  SEM = SEMINÁRIO  |  PROF = CASA DOS PROFESSORES  ·  * NÃO SOLICITOU INSCRIÇÃO COM QUARTO${continuation ? "  ·  CONTINUAÇÃO" : ""}`;
  drawTextLines(page, wrap(note, 690, font, 7.4), {
    x: LEFT,
    top: 461,
    width: 690,
    font,
    size: 7.4,
    lineHeight: 8,
    color: muted,
    maxLines: 2,
  });
  page.drawText(`PÁGINA ${pageNumber}`, {
    x: 748,
    y: 455,
    font,
    size: 8.2,
    color: muted,
    maxWidth: 66,
  });
  drawTableHeader(page, bold);
}

function compareRooms(left: NamedLodgingRoom, right: NamedLodgingRoom) {
  const locations = ["Centro Pastoral", "Seminário", "Casa dos Professores"];
  const leftLocation = locations.indexOf(left.location);
  const rightLocation = locations.indexOf(right.location);
  const locationOrder = (leftLocation < 0 ? locations.length : leftLocation) -
    (rightLocation < 0 ? locations.length : rightLocation);
  return locationOrder || roomCollator.compare(left.name, right.name);
}

function drawRoomMapPage(
  doc: PDFDocument,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  rooms: NamedLodgingRoom[],
  people: ReportPerson[],
  font: PDFFont,
  bold: PDFFont,
) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const logoSize = logo.scaleToFit(118, 72);
  page.drawImage(logo, { x: LEFT, y: 510, ...logoSize });
  page.drawText("II ENCONTRO DE COROS DIOCESANOS E LITÚRGICOS", {
    x: 148, y: 556, font: bold, size: 14, color: ink,
  });
  page.drawText("REGIONAL NORDESTE 1 - CNBB  |  QUIXADÁ - CE  |  20 A 22 DE NOVEMBRO DE 2026", {
    x: 148, y: 537, font, size: 9, color: muted,
  });
  page.drawText("MAPA RESUMIDO DE QUARTOS", {
    x: 148, y: 516, font: bold, size: 14, color: ink,
  });
  page.drawLine({ start: { x: LEFT, y: 500 }, end: { x: RIGHT, y: 500 }, thickness: 1.7, color: gold });
  const unallocated = people.filter((person) => !person.room).length;
  page.drawText(`QUARTOS EM ORDEM NUMÉRICA · Nº SEQUENCIAL IDENTIFICA CADA QUARTO · NOMES COMPLETOS NAS SEÇÕES POR CORO · SEM QUARTO: ${unallocated}`, {
    x: LEFT, y: 481, font, size: 7.2, color: muted, maxWidth: CONTENT_WIDTH,
  });

  const sortedRooms = [...rooms].sort(compareRooms);
  const roomsPerColumn = Math.ceil(sortedRooms.length / 2);
  const columnGap = 10;
  const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
  const columnXs = [LEFT, LEFT + columnWidth + columnGap];
  const sequenceWidth = 32;
  const roomWidth = 56;
  const rowTop = 449;
  const rowHeight = 12.2;
  const headerTop = 465;
  const occupantsByRoom = new Map<string, string[]>();
  for (const person of people) {
    if (!person.room) continue;
    const occupants = occupantsByRoom.get(person.room.key) ?? [];
    occupants.push(`${person.badgeName}${person.star ? " *" : ""}`);
    occupantsByRoom.set(person.room.key, occupants);
  }

  for (let columnIndex = 0; columnIndex < 2; columnIndex += 1) {
    const x = columnXs[columnIndex] ?? LEFT;
    page.drawRectangle({ x, y: headerTop - 16, width: columnWidth, height: 16, color: headerShade, borderColor: rule, borderWidth: 0.55 });
    page.drawText("SEQ.", { x: x + 4, y: headerTop - 11, font: bold, size: 6.8, color: ink });
    page.drawText("QUARTO", { x: x + sequenceWidth + 2, y: headerTop - 11, font: bold, size: 6.8, color: ink });
    page.drawText("OCUPANTES", { x: x + sequenceWidth + roomWidth + 2, y: headerTop - 11, font: bold, size: 6.8, color: ink });
    const offset = columnIndex * roomsPerColumn;
    const columnRooms = sortedRooms.slice(offset, offset + roomsPerColumn);
    columnRooms.forEach((room, rowIndex) => {
      const index = offset + rowIndex;
      const y = rowTop - rowIndex * rowHeight;
      const unavailable = room.key === "CP30" || room.key === "CP32";
      const background = unavailable ? rgb(0.2, 0.2, 0.2) : rowIndex % 2 ? alternateShade : rgb(1, 1, 1);
      const foreground = unavailable ? rgb(1, 1, 1) : ink;
      page.drawRectangle({ x, y: y - rowHeight, width: columnWidth, height: rowHeight, color: background, borderColor: rule, borderWidth: 0.45 });
      const sequence = String(index + 1).padStart(3, "0");
      page.drawText(sequence, { x: x + 3, y: y - 8.7, font: bold, size: 6.8, color: foreground });
      page.drawText(room.name.toLocaleUpperCase("pt-BR"), { x: x + sequenceWidth + 2, y: y - 8.7, font: bold, size: 6.6, color: foreground, maxWidth: roomWidth - 4 });
      const labels = unavailable ? "INDISPONÍVEL" : (occupantsByRoom.get(room.key) ?? []).join(", ") || "—";
      page.drawText(fitSingleLine(labels, columnWidth - sequenceWidth - roomWidth - 7, font, 6.4), {
        x: x + sequenceWidth + roomWidth + 2, y: y - 8.7, font, size: 6.4, color: foreground,
      });
    });
  }
  if (sortedRooms.length === 0) {
    page.drawText("Nenhum quarto cadastrado.", { x: LEFT, y: 435, font, size: 9, color: muted });
  }
  page.drawText("PÁGINA 1", { x: 748, y: 20, font, size: 8.2, color: muted, maxWidth: 66 });
}

export async function buildLodgingRegistrationsPdf(
  registrations: AdminRegistrationRow[],
  plan: LodgingPlan,
  now: Date,
): Promise<AdminLodgingPdfFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(adminPdfLogoBase64);
  doc.setTitle("Controle de credenciamento | II Encontro de Coros");
  doc.setSubject("Relação de pessoas e quartos");
  doc.setCreationDate(now);

  const people = buildPeople(registrations, plan);
  const warnings = [...new Set(people.filter((person) => person.choirName === "Coro a confirmar").map((person) => person.badgeName))];
  const grouped = new Map<string, ReportPerson[]>();
  for (const person of people) {
    const group = grouped.get(person.choirName) ?? [];
    group.push(person);
    grouped.set(person.choirName, group);
  }
  if (grouped.size === 0) grouped.set("SEM INSCRITOS", []);

  drawRoomMapPage(doc, logo, plan.namedRooms ?? [], people, font, bold);
  let pageNumber = 1;
  for (const [choirName, rows] of grouped) {
    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    drawPageHeader(page, logo, choirName, rows.length, pageNumber, false, font, bold);
    let cursor = TABLE_TOP - TABLE_HEADER_HEIGHT;
    let rowIndex = 0;
    if (!rows.length) {
      page.drawText("Nenhum participante para exibir.", {
        x: LEFT + 7,
        y: cursor - 17,
        font,
        size: 9,
        color: muted,
      });
      continue;
    }
    for (const person of rows) {
      const identityLines = displayRowLines(person, font, bold);
      const roomCount = roomLines(person).length;
      const phoneCount = wrap(person.phone, (columnWidths[2] ?? 87) - 12, font, FONT_SIZE).length;
      const maxLines = Math.max(identityLines.length, roomCount, phoneCount, 1);
      const rowHeight = Math.max(ROW_MIN_HEIGHT, maxLines * LINE_HEIGHT + 4);
      if (cursor - rowHeight < TABLE_BOTTOM) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageNumber += 1;
        drawPageHeader(page, logo, choirName, rows.length, pageNumber, true, font, bold);
        cursor = TABLE_TOP - TABLE_HEADER_HEIGHT;
        rowIndex = 0;
      }
      drawRow(page, person, cursor, rowHeight, rowIndex, font, bold);
      cursor -= rowHeight;
      rowIndex += 1;
    }
  }

  const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Fortaleza" }).format(now);
  return {
    fileName: `relacao-hospedagem-${stamp}.pdf`,
    base64: await doc.saveAsBase64(),
    warnings,
  };
}
