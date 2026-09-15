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
    eventId: body.event.id,
    fetchImpl,
    clock: () => now,
    env: {
      COROAPP_PORTAL_FEED_URL: endpoint,
      CHORISTER_PORTAL_SHARED_SECRET: "shared-secret",
    },
  });
}

describe("chorister app server", () => {
  it.each([502, 503, 504])("recovers automatically from a transient HTTP %s", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, status))
      .mockResolvedValueOnce(response(body));
    await expect(createServer(fetchImpl, undefined,
      `https://coroapp-retry-${status}.example.test/feed`).load()).resolves.toEqual(body);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("recovers automatically from a network failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(response(body));
    await expect(createServer(fetchImpl, undefined,
      "https://coroapp-network-retry.example.test/feed").load()).resolves.toEqual(body);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("limits automatic attempts and records only safe diagnostic fields", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ secret: "PRIVATE_DETAIL" }, 503));
    await expect(createServer(fetchImpl, undefined,
      "https://coroapp-retry-limit.example.test/feed").load()).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("[CoroApp feed]", expect.objectContaining({
      eventId: body.event.id, reason: "http_error", httpStatus: 503, attempt: 2,
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/PRIVATE_DETAIL|shared-secret/);
  });

  it("does not retry an authentication rejection", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    await expect(createServer(fetchImpl, undefined,
      "https://coroapp-unauthorized.example.test/feed").load()).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reports missing server configuration without contacting the upstream service", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(createChoristerAppServer({
      participantAccess: access, eventId: body.event.id, fetchImpl,
      clock: () => new Date(), env: {},
    }).load()).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[CoroApp feed]", expect.objectContaining({
      reason: "configuration_missing", endpointConfigured: false, secretConfigured: false,
    }));
  });

  it("does not call CoroApp without authorized participant access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const server = createChoristerAppServer({
      participantAccess: { status: "unavailable" },
      eventId: body.event.id,
      fetchImpl,
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
      env: process.env,
    });

    await expect(server.load()).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("binds the configured event identifier into the signed feed path", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
    const server = createServer(fetchImpl);

    await expect(server.load()).resolves.toEqual(body);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      `https://coroapp.example.test/functions/v1/chorister-portal-feed/${body.event.id}`,
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("x-portal-timestamp")).toBe("1767225600");
    expect(new Headers(init?.headers).get("x-portal-signature")).toBe(
      "85a2fd6627cfa0406c740e592f1d3e6de166c5615c3d432ec1c99a5172a5ea6b",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("caches a validated result for no more than sixty seconds", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(body));
    let now = new Date("2026-01-01T00:00:00.000Z");
    const server = createChoristerAppServer({
      participantAccess: access,
      eventId: body.event.id,
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
