import type { PhotoRect } from "./photoArt";
import type { ReadyArtId } from "./readyArts";

type Curve = readonly [number, number, number, number, number, number];
type Opening = { start: readonly [number, number]; curves: readonly Curve[]; bounds: PhotoRect };

// Traced along the inner white borders of the approved 941 × 1672 artwork.
// The original WebP alpha masks leave strips of the sample portraits behind.
// Use one contour for both the photo and the overlay, including the Quixadá foreground.
const OPENINGS: Record<ReadyArtId, Opening> = {
  "eu-vou": {
    start: [247, 380],
    curves: [
      [263, 350, 573, 317, 643, 314],
      [714, 309, 735, 331, 744, 384],
      [763, 534, 787, 992, 783, 1124],
      [782, 1191, 766, 1222, 700, 1213],
      [516, 1184, 315, 1186, 202, 1165],
      [158, 1157, 154, 1138, 162, 1069],
      [180, 873, 202, 529, 226, 432],
      [232, 408, 239, 392, 247, 380],
    ],
    bounds: { x: 154, y: 309, width: 633, height: 913 },
  },
  "canto-novo": {
    start: [491, 372],
    curves: [
      [683, 364, 852, 522, 859, 707],
      [871, 909, 711, 1087, 511, 1084],
      [304, 1088, 119, 937, 117, 729],
      [112, 533, 289, 377, 491, 372],
    ],
    bounds: { x: 112, y: 364, width: 759, height: 724 },
  },
  "musica-une": {
    start: [273, 352],
    curves: [
      [352, 331, 612, 311, 685, 312],
      [762, 311, 783, 334, 793, 413],
      [809, 542, 812, 922, 805, 1052],
      [802, 1151, 782, 1232, 698, 1226],
      [529, 1205, 363, 1203, 233, 1189],
      [164, 1184, 151, 1153, 150, 1085],
      [143, 928, 169, 642, 200, 483],
      [211, 416, 230, 366, 273, 352],
    ],
    bounds: { x: 143, y: 311, width: 669, height: 921 },
  },
  "juntos-louvor": {
    start: [146, 400],
    curves: [
      [311, 371, 586, 320, 684, 311],
      [731, 305, 751, 322, 753, 365],
      [767, 553, 792, 837, 813, 1023],
      [819, 1064, 795, 1085, 749, 1090],
      [590, 1111, 335, 1153, 207, 1162],
      [151, 1168, 130, 1140, 127, 1092],
      [123, 926, 124, 725, 109, 566],
      [105, 516, 99, 466, 101, 439],
      [103, 417, 119, 405, 146, 400],
    ],
    bounds: { x: 99, y: 305, width: 720, height: 863 },
  },
  "minha-voz": {
    start: [257, 376],
    curves: [
      [340, 348, 564, 310, 649, 313],
      [732, 307, 760, 337, 771, 409],
      [793, 544, 807, 833, 807, 1004],
      [811, 1087, 788, 1130, 734, 1127],
      [622, 1114, 567, 1090, 448, 1084],
      [355, 1079, 267, 1078, 214, 1057],
      [181, 1040, 180, 1000, 184, 946],
      [195, 774, 209, 550, 227, 450],
      [234, 410, 240, 389, 257, 376],
    ],
    bounds: { x: 180, y: 307, width: 631, height: 823 },
  },
  "vida-melodia": {
    start: [510, 347],
    curves: [
      [703, 340, 853, 509, 849, 711],
      [852, 932, 704, 1141, 511, 1142],
      [285, 1149, 123, 976, 140, 763],
      [136, 555, 308, 351, 510, 347],
    ],
    bounds: { x: 136, y: 345, width: 716, height: 804 },
  },
  quixada: {
    start: [263, 373],
    curves: [
      [345, 348, 584, 317, 672, 329],
      [732, 334, 747, 381, 758, 465],
      [770, 585, 776, 781, 773, 893],
      [771, 944, 756, 978, 722, 997],
      [699, 1009, 663, 1016, 629, 1016],
      // Follow the sun and the rock silhouette so these stay above the photo.
      [621, 991, 598, 968, 567, 958],
      [536, 950, 509, 955, 482, 966],
      [472, 945, 456, 936, 438, 937],
      [421, 937, 407, 944, 396, 957],
      [397, 966, 400, 973, 410, 978],
      [407, 985, 403, 999, 401, 1012],
      [339, 1008, 261, 1001, 224, 983],
      [186, 969, 182, 943, 185, 902],
      [195, 729, 209, 536, 229, 444],
      [237, 408, 245, 385, 263, 373],
    ],
    bounds: { x: 182, y: 317, width: 594, height: 699 },
  },
};

export function getReadyArtPhotoFrame(id: ReadyArtId): PhotoRect {
  const { x, y, width, height } = OPENINGS[id].bounds;
  return {
    x: (x * 1080) / 941,
    y: (y * 1920) / 1672,
    width: (width * 1080) / 941,
    height: (height * 1920) / 1672,
  };
}

/** Appends the opening to the current path without changing the caller's transform. */
export function appendPhotoOpening(context: CanvasRenderingContext2D, id: ReadyArtId) {
  const opening = OPENINGS[id];
  context.save();
  context.scale(1080 / 941, 1920 / 1672);
  context.moveTo(...opening.start);
  for (const curve of opening.curves) context.bezierCurveTo(...curve);
  context.closePath();
  context.restore();
}
