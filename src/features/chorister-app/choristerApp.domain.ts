import { z } from "zod";

export const tabSchema = z.enum(["home", "cantos", "documentos", "guia", "perfil"]);
export type ChoristerTab = z.infer<typeof tabSchema>;

const uuidSchema = z.string().uuid();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  });
const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const futureTimestampSchema = z
  .string()
  .datetime()
  .refine((value) => Date.parse(value) > Date.now());
const signedAssetSchema = z
  .object({
    id: uuidSchema,
    title: z.string().trim().min(1).max(200),
    signedUrl: httpsUrlSchema,
    expiresAt: futureTimestampSchema,
  })
  .strict();
const voicePartSchema = z.enum(["principal", "soprano", "contralto", "tenor", "baixo", "todos"]);
const audioSchema = signedAssetSchema.extend({ voicePart: voicePartSchema }).strict();
const sheetMusicSchema = signedAssetSchema;
const songSchema = z
  .object({
    id: uuidSchema,
    order: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(200),
    liturgicalType: z.string().trim().min(1).max(100),
    lyrics: z.string().max(50_000).nullable(),
    chords: z.string().max(50_000).nullable(),
    audios: z.array(audioSchema),
    sheetMusic: z.array(sheetMusicSchema),
  })
  .strict();
const documentSchema = signedAssetSchema
  .extend({
    kind: z.enum(["manual", "document"]),
    sortOrder: z.number().int().nonnegative(),
    category: z.string().trim().min(2).max(60).optional(),
  })
  .strict();

const eventSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1).max(200),
    date: dateSchema,
    location: z.string().trim().min(1).max(200).nullable(),
    coverImageUrl: httpsUrlSchema.nullable(),
    songs: z.array(songSchema),
    documents: z.array(documentSchema),
    guide: z
      .object({
        notes: z.string().max(50_000).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ChoristerPortalFeedSchema = z
  .object({
    status: z.literal("published"),
    event: eventSchema,
  })
  .strict();

export const ChoristerPortalCollectionSchema = z
  .object({
    status: z.literal("published"),
    events: z.array(eventSchema).min(1),
  })
  .strict();

export type ChoristerPortalCollection = z.infer<typeof ChoristerPortalCollectionSchema>;

const notPublishedSchema = z.object({ status: z.literal("not_published") }).strict();
export const ChoristerPortalFeedStateSchema = z.union([
  ChoristerPortalFeedSchema,
  notPublishedSchema,
]);

export type ChoristerPortalFeed = z.infer<typeof ChoristerPortalFeedSchema>;
export type ChoristerPortalFeedState =
  | ChoristerPortalFeed
  | z.infer<typeof notPublishedSchema>
  | { status: "unavailable" };
export type ChoristerPortalCollectionState =
  | ChoristerPortalCollection
  | z.infer<typeof notPublishedSchema>
  | { status: "unavailable" };

export function resolveChoristerTab(value: unknown): ChoristerTab {
  return tabSchema.safeParse(value).data ?? "home";
}

export function searchChoristerSongs(
  songs: ChoristerPortalFeed["event"]["songs"],
  query: string,
): ChoristerPortalFeed["event"]["songs"] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return songs;
  return songs.filter((song) =>
    `${song.name} ${song.liturgicalType}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
  );
}

export function isSignedUrlExpired(expiresAt: string, now = new Date()): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime();
}
