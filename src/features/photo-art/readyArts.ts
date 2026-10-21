import type { PhotoRect } from "./photoArt";
import { getReadyArtPhotoFrame } from "./photoOpenings";

export type ReadyArtId =
  | "eu-vou"
  | "canto-novo"
  | "musica-une"
  | "juntos-louvor"
  | "minha-voz"
  | "vida-melodia"
  | "quixada"
  | "quixada-eu-vou"
  | "quixada-eu-vou-azul";

export type ReadyArt = {
  id: ReadyArtId;
  name: string;
  phrase: string;
  modelLabel: string;
  exampleUrl: string;
  overlayUrl: string;
  thumbnailUrl: string;
  photoFrame: PhotoRect;
};

function art(id: ReadyArtId, name: string, phrase: string, modelLabel: string): ReadyArt {
  const base = `/photo-art-templates/${id}`;
  return {
    id,
    name,
    phrase,
    modelLabel,
    photoFrame: getReadyArtPhotoFrame(id),
    exampleUrl: `${base}-example.webp`,
    overlayUrl: `${base}-overlay.webp`,
    thumbnailUrl: `${base}-thumb.webp`,
  };
}

export const READY_ARTS = [
  art("eu-vou", "#EuVou!", "#EuVou!", "homem"),
  art(
    "canto-novo",
    "Canto novo",
    "Cantai para o Senhor Deus um canto novo, com arte sustentai a louvação!",
    "mulher",
  ),
  art("musica-une", "Música que une", "Música que Une, Igreja que Caminha", "homem pardo"),
  art("juntos-louvor", "Juntos no louvor", "Juntos, somos louvor.", "mulher parda"),
  art("minha-voz", "Minha voz", "Minha voz é oração.", "mulher"),
  art("vida-melodia", "Vida e melodia", "Com Jesus, a vida tem melodia.", "homem pardo"),
  art("quixada", "Quixadá", "Música que Une, Igreja que Caminha", "mulher parda"),
  art(
    "quixada-eu-vou",
    "Quixadá: eu vou (dourado)",
    "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 – CNBB — Eu vou!",
    "mulher parda",
  ),
  art(
    "quixada-eu-vou-azul",
    "Quixadá: eu vou (azul)",
    "II Encontro de Coros Diocesanos e Litúrgicos do Regional Nordeste 1 – CNBB — Eu vou!",
    "mulher parda",
  ),
] as const satisfies readonly ReadyArt[];

export function getReadyArt(id: ReadyArtId): ReadyArt {
  return READY_ARTS.find((item) => item.id === id) ?? READY_ARTS[0];
}
