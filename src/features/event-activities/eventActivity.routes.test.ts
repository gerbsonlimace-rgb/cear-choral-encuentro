import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("event activity routes", () => {
  it("registers admin and participant attendance routes", () => {
    const routeTree = read("src/routeTree.gen.ts");
    expect(routeTree).toContain("/admin/atividades");
    expect(routeTree).toContain("/participante/presenca");
  });

  it("guards the admin route and bounds the scanned token", () => {
    const adminRoute = read("src/routes/admin.atividades.tsx");
    const participantRoute = read("src/routes/participante.presenca.tsx");
    expect(adminRoute).toContain("getAdminAccess");
    expect(adminRoute).toContain('redirect({ to: "/acessar" })');
    expect(participantRoute).toContain("z.string().max(2048)");
    expect(participantRoute).toContain('noindex, nofollow');
  });
});
