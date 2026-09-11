import { describe, expect, it, vi } from "vitest";

import {
  createAdminChoir,
  createChoirPricingFunctionHandlers,
  getAdminChoirPricing,
  getPublicRegistrationConfiguration,
  saveAdminPricingSettings,
  setAdminChoirActive,
  updateAdminChoir,
  type ChoirPricingServicePort,
} from "./choir-pricing.functions";

const settings = {
  standardPriceCents: 30000,
  promotionalPriceCents: 10000,
};

function service(): ChoirPricingServicePort {
  return {
    getPublicConfiguration: vi.fn(async () => ({ choirs: [], shirtPriceCents: 5000 })),
    getAdminData: vi.fn(async () => ({ settings, choirs: [] })),
    saveSettings: vi.fn(async (input) => input),
    createChoir: vi.fn(async (input) => ({
      id: "11111111-1111-4111-8111-111111111111",
      ...input,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    })),
    updateChoir: vi.fn(async (id, input) => ({
      id,
      ...input,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    })),
    setChoirActive: vi.fn(async (id, isActive) => ({
      id,
      name: "Coro Litúrgico",
      usesPromotionalPrice: false,
      isActive,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    })),
  };
}

describe("choir pricing server functions", () => {
  it("uses GET only for reads and POST for every mutation", () => {
    expect(getPublicRegistrationConfiguration.method).toBe("GET");
    expect(getAdminChoirPricing.method).toBe("GET");
    expect(saveAdminPricingSettings.method).toBe("POST");
    expect(createAdminChoir.method).toBe("POST");
    expect(updateAdminChoir.method).toBe("POST");
    expect(setAdminChoirActive.method).toBe("POST");
  });

  it("rejects inconsistent global prices before reaching the service", async () => {
    const port = service();

    await expect(
      createChoirPricingFunctionHandlers(port).saveSettings({
        standardPriceCents: 30000,
        promotionalPriceCents: 30000,
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(port.saveSettings).not.toHaveBeenCalled();
  });

  it("normalizes a choir name before creation", async () => {
    const port = service();

    await createChoirPricingFunctionHandlers(port).createChoir({
      name: "  Coro Litúrgico  ",
      usesPromotionalPrice: true,
      isActive: true,
    });

    expect(port.createChoir).toHaveBeenCalledWith({
      name: "Coro Litúrgico",
      usesPromotionalPrice: true,
      isActive: true,
    });
  });

  it("validates the choir identifier for updates and activation", async () => {
    const handlers = createChoirPricingFunctionHandlers(service());

    await expect(
      handlers.updateChoir({
        id: "invalid",
        name: "Coro Litúrgico",
        usesPromotionalPrice: false,
        isActive: true,
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(handlers.setChoirActive({ id: "invalid", isActive: false })).rejects.toMatchObject(
      { name: "ZodError" },
    );
  });
});
