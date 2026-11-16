import { describe, expect, it, vi } from "vitest";
import {
  createAdminBootstrap,
  createAdminFunctionHandlers,
  createParticipantRecoveryHandlers,
  getAdminRegistrationSummary,
  listAdminRegistrations,
  toAdminAccessState,
  type AdminRegistrationServicePort,
} from "./admin.functions";

describe("admin bootstrap loading", () => {
  it("authorizes once and loads the initial payload only for active administrators", async () => {
    const findActive = vi.fn(async () => ({ id: "membership-1", userId: "admin-1" }));
    const load = vi.fn(async () => ({ registrations: 25, summary: 3 }));

    await expect(
      createAdminBootstrap({
        userId: "admin-1",
        email: "admin@example.com",
        findActive,
        load,
      }),
    ).resolves.toEqual({
      access: { status: "authorized", userId: "admin-1", email: "admin@example.com" },
      data: { registrations: 25, summary: 3 },
    });

    expect(findActive).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
  });

  it("does not load protected page data for a nonmember", async () => {
    const load = vi.fn();

    await expect(
      createAdminBootstrap({
        userId: "member-1",
        email: "member@example.com",
        findActive: async () => null,
        load,
      }),
    ).resolves.toEqual({ access: { status: "forbidden" } });

    expect(load).not.toHaveBeenCalled();
  });
});

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

  it("passes the partially paid filter to the authorized service", async () => {
    const list = vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 25 });
    const service: AdminRegistrationServicePort = {
      list,
      async export() {
        throw new Error("Unexpected export");
      },
      async summary() {
        throw new Error("Unexpected summary");
      },
    };

    await createAdminFunctionHandlers(service).list({ paymentStatus: "partially_paid" });

    expect(list).toHaveBeenCalledWith({
      search: "",
      paymentStatus: "partially_paid",
      choirId: "all",
      musicalProfile: "all",
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
      createAdminFunctionHandlers(service).export({ paymentStatus: "refunded" }, "admin-user-1"),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(serviceReached).toBe(false);
  });

  it("uses an authorized server function to return the complete summary", async () => {
    const expected = {
      total: 7,
      paid: 3,
      pending: 2,
      legacy: 2,
      receivedCents: 20000,
      pendingCents: 5000,
      pendingRegentCents: 40000,
      expectedCents: 65000,
      byChoir: [
        {
          choirName: "Diocese de Quixadá",
          total: 7,
          receivedCents: 20000,
          pendingCents: 5000,
          pendingRegentCents: 40000,
          expectedCents: 65000,
        },
      ],
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

  it("loads the initial list and summary in parallel for the registrations page", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    const service: AdminRegistrationServicePort = {
      async list() {
        calls.push("list");
        await gate;
        return { rows: [], total: 0, page: 1, pageSize: 25 };
      },
      async export() {
        throw new Error("Unexpected export");
      },
      async summary() {
        calls.push("summary");
        await gate;
        return {
          total: 0,
          paid: 0,
          pending: 0,
          legacy: 0,
          receivedCents: 0,
          pendingCents: 0,
          pendingRegentCents: 0,
          expectedCents: 0,
          byChoir: [],
        };
      },
    };

    const promise = createAdminBootstrap({
      userId: "admin-1",
      email: null,
      findActive: async () => ({ id: "membership-1", userId: "admin-1" }),
      load: async () => {
        const handlers = createAdminFunctionHandlers(service);
        const [registrations, summary] = await Promise.all([
          handlers.list({ search: "", paymentStatus: "all", page: 1, pageSize: 25 }),
          handlers.summary(),
        ]);
        return { registrations, summary };
      },
    });

    await vi.waitFor(() => expect(calls).toEqual(["list", "summary"]));
    release();
    await expect(promise).resolves.toMatchObject({ access: { status: "authorized" } });
  });
});

describe("participant recovery handlers", () => {
  it("validates a strict UUID before a reprocess can reach the authorized service", async () => {
    const service = {
      reprocess: async () => ({ status: "pending" as const }),
      resetInitialPassword: async () => ({
        status: "success" as const,
        sessionsRevoked: false as const,
      }),
    };

    expect(() =>
      createParticipantRecoveryHandlers(service).reprocess(
        { registrationId: "not-a-uuid", extra: "blocked" },
        "admin-1",
      ),
    ).toThrow(/Invalid uuid/);
  });

  it("passes only the verified admin identity and the registration UUID to a reset", async () => {
    const resetInitialPassword = async (registrationId: string, adminUserId: string) => ({
      status: "success" as const,
      sessionsRevoked: false as const,
      registrationId,
      adminUserId,
    });
    const service = {
      reprocess: async () => ({ status: "pending" as const }),
      resetInitialPassword,
    };

    await expect(
      createParticipantRecoveryHandlers(service).reset(
        { registrationId: "11111111-1111-4111-8111-111111111111" },
        "verified-admin",
      ),
    ).resolves.toEqual({
      status: "success",
      sessionsRevoked: false,
      registrationId: "11111111-1111-4111-8111-111111111111",
      adminUserId: "verified-admin",
    });
  });
});
