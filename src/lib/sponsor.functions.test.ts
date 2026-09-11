import { describe, expect, it, vi } from "vitest";

import type { AdminSponsor } from "@/features/sponsors/sponsor.domain";
import {
  createAdminSponsor,
  createSponsorFunctionHandlers,
  getAdminSponsors,
  getAdminSponsorsBootstrap,
  getPublicSponsors,
  setAdminSponsorActive,
  updateAdminSponsor,
  type SponsorServicePort,
} from "./sponsor.functions";

const saved: AdminSponsor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Patrocinador",
  logoPath: "logo.png",
  logoUrl: "https://example.test/logo.png",
  isActive: true,
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
};

function service(): SponsorServicePort {
  return {
    listPublic: vi.fn(async () => []),
    listAdmin: vi.fn(async () => []),
    create: vi.fn(async () => saved),
    update: vi.fn(async () => saved),
    setActive: vi.fn(async () => saved),
  };
}

describe("sponsor server functions", () => {
  it("uses GET only for reads and POST for every mutation", () => {
    expect(getPublicSponsors.method).toBe("GET");
    expect(getAdminSponsors.method).toBe("GET");
    expect(getAdminSponsorsBootstrap.method).toBe("GET");
    expect(createAdminSponsor.method).toBe("POST");
    expect(updateAdminSponsor.method).toBe("POST");
    expect(setAdminSponsorActive.method).toBe("POST");
  });

  it("normalizes sponsor creation before calling the service", async () => {
    const port = service();

    await createSponsorFunctionHandlers(port).create({
      name: "  Patrocinador  ",
      isActive: true,
      logo: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
    });

    expect(port.create).toHaveBeenCalledWith({
      name: "Patrocinador",
      isActive: true,
      logo: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
    });
  });

  it("rejects an invalid identifier before activation reaches the service", async () => {
    const port = service();

    await expect(
      createSponsorFunctionHandlers(port).setActive({ id: "invalid", isActive: false }),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(port.setActive).not.toHaveBeenCalled();
  });
});
