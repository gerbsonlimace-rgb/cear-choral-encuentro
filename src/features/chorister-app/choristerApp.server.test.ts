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

function createServer(
  fetchImpl: typeof fetch,
  now = new Date("2026-01-01T00:00:00.000Z"),
  endpoint = "https://coroapp.example.test/functions/v1/chorister-portal-feed",
) {
  return createChoristerAppServer({
    participantAccess: access,
    fetchImpl,
    clock: () => now,
    env: {
      COROAPP_PORTAL_FEED_URL: endpoint,
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
        COROAPP_PORTAL_FEED_URL: "https://coroapp-cache.example.test/functions/v1/chorister-portal-feed",
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

  it("shares a validated feed across separate server factories for at most sixty seconds", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const endpoint = "https://coroapp-shared-cache.example.test/functions/v1/chorister-portal-feed";
    const firstFetch = vi.fn<typeof fetch>().mockResolvedValue(response(body));
    const secondFetch = vi.fn<typeof fetch>().mockResolvedValue(response(body));

    await createServer(firstFetch, now, endpoint).load();
    now = new Date("2026-01-01T00:00:59.999Z");
    await createServer(secondFetch, now, endpoint).load();
    now = new Date("2026-01-01T00:01:00.000Z");
    await createServer(secondFetch, now, endpoint).load();

    expect(firstFetch).toHaveBeenCalledOnce();
    expect(secondFetch).toHaveBeenCalledOnce();
  });

  it("maps a timeout to a generic unavailable state", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    await expect(
      createServer(
        fetchImpl,
        new Date("2026-01-01T00:00:00.000Z"),
        "https://coroapp-timeout.example.test/functions/v1/chorister-portal-feed",
      ).load(),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("maps a non-2xx response to a generic unavailable state", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ error: "internal detail" }, 502));
    await expect(
      createServer(
        fetchImpl,
        new Date("2026-01-01T00:00:00.000Z"),
        "https://coroapp-non-2xx.example.test/functions/v1/chorister-portal-feed",
      ).load(),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("maps malformed JSON to a generic unavailable state", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(
      createServer(
        fetchImpl,
        new Date("2026-01-01T00:00:00.000Z"),
        "https://coroapp-malformed-json.example.test/functions/v1/chorister-portal-feed",
      ).load(),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("sets the fixed ten-second request timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      await createServer(
        vi.fn<typeof fetch>().mockResolvedValue(response(body)),
        new Date("2026-01-01T00:00:00.000Z"),
        "https://coroapp-timeout-value.example.test/functions/v1/chorister-portal-feed",
      ).load();
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally {
      timeout.mockRestore();
    }
  });
});
