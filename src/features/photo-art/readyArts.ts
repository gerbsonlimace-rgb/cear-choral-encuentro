import type { PhotoRect } from "./photoArt";

export type ReadyArtId =
  | "eu-vou"
  | "canto-novo"
  | "musica-une"
  | "juntos-louvor"
  | "minha-voz"
  | "vida-melodia"
  | "quixada";

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

function art(
  id: ReadyArtId,
  name: string,
  phrase: string,
  modelLabel: string,
  photoFrame: PhotoRect,
): ReadyArt {
  const base = `/photo-art-templates/${id}`;
  return {
    id,
    name,
    phrase,
    modelLabel,
    photoFrame,
    exampleUrl: `${base}-example.webp`,
    overlayUrl: `${base}-overlay.webp`,
    thumbnailUrl: `${base}-thumb.webp`,
  };
}

export const READY_ARTS = [
  art("eu-vou", "#EuVou!", "#EuVou!", "homem", {
    x: 194,
    y: 390,
    width: 674,
    height: 986,
  }),
  art(
    "canto-novo",
    "Canto novo",
    "Cantai para o Senhor Deus um canto novo, com arte sustentai a louvação!",
    "mulher",
    { x: 145, y: 437, width: 822, height: 808 },
  ),
  art("musica-une", "Música que une", "Música que Une, Igreja que Caminha", "homem pardo", {
    x: 205,
    y: 366,
    width: 701,
    height: 992,
  }),
  art("juntos-louvor", "Juntos no louvor", "Juntos, somos louvor.", "mulher parda", {
    x: 134,
    y: 374,
    width: 724,
    height: 936,
  }),
  art("minha-voz", "Minha voz", "Minha voz é oração.", "mulher", {
    x: 213,
    y: 382,
    width: 687,
    height: 860,
  }),
  art("vida-melodia", "Vida e melodia", "Com Jesus, a vida tem melodia.", "homem pardo", {
    x: 166,
    y: 402,
    width: 794,
    height: 908,
  }),
  art("quixada", "Quixadá", "Música que Une, Igreja que Caminha", "mulher parda", {
    x: 218,
    y: 387,
    width: 662,
    height: 735,
  }),
] as const satisfies readonly ReadyArt[];

export function getReadyArt(id: ReadyArtId): ReadyArt {
  return READY_ARTS.find((item) => item.id === id) ?? READY_ARTS[0];
}
