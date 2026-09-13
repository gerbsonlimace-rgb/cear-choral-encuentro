import { describe, expect, it } from "vitest";

import { getChoristerVoiceStyle, voiceStyles } from "./choristerVoiceStyles";

describe("CoroApp voice color mapping", () => {
  it.each([
    ["principal", "Principal", "bg-primary"],
    ["soprano", "Soprano", "bg-pink-500"],
    ["contralto", "Contralto", "bg-yellow-500"],
    ["tenor", "Tenor", "bg-emerald-500"],
    ["baixo", "Baixo", "bg-blue-500"],
    ["todos", "todos", "bg-zinc-200"],
  ] as const)("keeps the canonical %s token", (voice, label, activeClass) => {
    expect(voiceStyles[voice].label).toBe(label);
    expect(voiceStyles[voice].filterClass).toContain(activeClass);
  });

  it("adds a non-color selected indicator while keeping the textual label", () => {
    expect(getChoristerVoiceStyle("soprano", true)).toMatchObject({
      label: "Soprano",
      selected: true,
    });
    expect(getChoristerVoiceStyle("soprano", true).filterButtonClass).toContain("ring-2");
    expect(getChoristerVoiceStyle("soprano", false).filterButtonClass).not.toContain("ring-2");
  });
});
