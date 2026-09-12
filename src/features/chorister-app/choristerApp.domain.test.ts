import { describe, expect, it } from "vitest";

import {
  ChoristerPortalFeedSchema,
  isSignedUrlExpired,
  resolveChoristerTab,
  searchChoristerSongs,
} from "./choristerApp.domain";

const future = "2099-11-20T12:00:00.000Z";
const feed = {
  status: "published",
  event: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "II Encontro de Coros",
    date: "2026-11-20",
    location: "Quixadá",
    coverImageUrl: "https://assets.example.test/cover.jpg",
    songs: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        order: 1,
        name: "Canto de entrada",
        liturgicalType: "Entrada",
        lyrics: "Aleluia",
        chords: "C G",
        audios: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            title: "Soprano",
            voicePart: "soprano",
            signedUrl: "https://assets.example.test/audio.mp3",
            expiresAt: future,
          },
        ],
        sheetMusic: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            title: "Partitura",
            signedUrl: "https://assets.example.test/score.pdf",
            expiresAt: future,
          },
        ],
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        order: 2,
        name: "Salmo responsorial",
        liturgicalType: "Salmo",
        lyrics: null,
        chords: null,
        audios: [],
        sheetMusic: [],
      },
    ],
    documents: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        kind: "manual",
        title: "Manual",
        signedUrl: "https://assets.example.test/manual.pdf",
        expiresAt: future,
        sortOrder: 1,
      },
    ],
  },
};

describe("chorister portal feed domain", () => {
  it.each([
    [
      "an invalid voice",
      {
        ...feed,
        event: {
          ...feed.event,
          songs: [
            {
              ...feed.event.songs[0],
              audios: [
                {
                  ...feed.event.songs[0].audios[0],
                  voicePart: "baritono",
                },
              ],
            },
          ],
        },
      },
    ],
    [
      "an HTTP asset URL",
      {
        ...feed,
        event: {
          ...feed.event,
          songs: [
            {
              ...feed.event.songs[0],
              audios: [
                { ...feed.event.songs[0].audios[0], signedUrl: "http://assets.example.test/audio.mp3" },
              ],
            },
          ],
        },
      },
    ],
    [
      "an elapsed asset timestamp",
      {
        ...feed,
        event: {
          ...feed.event,
          songs: [
            {
              ...feed.event.songs[0],
              audios: [
                { ...feed.event.songs[0].audios[0], expiresAt: "2020-01-01T00:00:00.000Z" },
              ],
            },
          ],
        },
      },
    ],
    [
      "an invalid event identifier",
      { ...feed, event: { ...feed.event, id: "any-event-id" } },
    ],
  ])("rejects %s before it reaches the UI", (_label, value) => {
    expect(() => ChoristerPortalFeedSchema.parse(value)).toThrow();
  });

  it("rejects an unknown feed status before it reaches the UI", () => {
    expect(() => ChoristerPortalFeedSchema.parse({ status: "draft" })).toThrow();
  });

  it.each(["home", "cantos", "partituras", "perfil"] as const)(
    "preserves the %s tab value",
    (tab) => {
      expect(resolveChoristerTab(tab)).toBe(tab);
    },
  );

  it("uses a safe home tab for hostile route state", () => {
    expect(resolveChoristerTab("admin")).toBe("home");
    expect(resolveChoristerTab(undefined)).toBe("home");
  });

  it("searches locally by song name and liturgical type", () => {
    const parsed = ChoristerPortalFeedSchema.parse(feed);

    expect(searchChoristerSongs(parsed.event.songs, "RESPONSORIAL")).toEqual([
      parsed.event.songs[1],
    ]);
    expect(searchChoristerSongs(parsed.event.songs, "entrada")).toEqual([
      parsed.event.songs[0],
    ]);
  });

  it("treats malformed and elapsed signed URLs as expired", () => {
    expect(isSignedUrlExpired("2026-11-20T12:00:00.000Z", new Date("2026-11-20T12:00:00.000Z"))).toBe(
      true,
    );
    expect(isSignedUrlExpired("not-a-date", new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isSignedUrlExpired(future, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});
