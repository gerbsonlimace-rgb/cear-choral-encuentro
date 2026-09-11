import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseAdminMock }));

import {
  createSupabaseSponsorLogoStorage,
  createSupabaseSponsorRepository,
} from "./sponsor.repository.server";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Patrocinador",
  logo_path: "logo.png",
  is_active: true,
  created_at: "2026-09-10T12:00:00.000Z",
  updated_at: "2026-09-10T12:00:00.000Z",
};

describe("Supabase sponsor repository", () => {
  beforeEach(() => {
    supabaseAdminMock.from.mockReset();
    supabaseAdminMock.storage.from.mockReset();
    supabaseAdminMock.storage.from.mockReturnValue({
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://example.test/storage/v1/object/public/sponsor-logos/${path}` },
      }),
    });
  });

  it("maps persisted logo paths to public URLs", async () => {
    supabaseAdminMock.from.mockReturnValue({
      select: vi.fn(async () => ({ data: [row], error: null })),
    });

    await expect(createSupabaseSponsorRepository().list()).resolves.toEqual([
      {
        id: row.id,
        name: "Patrocinador",
        logoPath: "logo.png",
        logoUrl: "https://example.test/storage/v1/object/public/sponsor-logos/logo.png",
        isActive: true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ]);
  });

  it("returns a safe duplicate-name error during creation", async () => {
    const single = vi.fn(async () => ({ data: null, error: { code: "23505" } }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    supabaseAdminMock.from.mockReturnValue({ insert });

    await expect(
      createSupabaseSponsorRepository().create({
        name: "Patrocinador",
        logoPath: "logo.png",
        isActive: true,
      }),
    ).rejects.toThrow("Já existe um patrocinador com esse nome.");
  });
});

describe("Supabase sponsor logo storage", () => {
  it("uploads immutable public image objects with the validated content type", async () => {
    const upload = vi.fn(async () => ({ data: { path: "logo.png" }, error: null }));
    supabaseAdminMock.storage.from.mockReturnValue({ upload });
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    await createSupabaseSponsorLogoStorage().upload({
      path: "logo.png",
      bytes,
      contentType: "image/png",
    });

    expect(upload).toHaveBeenCalledWith("logo.png", bytes, {
      cacheControl: "31536000",
      contentType: "image/png",
      upsert: false,
    });
  });

  it("surfaces a safe error when an upload fails", async () => {
    supabaseAdminMock.storage.from.mockReturnValue({
      upload: vi.fn(async () => ({ data: null, error: { message: "secret detail" } })),
    });

    await expect(
      createSupabaseSponsorLogoStorage().upload({
        path: "logo.png",
        bytes: new Uint8Array([1]),
        contentType: "image/png",
      }),
    ).rejects.toThrow("Não foi possível enviar a logo do patrocinador.");
  });
});
