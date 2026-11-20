import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { AdminRegistrationRow } from "./admin.domain";
import { emptyLodgingPlan } from "./admin-lodging.domain";
import { buildLodgingRegistrationsPdf } from "./admin-lodging-pdf";

async function pdfText(base64: string) {
  const data = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const document = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

function registration(overrides: Partial<AdminRegistrationRow> = {}): AdminRegistrationRow {
  return {
    id: "registration-1",
    createdAt: "2026-10-01T12:00:00.000Z",
    name: "Nelsiana Francisca Sampaio Correia",
    badgeName: "Nelsiana Correia",
    cpf: "303.060.863-87",
    birthDate: "1980-01-01",
    diocese: "Quixadá",
    choirName: "Coro Diocesano de Quixadá",
    otherChoirName: null,
    email: "nelsiana@example.com",
    phone: "(88) 99999-0000",
    city: "Quixadá",
    institution: null,
    role: "Coralista",
    voicePart: "soprano",
    observations: null,
    includeShirt: false,
    shirtSize: null,
    shirtPriceCents: null,
    paymentStatus: "paid",
    amountCents: 8000,
    paidAmountCents: 8000,
    paymentMethod: "pix",
    installments: 1,
    paidAt: "2026-10-01T12:00:00.000Z",
    isFreeRegistration: false,
    pricingType: "standard",
    standardPriceCents: 8000,
    registrationPriceCents: 8000,
    remainingPriceCents: 0,
    photoUrl: null,
    regentName: "Maria",
    ...overrides,
  };
}

describe("lodging relationship PDF", () => {
  it("matches the landscape credentialing sheet and includes current room and R$80 marker", async () => {
    const plan = emptyLodgingPlan();
    plan.namedRooms = [
      { key: "CP17", name: "CP17", location: "Centro Pastoral", floor: "Térreo", notes: "" },
    ];
    plan.assignments = { "registration-1": "CP17", "registration-2": "CP17" };
    const file = await buildLodgingRegistrationsPdf(
      [
        registration(),
        registration({
          id: "registration-2",
          name: "Outra Pessoa",
          badgeName: "Outra Pessoa",
          registrationPriceCents: 30000,
        }),
      ],
      plan,
      new Date("2026-11-20T12:00:00.000Z"),
    );
    const pdf = await PDFDocument.load(file.base64);
    expect(pdf.getPage(0)?.getSize()).toEqual({ width: 842, height: 595 });
    const text = await pdfText(file.base64);
    expect(text).toContain("CONTROLE DE CREDENCIAMENTO");
    expect(text).toContain("Nº");
    expect(text).toContain("001");
    expect(text).toContain("002");
    expect(text).toContain("IDENTIFICAÇÃO (CRACHÁ / NOME / CPF)");
    expect(text).toContain("TELEFONE");
    expect(text).toContain("RESTRIÇÃO ALIMENTAR");
    expect(text).toContain("USARÁ A VAN?");
    expect(text).toContain("ASSINATURA");
    expect(text).toContain("NELSIANA CORREIA *");
    expect(text).toContain("NELSIANA FRANCISCA SAMPAIO CORREIA");
    expect(text).toContain("303.060.863-87");
    expect(text).toContain("CP17");
    expect(text.replace(/\s+/g, " ")).toContain("INSCRIÇÃO SEM ACOMODAÇÃO");
    expect(text).toContain("NÃO SOLICITOU INSCRIÇÃO COM QUARTO");
  });

  it("paginates all active people by choir and omits cancelled registrations", async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      registration({
        id: `registration-${index}`,
        name: `Participante ${index}`,
        badgeName: `Participante ${index}`,
        registrationPriceCents: 30000,
      }),
    );
    rows.push(registration({ id: "cancelled", name: "Cancelada", cancelledAt: "2026-11-01" }));
    const file = await buildLodgingRegistrationsPdf(rows, emptyLodgingPlan(), new Date());
    const pdf = await PDFDocument.load(file.base64);
    expect(pdf.getPageCount()).toBe(3);
    const text = await pdfText(file.base64);
    expect(text).toContain("PARTICIPANTE 24");
    expect(text).not.toContain("Cancelada");
  });

  it("lists manual guests under their choir in badge-name order with one sequence per person", async () => {
    const plan = emptyLodgingPlan();
    plan.extraPeople = [
      {
        id: "extra-bia",
        name: "Bianca",
        cpf: "",
        paid: "",
        role: "acompanhante",
        sex: "",
        birthDate: "",
        photoPath: null,
        choir: "Coro A",
        roomKey: null,
      },
      {
        id: "extra-caio",
        name: "Caio",
        cpf: "",
        paid: "",
        role: "acompanhante",
        sex: "",
        birthDate: "",
        photoPath: null,
        choir: "Coro B",
        roomKey: null,
      },
    ];
    const file = await buildLodgingRegistrationsPdf(
      [
        registration({
          id: "zuleica",
          name: "Zuleica Silva",
          badgeName: "Zuleica",
          choirName: "Coro A",
        }),
        registration({
          id: "ana",
          name: "Ana Silva",
          badgeName: "Ana",
          choirName: "Coro A",
        }),
        registration({
          id: "dora",
          name: "Dora Silva",
          badgeName: "Dora",
          choirName: "Coro B",
        }),
      ],
      plan,
      new Date("2026-11-20T12:00:00.000Z"),
    );
    const text = await pdfText(file.base64);
    expect(text).toContain("CORO A");
    expect(text).toContain("CORO B");
    expect(text.indexOf("ANA")).toBeLessThan(text.indexOf("BIANCA"));
    expect(text.indexOf("BIANCA")).toBeLessThan(text.indexOf("ZULEICA"));
    expect(text.indexOf("001")).toBeLessThan(text.indexOf("ANA"));
    expect(text.indexOf("004")).toBeLessThan(text.indexOf("CAIO"));
  });
});
