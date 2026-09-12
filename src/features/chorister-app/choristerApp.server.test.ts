import { describe, expect, it, vi } from "vitest";

import { createChoristerAppServer } from "./choristerApp.server";

const access = {
  status: "authorized" as const,
  accountId: "account-1",
  registrationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
};
const body = {
  status: "published",
  event: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "II Encontro de Coros",
    date: "2026-11-20",
    location: null,
    coverImageUrl: null,
    songs: [],
    documents: [],
  },
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createServer(fetchImpl: typeof fetch, now = new Date("2026-01-01T00:00:00.000Z")) {
  return createChoristerAppServer({
    participantAccess: access,
    fetchImpl,
    clock: () => now,
    env: {
      COROAPP_PORTAL_FEED_URL: "https://coroapp.example.test/functions/v1/chorister-portal-feed",
      CHORISTER_PORTAL_SHARED_SECRET: "shared-secret",
    },
  });
}

describe("chorister app server", () => {
  it("does not call CoroApp without authorized participant access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const server = createChoristerAppServer({
      participantAccess: { status: "unavailable" },
      fetchImpl,
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      env: process.env,
    });

    await expect(server.load()).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("signs the fixed POST feed request and returns only validated feed data", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
    const server = createServer(fetchImpl);

    await expect(server.load()).resolves.toEqual(body);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://coroapp.example.test/functions/v1/chorister-portal-feed");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("x-portal-timestamp")).toBe("1767225600");
    expect(new Headers(init?.headers).get("x-portal-signature")).toBe(
      "388231693f934c0a5c87a3a5372bbbdd4e634ccad63cdc05c1cebff32b6cb86f",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("caches a validated result for no more than sixty seconds", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
    let now = new Date("2026-01-01T00:00:00.000Z");
    const server = createChoristerAppServer({
      participantAccess: access,
      fetchImpl,
      clock: () => now,
      env: {
        COROAPP_PORTAL_FEED_URL: "https://coroapp.example.test/functions/v1/chorister-portal-feed",
        CHORISTER_PORTAL_SHARED_SECRET: "shared-secret",
      },
    });

    await server.load();
    now = new Date("2026-01-01T00:00:59.999Z");
    await server.load();
    now = new Date("2026-01-01T00:01:00.000Z");
    await server.load();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps timeouts, bad responses, and malformed JSON to a generic unavailable state", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    await expect(createServer(fetchImpl).load()).resolves.toEqual({ status: "unavailable" });

    const invalid = vi.fn<typeof fetch>().mockResolvedValue(response({ status: "published", event: {} }));
    await expect(createServer(invalid).load()).resolves.toEqual({ status: "unavailable" });
  });
});
