type BarcodeResult = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

export type AttendanceQrFallbackScanner = (
  stream: MediaStream,
  video: HTMLVideoElement,
  signal?: AbortSignal,
) => Promise<string>;

export function extractAttendanceTokenFromScan(value: string): string {
  try {
    const url = new URL(value);
    const token = url.pathname === "/participante/presenca" ? url.searchParams.get("token") : null;
    if (!token || token.length > 2048) throw new Error();
    return token;
  } catch {
    throw new Error("Este não é um QR Code de presença válido.");
  }
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new Error("Leitura cancelada."));
      },
      { once: true },
    );
  });
}

function waitForScanEnd(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timer = window.setTimeout(
      () =>
        reject(new Error("Não foi possível ler o QR Code. Aproxime a câmera e tente novamente.")),
      60_000,
    );
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Leitura cancelada.", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
  });
}

const scanWithZxing: AttendanceQrFallbackScanner = async (stream, video, signal) => {
  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const result = await Promise.race([
    new BrowserQRCodeReader().decodeOnceFromStream(stream, video),
    waitForScanEnd(signal),
  ]);
  return result.getText();
};

export async function scanAttendanceQr(
  video: HTMLVideoElement,
  signal?: AbortSignal,
  fallbackScanner: AttendanceQrFallbackScanner = scanWithZxing,
) {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("A câmera não está disponível neste aparelho.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  try {
    if (!Detector) {
      return extractAttendanceTokenFromScan(await fallbackScanner(stream, video, signal));
    }

    const deadline = Date.now() + 60_000;
    const detector = new Detector({ formats: ["qr_code"] });
    video.srcObject = stream;
    await video.play();
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error("Leitura cancelada.");
      const result = await detector.detect(video);
      if (result[0]?.rawValue) return extractAttendanceTokenFromScan(result[0].rawValue);
      await delay(150, signal);
    }
    throw new Error("Não foi possível ler o QR Code. Aproxime a câmera e tente novamente.");
  } finally {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  }
}
