import { describe, expect, it, vi } from "vitest";

import { extractAttendanceTokenFromScan, scanAttendanceQr } from "./attendanceQrScanner";

describe("attendance QR scanner", () => {
  it("extracts only bounded participant attendance URLs", () => {
    expect(extractAttendanceTokenFromScan("https://evento.test/participante/presenca?token=signed-token")).toBe("signed-token");
    expect(() => extractAttendanceTokenFromScan("https://evento.test/inscricao?token=signed-token")).toThrow("QR Code de presença");
    expect(() => extractAttendanceTokenFromScan("plain text")).toThrow("QR Code de presença");
  });

  it("stops every camera track after reading a code", async () => {
    const stop = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }, { stop }] }) } });
    vi.stubGlobal("BarcodeDetector", class {
      detect = vi.fn().mockResolvedValue([{ rawValue: "https://evento.test/participante/presenca?token=signed" }]);
    });
    const video = { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement;
    await expect(scanAttendanceQr(video)).resolves.toBe("signed");
    expect(stop).toHaveBeenCalledTimes(2);
    expect(video.srcObject).toBeNull();
  });
});
