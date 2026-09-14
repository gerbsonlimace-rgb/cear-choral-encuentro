export type ArtStyle = "classica" | "leve" | "criativa" | "amarela" | "melodia" | "quixada";
export type ArtFormat = "feed" | "story";
export type PhotoAdjustment = { zoom: number; x: number; y: number };
export type PhotoRect = { x: number; y: number; width: number; height: number };
export type FaceBox = { x: number; y: number; width: number; height: number };

export type FaceDetectorLike = {
  detect: (image: HTMLImageElement) => Promise<ReadonlyArray<{ boundingBox: FaceBox }>>;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorLike;

export const ART_STYLES = [
  { id: "classica", name: "Clássica", description: "Preto e dourado" },
  { id: "leve", name: "Leve", description: "Luz e movimento" },
  { id: "criativa", name: "Jovem", description: "Orgânica e musical" },
  { id: "amarela", name: "Amarela", description: "Vibrante e alegre" },
  { id: "melodia", name: "Melodia", description: "Suave e circular" },
  {
    id: "quixada",
    name: "Quixadá",
    description: "Cedro, Galinha Choca e Santuário",
  },
] as const;

export const ART_PHRASES = [
  { id: "eu-vou", text: "#EuVou!", lines: ["#EuVou!"] },
  {
    id: "canto-novo",
    text: "Cantai para o Senhor Deus um canto novo, com arte sustentai a louvação!",
    lines: ["Cantai para o Senhor Deus", "um canto novo,", "com arte sustentai a louvação!"],
  },
  {
    id: "musica-une",
    text: "Música que Une, Igreja que Caminha",
    lines: ["Música que Une,", "Igreja que Caminha"],
  },
  { id: "oracao", text: "Minha voz é oração.", lines: ["Minha voz", "é oração."] },
  { id: "louvor", text: "Juntos, somos louvor.", lines: ["Juntos,", "somos louvor."] },
  {
    id: "melodia",
    text: "Com Jesus, a vida tem melodia.",
    lines: ["Com Jesus, a vida", "tem melodia."],
  },
] as const;
export type ArtPhrase = (typeof ART_PHRASES)[number]["id"];

export const ART_FORMATS = {
  feed: { width: 1080, height: 1350, label: "Feed", ratio: "4:5" },
  story: { width: 1080, height: 1920, label: "Story / Status", ratio: "9:16" },
} as const;
export const DEFAULT_ADJUSTMENT: PhotoAdjustment = { zoom: 1, x: 0, y: 0 };

let browserFaceDetector: FaceDetectorLike | null | undefined;

function getBrowserFaceDetector(): FaceDetectorLike | null {
  if (browserFaceDetector !== undefined) return browserFaceDetector;
  const Detector = (globalThis as typeof globalThis & { FaceDetector?: FaceDetectorConstructor })
    .FaceDetector;
  if (!Detector) {
    browserFaceDetector = null;
    return browserFaceDetector;
  }
  try {
    browserFaceDetector = new Detector({ fastMode: true, maxDetectedFaces: 5 });
  } catch {
    browserFaceDetector = null;
  }
  return browserFaceDetector;
}

function getAxisAdjustment(
  drawnLength: number,
  frameLength: number,
  faceCenter: number,
  target: number,
): number {
  const overflow = drawnLength - frameLength;
  if (overflow <= 0) return 0;
  const crop = Math.max(0, Math.min(overflow, faceCenter - target));
  return Math.max(-1, Math.min(1, 1 - (crop / overflow) * 2));
}

export function getFaceAwareAdjustment(
  photoWidth: number,
  photoHeight: number,
  frame: PhotoRect,
  face: FaceBox,
): PhotoAdjustment {
  const scale = Math.max(frame.width / photoWidth, frame.height / photoHeight);
  const drawnWidth = photoWidth * scale;
  const drawnHeight = photoHeight * scale;
  const faceCenterX = (face.x + face.width / 2) * scale;
  const faceCenterY = (face.y + face.height / 2) * scale;

  return {
    // Preserve the minimum cover scale. Automatic framing must not turn a portrait into a close-up.
    zoom: 1,
    x: getAxisAdjustment(drawnWidth, frame.width, faceCenterX, frame.width * 0.5),
    y: getAxisAdjustment(drawnHeight, frame.height, faceCenterY, frame.height * 0.34),
  };
}

export async function detectFaceAdjustment(
  photo: HTMLImageElement,
  frame: PhotoRect,
  detector: FaceDetectorLike | null = getBrowserFaceDetector(),
): Promise<PhotoAdjustment | null> {
  if (!detector) return null;
  try {
    const faces = await detector.detect(photo);
    const primaryFace = faces
      .filter(
        ({ boundingBox }) =>
          Number.isFinite(boundingBox.x) &&
          Number.isFinite(boundingBox.y) &&
          boundingBox.width > 0 &&
          boundingBox.height > 0,
      )
      .sort(
        (left, right) =>
          right.boundingBox.width * right.boundingBox.height -
          left.boundingBox.width * left.boundingBox.height,
      )[0]?.boundingBox;
    if (!primaryFace) return null;
    return getFaceAwareAdjustment(photo.naturalWidth, photo.naturalHeight, frame, primaryFace);
  } catch {
    return null;
  }
}

export function validatePhoto(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) {
    return "Escolha uma foto em JPG, PNG, WebP ou HEIC.";
  }
  if (file.size === 0) return "O arquivo está vazio. Escolha outra foto.";
  if (file.size > 20 * 1024 * 1024) return "A foto deve ter até 20 MB. Escolha uma versão menor.";
  return null;
}

export function getPhotoPlacement(
  width: number,
  height: number,
  frame: PhotoRect,
  adjustment: PhotoAdjustment,
): PhotoRect {
  const scale = Math.max(frame.width / width, frame.height / height) * Math.max(1, adjustment.zoom);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  return {
    x: frame.x - ((drawnWidth - frame.width) * (1 - Math.max(-1, Math.min(1, adjustment.x)))) / 2,
    y: frame.y - ((drawnHeight - frame.height) * (1 - Math.max(-1, Math.min(1, adjustment.y)))) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a imagem. Tente outra foto."));
    image.src = src;
  });
}

export async function loadPhoto(file: File): Promise<HTMLImageElement> {
  const error = validatePhoto(file);
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  try {
    const photo = await loadImage(url);
    if (
      !photo.naturalWidth ||
      !photo.naturalHeight ||
      photo.naturalWidth * photo.naturalHeight > 60_000_000
    ) {
      throw new Error(
        "Essa foto tem dimensões muito grandes. Escolha uma versão de até 60 megapixels.",
      );
    }
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type SharingNavigator = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export async function sharePhotoFile(
  file: File,
  target: SharingNavigator = navigator,
): Promise<"shared" | "unsupported" | "cancelled"> {
  if (!target.canShare || !target.share || !target.canShare({ files: [file] }))
    return "unsupported";
  try {
    // Called with an already-generated file to preserve the browser's user activation.
    await target.share({ files: [file], title: "Minha foto • II Encontro de Coros • Quixadá" });
    return "shared";
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    )
      return "cancelled";
    throw error;
  }
}

export function downloadPhotoFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some mobile browsers consume download URLs asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canvasToPhotoFile(
  canvas: HTMLCanvasElement,
  style: string,
  format: ArtFormat,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Não foi possível gerar a imagem. Tente novamente."));
      resolve(
        new File([blob], `encontro-coros-quixada-${style}-${format}.png`, { type: "image/png" }),
      );
    }, "image/png");
  });
}
