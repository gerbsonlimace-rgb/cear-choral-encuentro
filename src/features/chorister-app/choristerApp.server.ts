import type { ParticipantAccess } from "@/features/participant/participant-auth.server";

import {
  ChoristerPortalFeedStateSchema,
  type ChoristerPortalFeedState,
} from "./choristerApp.domain";

const MAX_CACHE_AGE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

type ChoristerAppEnvironment = Pick<
  NodeJS.ProcessEnv,
  "COROAPP_PORTAL_FEED_URL" | "CHORISTER_PORTAL_SHARED_SECRET"
>;

type ChoristerAppServerOptions = {
  participantAccess: ParticipantAccess;
  fetchImpl: typeof fetch;
  clock: () => Date;
  env: ChoristerAppEnvironment;
};

type CachedFeed = {
  value: Exclude<ChoristerPortalFeedState, { status: "unavailable" }>;
  expiresAtMs: number;
};

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
  fetchImpl,
  clock,
  env,
}: ChoristerAppServerOptions) {
  let cache: CachedFeed | undefined;

  return {
    async load(): Promise<ChoristerPortalFeedState> {
      if (participantAccess.status !== "authorized") return { status: "unavailable" };

      const now = clock().getTime();
      if (cache && cache.expiresAtMs > now) return cache.value;

      const endpoint = getEndpoint(env.COROAPP_PORTAL_FEED_URL);
      const secret = env.CHORISTER_PORTAL_SHARED_SECRET;
      if (!endpoint || !secret) return { status: "unavailable" };

      try {
        const timestamp = getTimestamp(clock);
        const signature = await createSignature(secret, timestamp, endpoint.pathname);
        const response = await fetchImpl(endpoint.toString(), {
          method: "POST",
          headers: {
            accept: "application/json",
            "x-portal-timestamp": timestamp,
            "x-portal-signature": signature,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return { status: "unavailable" };

        const value = ChoristerPortalFeedStateSchema.parse(await response.json());
        cache = { value, expiresAtMs: now + MAX_CACHE_AGE_MS };
        return value;
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
