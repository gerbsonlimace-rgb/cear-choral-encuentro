import { MAX_REGISTRATION_PHOTO_BYTES, type RegistrationPhotoInput } from "./registration.domain";

const acceptedPhotoTypes = new Set<RegistrationPhotoInput["contentType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BADGE_PHOTO_DIMENSION = 1200;

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Não foi possível ler a foto."));
    });
    reader.addEventListener("error", () => reject(new Error("Não foi possível ler a foto.")));
    reader.readAsDataURL(file);
  });
}

async function resizePhotoForBadge(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;

  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_BADGE_PHOTO_DIMENSION / image.width,
      MAX_BADGE_PHOTO_DIMENSION / image.height,
    );
    if (scale === 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/webp", 0.84);
    });
  } finally {
    image.close();
  }
}

export async function prepareRegistrationPhoto(file: File): Promise<{
  payload: RegistrationPhotoInput;
  previewUrl: string;
}> {
  if (!acceptedPhotoTypes.has(file.type as RegistrationPhotoInput["contentType"])) {
    throw new Error("Envie uma foto em JPG, PNG ou WebP.");
  }
  if (file.size === 0 || file.size > MAX_REGISTRATION_PHOTO_BYTES) {
    throw new Error("A foto deve ter até 5 MB.");
  }

  const preparedFile = await resizePhotoForBadge(file);
  if (preparedFile.size === 0 || preparedFile.size > MAX_REGISTRATION_PHOTO_BYTES) {
    throw new Error("A foto deve ter até 5 MB.");
  }

  const previewUrl = await readFileAsDataUrl(preparedFile);
  const separator = previewUrl.indexOf(",");
  if (separator < 0) throw new Error("Não foi possível ler a foto.");

  return {
    payload: {
      contentType: preparedFile.type as RegistrationPhotoInput["contentType"],
      dataBase64: previewUrl.slice(separator + 1),
    },
    previewUrl,
  };
}
