import { describe, expect, it, vi } from "vitest";

import type { AdminSponsor, SponsorCreate } from "./sponsor.domain";
import {
  createSponsorService,
  type SponsorLogoStorage,
  type SponsorRepository,
} from "./sponsor.server";

const now = "2026-09-10T12:00:00.000Z";
const activeSponsor: AdminSponsor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Zeta",
  logoPath: "old.png",
  logoUrl: "https://example.supabase.co/storage/v1/object/public/sponsor-logos/old.png",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};
const inactiveSponsor: AdminSponsor = {
  ...activeSponsor,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Alfa",
  isActive: false,
};
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTES = Uint8Array.from(atob(PNG_BASE64), (character) => character.charCodeAt(0));
const pngLogo = { base64: PNG_BASE64, mimeType: "image/png" as const };

function repository(overrides: Partial<SponsorRepository> = {}): SponsorRepository {
  return {
    list: vi.fn(async () => []),
    find: vi.fn(async () => activeSponsor),
    create: vi.fn(async ({ name, isActive, logoPath }) => ({
      ...activeSponsor,
      name,
      isActive,
      logoPath,
    })),
    update: vi.fn(async (id, input) => ({ ...activeSponsor, id, ...input })),
    setActive: vi.fn(async (id, isActive) => ({ ...activeSponsor, id, isActive })),
    ...overrides,
  };
}

function storage(): SponsorLogoStorage {
  return {
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
}

describe("sponsor service", () => {
  it("publishes only active sponsors in alphabetical order", async () => {
    const service = createSponsorService(
      repository({
        list: vi.fn(async () => [
          activeSponsor,
          inactiveSponsor,
          { ...activeSponsor, id: "3", name: "Beta" },
        ]),
      }),
      storage(),
    );

    await expect(service.listPublic()).resolves.toEqual([
      { id: "3", name: "Beta", logoUrl: activeSponsor.logoUrl },
      { id: activeSponsor.id, name: "Zeta", logoUrl: activeSponsor.logoUrl },
    ]);
  });

  it("uploads a validated logo before creating the sponsor", async () => {
    const repo = repository();
    const logos = storage();
    const service = createSponsorService(repo, logos, () => "new-logo-id");
    const input: SponsorCreate = { name: "Patrocinador", isActive: true, logo: pngLogo };

    await service.create(input);

    expect(logos.upload).toHaveBeenCalledWith({
      path: "new-logo-id.png",
      bytes: PNG_BYTES,
      contentType: "image/png",
    });
    expect(repo.create).toHaveBeenCalledWith({
      name: "Patrocinador",
      isActive: true,
      logoPath: "new-logo-id.png",
    });
  });

  it("removes a newly uploaded logo if sponsor creation fails", async () => {
    const repo = repository({
      create: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const logos = storage();
    const service = createSponsorService(repo, logos, () => "new-logo-id");

    await expect(
      service.create({ name: "Patrocinador", isActive: true, logo: pngLogo }),
    ).rejects.toThrow("database unavailable");
    expect(logos.remove).toHaveBeenCalledWith(["new-logo-id.png"]);
  });

  it("keeps the old logo until a replacement is saved, then removes it", async () => {
    const repo = repository();
    const logos = storage();
    const service = createSponsorService(repo, logos, () => "replacement-id");

    await service.update({
      id: activeSponsor.id,
      name: "Nome novo",
      isActive: true,
      logo: pngLogo,
    });

    expect(repo.update).toHaveBeenCalledWith(activeSponsor.id, {
      name: "Nome novo",
      isActive: true,
      logoPath: "replacement-id.png",
    });
    expect(logos.remove).toHaveBeenCalledWith(["old.png"]);
  });

  it("keeps the saved replacement when cleanup of the old logo fails", async () => {
    const repo = repository();
    const logos = storage();
    logos.remove = vi.fn(async (paths) => {
      if (paths[0] === "old.png") throw new Error("storage unavailable");
    });
    const service = createSponsorService(repo, logos, () => "replacement-id");

    await expect(
      service.update({
        id: activeSponsor.id,
        name: "Nome novo",
        isActive: true,
        logo: pngLogo,
      }),
    ).resolves.toMatchObject({ logoPath: "replacement-id.png" });
    expect(logos.remove).not.toHaveBeenCalledWith(["replacement-id.png"]);
  });
});
