import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverFile } from "./file-download";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("file delivery", () => {
  it("downloads the prepared file even when an embedded browser rejects canShare", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => { throw new Error("denied"); } });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:prepared"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await deliverFile(new Blob(["%PDF-1.4"], { type: "application/pdf" }), "inscricoes.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });
  it("invokes mobile sharing with the prepared PDF immediately", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    const result = deliverFile(new Blob(["%PDF-1.4"], { type: "application/pdf" }), "inscricoes.pdf");
    expect(share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: "inscricoes.pdf", type: "application/pdf" })], title: "inscricoes.pdf" });
    await result;
  });
});