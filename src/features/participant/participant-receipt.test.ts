import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PDFDocument, PageSizes } from "pdf-lib";
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
    includeShirt: false,
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

describe("participant receipt", () => {
  it("builds one safe A4 receipt with metadata and a sanitized filename", async () => {
    const logoBytes = await readFile(logoPath);

    const receipt = await buildParticipantReceipt(paidView, logoBytes);
    const document = await PDFDocument.load(receipt.bytes);
    const [page] = document.getPages();
    const serialized = new TextDecoder("latin1").decode(receipt.bytes);

    expect(document.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(PageSizes.A4[0], 1);
    expect(page.getHeight()).toBeCloseTo(PageSizes.A4[1], 1);
    expect(document.getTitle()).toBe("Comprovante de inscrição - II Encontro de Coros");
    expect(document.getAuthor()).toBe(
      "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 - CNBB",
    );
    expect(receipt.filename).toBe("comprovante-inscricao-pedido-1234.pdf");
    expect(serialized).not.toContain(rawCpf);
    expect(serialized).not.toContain(privateReceiptUrl);
    expect(serialized).not.toContain("registration-photos/private-photo.png");
    expect(serialized).not.toContain("private-token");
  });

  it("downloads through a temporary object URL and always revokes it", async () => {
    const logoBytes = await readFile(logoPath);
    const fetchLogo = vi.fn().mockResolvedValue(
      new Response(logoBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const createObjectURL = vi.fn().mockReturnValue("blob:participant-receipt");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });
    vi.stubGlobal("fetch", fetchLogo);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    await expect(downloadParticipantReceipt(paidView)).rejects.toThrow("download blocked");

    expect(fetchLogo).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:participant-receipt");
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
  });
});
