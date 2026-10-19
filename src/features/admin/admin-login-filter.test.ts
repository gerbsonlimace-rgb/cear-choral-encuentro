import { describe, expect, it, vi } from "vitest";
import { adminRegistrationQuerySchema, adminRegistrationExportSchema, type RegistrationDatabaseRow } from "./admin.domain";

const { boundary } = vi.hoisted(() => ({ boundary: { auth: { admin: { listUsers: vi.fn() } }, from: vi.fn() } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: boundary }));
import { createAdminRegistrationService, createSupabaseAdminRegistrationRepository } from "./admin-registration.server";

function fixture() {
  const candidates = ["logged", "new-account", "no-account", "other-choir"].map((id) => ({
    row: {
      id, name: id, created_at: "2026-10-19T12:00:00Z", payment_status: "paid",
      amount_cents: 30000, paid_amount_cents: 30000, pricing_type: "standard",
      standard_price_cents: 30000, registration_price_cents: 30000,
      choir_id: id === "other-choir" ? "other" : null,
      choir_name: "Coro", musical_profile: "coralista", cpf: "52998224725",
      email: `${id}@example.com`, phone: "85999999999", birth_date: "1990-01-01",
      paid_at: "2026-10-19T12:00:00Z",
      diocese: "Diocese de Quixadá", include_shirt: false,
    } as RegistrationDatabaseRow,
    accountStatus: id === "no-account" ? null : "active" as const,
    regentName: null,
  }));
  const repository = {
    listCandidates: vi.fn().mockResolvedValue(candidates),
    listLoggedInRegistrationIds: vi.fn().mockResolvedValue(new Set(["logged"])),
    listComplementPayments: vi.fn().mockResolvedValue([]),
    signPhotos: vi.fn(async (rows) => rows),
    list: vi.fn(), listAll: vi.fn(), recordExport: vi.fn(),
  };
  return { repository, service: createAdminRegistrationService(repository, () => new Date("2026-10-19T12:00:00Z")) };
}

describe("admin login history filter", () => {
  it("accepts the three supported selections and rejects invalid values", () => {
    for (const loginStatus of ["all", "never", "has"]) {
      expect(adminRegistrationQuerySchema.parse({ loginStatus }).loginStatus).toBe(loginStatus);
    }
    expect(() => adminRegistrationQuerySchema.parse({ loginStatus: "active" })).toThrow();
  });
  it("keeps the login selection in CSV requests without pagination", () => {
    const query = adminRegistrationExportSchema.parse({ loginStatus: "never", page: 2 });
    expect(query.loginStatus).toBe("never");
    expect(query).not.toHaveProperty("page");
  });
  it("includes an active account with no login in never logged in", async () => {
    const { service } = fixture();
    const result = await service.list(adminRegistrationQuerySchema.parse({ loginStatus: "never" }));
    expect(result.rows.map((row) => row.id)).toContain("new-account");
    expect(result.rows.map((row) => row.id)).not.toContain("logged");
  });
  it("includes registrations with no account in never logged in", async () => {
    const { service } = fixture();
    const result = await service.list(adminRegistrationQuerySchema.parse({ loginStatus: "never" }));
    expect(result.rows.map((row) => row.id)).toContain("no-account");
  });
  it("selects only actual recorded logins", async () => {
    const { service } = fixture();
    const result = await service.list(adminRegistrationQuerySchema.parse({ loginStatus: "has" }));
    expect(result.rows.map((row) => row.id)).toEqual(["logged"]);
    expect(result.total).toBe(1);
  });
  it("combines choir, role and payment filters before count and pagination", async () => {
    const { service, repository } = fixture();
    const result = await service.list(adminRegistrationQuerySchema.parse({ loginStatus: "never", choirId: "other", musicalProfile: "coralista", paymentStatus: "paid", page: 2, pageSize: 1 }));
    expect(result.total).toBe(2);
    expect(result.rows.map((row) => row.id)).toEqual(["no-account"]);
    expect(repository.signPhotos).toHaveBeenCalledWith([expect.objectContaining({ id: "no-account" })]);
  });
  it("exports all matching rows and records their exact count", async () => {
    const { service, repository } = fixture();
    const file = await service.export(adminRegistrationExportSchema.parse({ loginStatus: "never", choirId: "other" }), "admin");
    expect(file.content).toContain("new-account@example.com");
    expect(file.content).toContain("no-account@example.com");
    expect(file.content).not.toContain("logged@example.com");
    expect(repository.recordExport).toHaveBeenCalledWith(expect.objectContaining({ resultCount: 2 }));
  });
  it("does not change the global summary or consult login history for all", async () => {
    const { service, repository } = fixture();
    expect((await service.summary()).total).toBe(4);
    await service.list(adminRegistrationQuerySchema.parse({ loginStatus: "all" }));
    expect(repository.listLoggedInRegistrationIds).not.toHaveBeenCalled();
  });
  it("fails rather than misclassifying users when login lookup is unavailable", async () => {
    const { service, repository } = fixture();
    repository.listLoggedInRegistrationIds.mockRejectedValue(new Error("Unavailable"));
    await expect(service.list(adminRegistrationQuerySchema.parse({ loginStatus: "never" }))).rejects.toThrow("Unavailable");
    expect(repository.signPhotos).not.toHaveBeenCalled();
  });
  it("paginates Auth users and links by user id rather than email", async () => {
    boundary.auth.admin.listUsers.mockReset().mockResolvedValueOnce({
      data: { users: Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, last_sign_in_at: null })) }, error: null,
    }).mockResolvedValueOnce({ data: { users: [{ id: "staff", last_sign_in_at: "2026-10-18T12:00:00Z" }] }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: "later", last_sign_in_at: "2026-10-19T12:00:00Z" }] }, error: null })
      .mockResolvedValueOnce({ data: { users: [] }, error: null });
    const chain = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [
      { id: "a", registration_id: "linked-staff", user_id: "staff" },
      { id: "b", registration_id: "new", user_id: "u0" },
      { id: "c", registration_id: "unlinked", user_id: null },
      { id: "d", registration_id: "later-page", user_id: "later" },
    ], error: null }) };
    boundary.from.mockReturnValue(chain);
    const repository = createSupabaseAdminRegistrationRepository();
    const ids = await repository.listLoggedInRegistrationIds?.();
    expect([...ids ?? []]).toEqual(["linked-staff", "later-page"]);
    expect(boundary.auth.admin.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
  });
});