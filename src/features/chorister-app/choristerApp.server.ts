import type { ParticipantAccess } from "@/features/participant/participant-auth.server";

import {
  ChoristerPortalFeedStateSchema,
  type ChoristerPortalFeedState,
} from "./choristerApp.domain";

const MAX_CACHE_AGE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;
const RETRYABLE_HTTP_STATUSES = new Set([408, 500, 502, 503, 504]);

type ChoristerAppEnvironment = {
  COROAPP_PORTAL_FEED_URL?: string;
  CHORISTER_PORTAL_SHARED_SECRET?: string;
};

type ChoristerAppServerOptions = {
  participantAccess: ParticipantAccess;
  eventId: string | null;
  fetchImpl: typeof fetch;
  clock: () => Date;
  env: ChoristerAppEnvironment;
};

type CoroAppFeedRequestOptions = Omit<ChoristerAppServerOptions, "participantAccess">;

type CachedFeed = {
  value: Exclude<ChoristerPortalFeedState, { status: "unavailable" }>;
  expiresAtMs: number;
};

const validatedFeedCache = new Map<string, CachedFeed>();

function getEndpoint(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" && !endpoint.search ? endpoint : null;
  } catch {
    return null;
  }
}

function getTimestamp(clock: () => Date): string {
  return Math.floor(clock().getTime() / 1000).toString();
}

async function createSignature(secret: string, timestamp: string, path: string): Promise<string> {
  const message = `v1\n${timestamp}\nPOST\n${path}`;
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createChoristerAppServer({
  participantAccess,
  eventId,
  fetchImpl,
  clock,
  env,
}: ChoristerAppServerOptions) {
  return {
    async load(): Promise<ChoristerPortalFeedState> {
      if (participantAccess.status !== "authorized" || !eventId) {
        return { status: "unavailable" };
      }

      return loadCoroAppFeed({ eventId, fetchImpl, clock, env });
    },
  };
}

export async function loadCoroAppFeed({
  eventId,
  fetchImpl,
  clock,
  env,
}: CoroAppFeedRequestOptions): Promise<ChoristerPortalFeedState> {
  if (!eventId) return { status: "unavailable" };

  const now = clock().getTime();
  const endpoint = getEndpoint(env.COROAPP_PORTAL_FEED_URL);
  const secret = env.CHORISTER_PORTAL_SHARED_SECRET;
  if (!endpoint || !secret) {
    console.warn("[CoroApp feed]", {
      eventId,
      reason: "configuration_missing",
      endpointConfigured: Boolean(endpoint),
      secretConfigured: Boolean(secret),
    });
    return { status: "unavailable" };
  }

  const requestUrl = new URL(
    `${endpoint.pathname.replace(/\/+$/, "")}/${encodeURIComponent(eventId)}`,
    endpoint.origin,
  );
  const cacheKey = requestUrl.toString();
  const cached = validatedFeedCache.get(cacheKey);
  if (cached && cached.expiresAtMs > now) return cached.value;
  if (cached) validatedFeedCache.delete(cacheKey);

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    let stage: "signing" | "request" | "validation" = "signing";
    try {
      const timestamp = getTimestamp(clock);
      const signature = await createSignature(secret, timestamp, requestUrl.pathname);
      stage = "request";
      const response = await fetchImpl(requestUrl.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-portal-timestamp": timestamp,
          "x-portal-signature": signature,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.warn("[CoroApp feed]", {
          eventId, reason: "http_error", httpStatus: response.status, attempt,
        });
        if (RETRYABLE_HTTP_STATUSES.has(response.status) && attempt < MAX_REQUEST_ATTEMPTS) {
          await response.body?.cancel().catch(() => undefined);
          continue;
        }
        return { status: "unavailable" };
      }

      stage = "validation";
      const value = ChoristerPortalFeedStateSchema.parse(await response.json());
      validatedFeedCache.set(cacheKey, { value, expiresAtMs: now + MAX_CACHE_AGE_MS });
      return value;
    } catch {
      // Never log response bodies, signed URLs, signatures, or arbitrary error messages.
      console.warn("[CoroApp feed]", { eventId, reason: `${stage}_error`, attempt });
      if (stage !== "request" || attempt === MAX_REQUEST_ATTEMPTS) {
        return { status: "unavailable" };
      }
    }
  }
  return { status: "unavailable" };
}
