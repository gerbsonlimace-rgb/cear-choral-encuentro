import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, PageSizes } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { buildParticipantReceipt, downloadParticipantReceipt } from "./participant-receipt";

const logoPath = resolve(process.cwd(), "src/assets/logo-coros-preto.png");
const rawCpf = "52998224725";
const privateReceiptUrl = `https://provider.example/receipt/${rawCpf}?token=private-token`;

const paidView: ParticipantRegistrationView = {
  identity: {
    name: "Maria da Silva",
    cpf: "***.***.***-25" as MaskedCpf,
    birthDate: "1990-01-15",
    email: "maria@example.com",
    photoUrl: "registration-photos/private-photo.png",
  },
  registration: {
    choirName: "Coral Santa Cecília",
    diocese: "Diocese de Quixadá",
  },
  payment: {
    status: "paid",
    paidAmountCents: 12500,
    paymentMethod: "credit_card",
    installments: 3,
    paidAt: "2026-09-10T15:30:00.000Z",
    orderNsu: " Pedido / 1234 ?? ",
    receiptUrl: privateReceiptUrl,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function extractDrawnPageText(document: PDFDocument): string {
  const contents = document.getPages()[0]?.node.Contents();
  if (!contents) return "";
  const streamReferences = contents instanceof PDFArray ? contents.asArray() : [contents];
  const decodedOperators = streamReferences
    .map((reference) => {
      const stream = document.context.lookup(reference);
      if (!(stream instanceof PDFRawStream)) throw new Error("Expected a raw PDF content stream");
      return new TextDecoder("windows-1252").decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");

  return Array.from(decodedOperators.matchAll(/<([0-9a-f]+)>\s*Tj/gi), ([, hexadecimal]) => {
    const bytes = Uint8Array.from(
      hexadecimal.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
    );
    return new TextDecoder("windows-1252").decode(bytes);
  }).join("\n");
}

describe("participant receipt", () => {
  it("builds one safe A4 receipt with metadata and a sanitized filename", async () => {
    const logoBytes = await readFile(logoPath);

    const receipt = await buildParticipantReceipt(paidView, logoBytes);
    const document = await PDFDocument.load(receipt.bytes);
    const [page] = document.getPages();
    const drawnText = extractDrawnPageText(document);

    expect(document.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(PageSizes.A4[0], 1);
    expect(page.getHeight()).toBeCloseTo(PageSizes.A4[1], 1);
    expect(document.getTitle()).toBe("Comprovante de inscrição - II Encontro de Coros");
    expect(document.getAuthor()).toBe(
      "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    );
    expect(receipt.filename).toBe("comprovante-inscricao-pedido-1234.pdf");
    for (const visibleValue of [
      "Maria da Silva",
      "***.***.***-25",
      "Pago",
      "Cartão de crédito",
      "3x",
      "R$ 125,00",
      "10/09/2026 às 12:30 (horário de Fortaleza)",
      "Pedido / 1234 ??",
    ]) {
      expect(drawnText).toContain(visibleValue);
    }
    expect(drawnText).not.toContain(rawCpf);
    expect(drawnText).not.toContain(privateReceiptUrl);
    expect(drawnText).not.toContain("registration-photos/private-photo.png");
    expect(drawnText).not.toContain("private-token");
  });

  it("downloads through a temporary object URL and always revokes it", async () => {
    const logoBytes = await readFile(logoPath);
    const fetchLogo = vi.fn().mockResolvedValue(
      new Response(logoBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:participant-receipt");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });
    vi.stubGlobal("fetch", fetchLogo);

    await expect(downloadParticipantReceipt(paidView)).rejects.toThrow("download blocked");

    expect(fetchLogo).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:participant-receipt");
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
  });

  it("revokes the object URL when temporary anchor creation fails", async () => {
    const logoBytes = await readFile(logoPath);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(logoBytes, { status: 200 })));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:participant-receipt");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("anchor creation blocked");
    });

    await expect(downloadParticipantReceipt(paidView)).rejects.toThrow("anchor creation blocked");

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:participant-receipt");
  });
});
