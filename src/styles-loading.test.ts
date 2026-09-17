import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const rootRoute = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");

describe("global font loading", () => {
  it("keeps external Google Fonts out of the lightningcss stylesheet pipeline", () => {
    expect(styles).not.toMatch(/@import\s+url\(\s*["']https:\/\/fonts\.googleapis\.com/i);
    expect(rootRoute).toContain("family=Inter");
    expect(rootRoute).toContain("family=Playfair+Display");
  });
});
