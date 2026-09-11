import { describe, expect, it, vi } from "vitest";

import type { AdminChoir, ChoirMutation, PricingSettings } from "./choir-pricing.domain";
import { createChoirPricingService, type ChoirPricingRepository } from "./choir-pricing.server";

const settings: PricingSettings = {
  standardPriceCents: 30000,
  promotionalPriceCents: 10000,
  shirtPriceCents: 5000,
};

const normalChoir: AdminChoir = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Coro Diocesano de Sobral",
  usesPromotionalPrice: false,
  isActive: true,
  createdAt: "2026-09-09T12:00:00.000Z",
  updatedAt: "2026-09-09T12:00:00.000Z",
};

const promotionalChoir: AdminChoir = {
  ...normalChoir,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Coro Arquidiocesano de Fortaleza",
  usesPromotionalPrice: true,
};

function repository(overrides: Partial<ChoirPricingRepository> = {}): ChoirPricingRepository {
  return {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async (input) => input),
    listChoirs: vi.fn(async () => [normalChoir, promotionalChoir]),
    findChoir: vi.fn(
      async (id) => [normalChoir, promotionalChoir].find((choir) => choir.id === id) ?? null,
    ),
    createChoir: vi.fn(async (input: ChoirMutation) => ({
      ...normalChoir,
      ...input,
      id: "33333333-3333-4333-8333-333333333333",
    })),
    updateChoir: vi.fn(async (_id, input) => ({ ...normalChoir, ...input })),
    setChoirActive: vi.fn(async (_id, isActive) => ({ ...normalChoir, isActive })),
    ...overrides,
  };
}

describe("choir pricing service", () => {
  it("returns only active and resolvable public choirs with the configured shirt price", async () => {
    const unavailable = {
      ...normalChoir,
      id: "44444444-4444-4444-8444-444444444444",
      isActive: false,
    };
    const service = createChoirPricingService(
      repository({ listChoirs: vi.fn(async () => [normalChoir, unavailable, promotionalChoir]) }),
    );

    await expect(service.getPublicConfiguration()).resolves.toEqual({
      shirtPriceCents: 5000,
      choirs: [
        {
          id: promotionalChoir.id,
          name: promotionalChoir.name,
          pricingType: "promotional",
          standardPriceCents: 30000,
          registrationPriceCents: 10000,
        },
        {
          id: normalChoir.id,
          name: normalChoir.name,
          pricingType: "standard",
          standardPriceCents: 30000,
          registrationPriceCents: 30000,
        },
      ],
    });
  });

  it("omits a promotional choir when its global promotional price is unavailable", async () => {
    const service = createChoirPricingService(
      repository({
        getSettings: vi.fn(async () => ({ ...settings, promotionalPriceCents: null })),
      }),
    );

    const configuration = await service.getPublicConfiguration();
    expect(configuration.choirs.map((choir) => choir.id)).toEqual([normalChoir.id]);
  });

  it("resolves a selected choir from current server settings", async () => {
    const service = createChoirPricingService(repository());

    await expect(service.resolveActiveChoir(promotionalChoir.id)).resolves.toEqual({
      choir: promotionalChoir,
      quote: {
        pricingType: "promotional",
        standardPriceCents: 30000,
        registrationPriceCents: 10000,
      },
      shirtPriceCents: 5000,
    });
  });

  it("rejects an unknown, inactive, or unpriced choir", async () => {
    const service = createChoirPricingService(
      repository({
        findChoir: vi.fn(async () => null),
      }),
    );

    await expect(service.resolveActiveChoir(normalChoir.id)).rejects.toThrow(
      "O coro selecionado não está disponível para inscrição.",
    );
  });

  it("returns complete administrative settings and choirs", async () => {
    const service = createChoirPricingService(repository());

    await expect(service.getAdminData()).resolves.toEqual({
      settings,
      choirs: [promotionalChoir, normalChoir],
    });
  });
});
