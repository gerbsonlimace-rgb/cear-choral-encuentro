import { z } from "zod";

const EVENT_URL_ERROR = "Informe uma URL pública válida de evento do CoroApp.";
const uuidSchema = z.string().uuid();

export const coroAppEventSourceSchema = z
  .object({
    eventId: uuidSchema,
    publicUrl: z.string().url(),
    eventName: z.string().trim().min(1).max(200),
    sortOrder: z.number().int().nonnegative(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CoroAppEventSource = z.infer<typeof coroAppEventSourceSchema>;

export const replaceCoroAppEventSourcesSchema = z
  .object({
    publicUrls: z.array(z.string().trim().min(1).max(2_000)).min(1).max(20),
  })
  .strict();

function normalizeTrustedOrigins(values: readonly string[]): Set<string> {
  return new Set(
    values.flatMap((value) => {
      try {
        const url = new URL(value.trim());
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        ) {
          return [];
        }
        return [url.origin];
      } catch {
        return [];
      }
    }),
  );
}

function eventIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const candidate =
    segments.length === 2 && segments[0] === "e"
      ? segments[1]
      : segments.length === 4 && segments[1] === "public" && segments[2] === "events"
        ? segments[3]
        : segments.length === 4 && segments[1] === "shared" && segments[2] === "events"
          ? segments[3]
          : segments.length === 3 && segments[1] === "events"
            ? segments[2]
            : null;
  return uuidSchema.safeParse(candidate).data ?? null;
}

export function normalizeCoroAppEventUrl(
  value: string,
  trustedOriginValues: readonly string[],
): { eventId: string; publicUrl: string } {
  const trustedOrigins = normalizeTrustedOrigins(trustedOriginValues);
  if (trustedOrigins.size === 0) {
    throw new Error("A origem pública do CoroApp não está configurada.");
  }

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !trustedOrigins.has(url.origin)
    ) {
      throw new Error(EVENT_URL_ERROR);
    }
    const eventId = eventIdFromPath(url.pathname);
    if (!eventId) throw new Error(EVENT_URL_ERROR);
    return { eventId, publicUrl: `${url.origin}/e/${eventId}` };
  } catch (error) {
    if (error instanceof Error && error.message === EVENT_URL_ERROR) throw error;
    throw new Error(EVENT_URL_ERROR);
  }
}

export function normalizeCoroAppEventUrls(
  values: readonly string[],
  trustedOrigins: readonly string[],
): Array<{ eventId: string; publicUrl: string; sortOrder: number }> {
  const unique = new Map<string, { eventId: string; publicUrl: string }>();
  for (const value of values) {
    if (!value.trim()) continue;
    const normalized = normalizeCoroAppEventUrl(value, trustedOrigins);
    if (!unique.has(normalized.eventId)) unique.set(normalized.eventId, normalized);
  }
  if (unique.size === 0)
    throw new Error("Informe pelo menos uma URL pública de evento do CoroApp.");
  return [...unique.values()].map((source, sortOrder) => ({ ...source, sortOrder }));
}

export function parseTrustedCoroAppOrigins(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
}
