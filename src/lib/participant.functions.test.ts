import { describe, expect, it, vi } from "vitest";

const { getParticipantRequestAccess, loadRegistration, loginParticipantWithCredentials } = vi.hoisted(() => ({
  getParticipantRequestAccess: vi.fn(),
  loadRegistration: vi.fn(),
  loginParticipantWithCredentials: vi.fn(),
}));

vi.mock("@/features/participant/participant-auth.server", () => ({
  getParticipantRequestAccess,
  getParticipantRegistrationLoader: () => ({ load: loadRegistration }),
}));

vi.mock("@/features/registration/participant-area.server", () => ({
  loginParticipantWithCredentials,
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    createServerFn: (options: { method: string }) => {
      const middlewares: unknown[] = [];
      const builder = {
        middleware(value: unknown[]) {
          middlewares.push(...value);
          return builder;
        },
        handler(handler: (input: unknown) => unknown) {
          return Object.assign(handler, { method: options.method, middlewares });
        },
        validator() {
          return builder;
        },
      };
      return builder;
    },
  };
});

import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import { getParticipantAccess, getParticipantRegistration, loginParticipant } from "./participant.functions";

const ownAccess = {
  status: "authorized" as const,
  accountId: "account-1",
  registrationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
};

type ServerFunction = {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

describe("participant server-function boundaries", () => {
  it("passes validated credentials to the participant login service", async () => {
    loginParticipantWithCredentials.mockResolvedValue({ ok: true, registrations: [] });
    const serverFunction = loginParticipant as unknown as ServerFunction;

    await expect(
      serverFunction({ data: { email: " Maria@Example.com ", password: "secret" } }),
    ).resolves.toEqual({ ok: true, registrations: [] });
    expect(loginParticipantWithCredentials).toHaveBeenCalledExactlyOnceWith({
      email: " Maria@Example.com ",
      password: "secret",
    });
  });

  it("exposes a read-only neutral access probe", async () => {
    getParticipantRequestAccess.mockResolvedValue({ status: "unavailable" });
    const serverFunction = getParticipantAccess as unknown as ServerFunction;

    await expect(serverFunction({ data: { registrationId: "victim" } })).resolves.toEqual({
      status: "unavailable",
    });
    expect(serverFunction.method).toBe("GET");
    expect(serverFunction.middlewares).toEqual([]);
  });

  it("loads registration data only from middleware access and ignores hostile request IDs", async () => {
    const expected = { identity: { name: "Maria", cpf: "***.***.***-25" } };
    loadRegistration.mockResolvedValue(expected);
    const serverFunction = getParticipantRegistration as unknown as ServerFunction;

    await expect(
      serverFunction({
        data: {
          registrationId: "44444444-4444-4444-8444-444444444444",
          accountId: "victim-account",
          userId: "victim-user",
        },
        context: { participantAccess: ownAccess },
      }),
    ).resolves.toEqual(expected);
    expect(serverFunction.method).toBe("GET");
    expect(serverFunction.middlewares).toContain(requireParticipantAccess);
    expect(loadRegistration).toHaveBeenCalledExactlyOnceWith(ownAccess);
  });
});
