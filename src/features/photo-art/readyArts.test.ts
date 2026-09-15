import { describe, expect, it } from "vitest";

import { READY_ARTS } from "./readyArts";

describe("READY_ARTS", () => {
  it("exposes the seven approved Story compositions with fixed copy", () => {
    expect(READY_ARTS).toHaveLength(7);
    expect(READY_ARTS.map((art) => art.phrase)).toEqual([
      "#EuVou!",
      "Cantai para o Senhor Deus um canto novo, com arte sustentai a louvação!",
      "Música que Une, Igreja que Caminha",
      "Juntos, somos louvor.",
      "Minha voz é oração.",
      "Com Jesus, a vida tem melodia.",
      "Música que Une, Igreja que Caminha",
    ]);
  });

  it("uses a complete example and a transparent overlay for every art", () => {
    for (const art of READY_ARTS) {
      expect(art.exampleUrl).toMatch(/-example\.webp$/);
      expect(art.overlayUrl).toMatch(/-overlay\.webp$/);
      expect(art.thumbnailUrl).toMatch(/-thumb\.webp$/);
      expect(art.photoFrame.width).toBeGreaterThan(500);
      expect(art.photoFrame.height).toBeGreaterThan(600);
    }
  });

  it("includes masculine, feminine and pardo example models", () => {
    const labels = READY_ARTS.map((art) => art.modelLabel);
    expect(labels.some((label) => label.includes("homem"))).toBe(true);
    expect(labels.some((label) => label.includes("mulher"))).toBe(true);
    expect(labels.some((label) => label.includes("pardo"))).toBe(true);
    expect(labels.some((label) => label.includes("parda"))).toBe(true);
  });
});
