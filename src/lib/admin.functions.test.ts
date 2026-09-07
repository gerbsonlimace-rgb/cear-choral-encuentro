import { describe, expect, it } from "vitest";
import {
  createAdminFunctionHandlers,
  getAdminRegistrationSummary,
  listAdminRegistrations,
  toAdminAccessState,
  type AdminRegistrationServicePort,
} from "./admin.functions";

describe("admin access state", () => {
  it("returns the minimum authorized identity and drops unrelated JWT claims", () => {
    expect(
      toAdminAccessState({
        userId: "user-1",
        email: "admin@example.com",
        authorized: true,
        role: "authenticated",
        phone: "+5585999999999",
      }),
    ).toEqual({
      status: "authorized",
      userId: "user-1",
      email: "admin@example.com",
    });
  });

  it("returns no identity data for an authenticated user without active admin access", () => {
    expect(
      toAdminAccessState({
        userId: "user-2",
        email: "member@example.com",
        authorized: false,
      }),
    ).toEqual({ status: "forbidden" });
  });
});

describe("admin registration handlers", () => {
  it("uses POST transport so personal search filters are not encoded in the request URL", () => {
    expect(listAdminRegistrations.method).toBe("POST");
  });

  it("normalizes a list query and applies its pagination defaults before consulting the service", async () => {
    const service: AdminRegistrationServicePort = {
      async list(query) {
        return {
          rows: [],
          total: query.search.length,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      async export() {
        throw new Error("Unexpected export");
      },
      async summary() {
        throw new Error("Unexpected summary");
      },
    };

    await expect(
      createAdminFunctionHandlers(service).list({ search: "  Maria  " }),
    ).resolves.toEqual({
      rows: [],
      total: 5,
      page: 1,
      pageSize: 25,
    });
  });

  it("rejects an invalid list query before the service can return registration data", async () => {
    let serviceReached = false;
    const service: AdminRegistrationServicePort = {
      async list() {
        serviceReached = true;
        return { rows: [], total: 0, page: 1, pageSize: 25 };
      },
      async export() {
        throw new Error("Unexpected export");
      },
      async summary() {
        throw new Error("Unexpected summary");
      },
    };

    await expect(
      createAdminFunctionHandlers(service).list({ pageSize: 101 }),
    ).rejects.toMatchObject({
      name: "ZodError",
    });
    expect(serviceReached).toBe(false);
  });

  it("normalizes export filters while preserving the authorized administrator context", async () => {
    const service: AdminRegistrationServicePort = {
      async list() {
        throw new Error("Unexpected list");
      },
      async export(query, adminUserId) {
        return {
          fileName: `${adminUserId}-${query.paymentStatus}.csv`,
          content: `${query.search}|${adminUserId}`,
        };
      },
      async summary() {
        throw new Error("Unexpected summary");
      },
    };

    await expect(
      createAdminFunctionHandlers(service).export({ search: "  Ana  " }, "admin-user-1"),
    ).resolves.toEqual({
      fileName: "admin-user-1-all.csv",
      content: "Ana|admin-user-1",
    });
  });

  it("rejects an invalid export filter before the service can create a file", async () => {
    let serviceReached = false;
    const service: AdminRegistrationServicePort = {
      async list() {
        throw new Error("Unexpected list");
      },
      async export() {
        serviceReached = true;
        return { fileName: "unexpected.csv", content: "unexpected" };
      },
      async summary() {
        throw new Error("Unexpected summary");
      },
    };

    await expect(
      createAdminFunctionHandlers(service).export({ paymentStatus: "cancelled" }, "admin-user-1"),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(serviceReached).toBe(false);
  });

  it("uses an authorized server function to return the complete summary", async () => {
    const expected = {
      total: 7,
      paid: 3,
      pending: 2,
      legacy: 2,
      byDiocese: [{ diocese: "Diocese de Quixadá", total: 7 }],
    };
    const service: AdminRegistrationServicePort = {
      async list() {
        throw new Error("Unexpected list");
      },
      async export() {
        throw new Error("Unexpected export");
      },
      async summary() {
        return expected;
      },
    };

    await expect(createAdminFunctionHandlers(service).summary()).resolves.toEqual(expected);
    expect(getAdminRegistrationSummary.method).toBe("GET");
  });
});
