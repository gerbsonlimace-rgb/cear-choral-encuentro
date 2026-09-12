import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";

import { ChoristerSongsTab } from "./ChoristerSongsTab";

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { configurable: true, value: () => false },
  scrollIntoView: { configurable: true, value: () => undefined },
});

const future = "2099-11-20T12:00:00.000Z";
const feed: ChoristerPortalFeed = {
  status: "published",
  event: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "II Encontro de Coros",
    date: "2026-11-20",
    location: "Quixadá",
    coverImageUrl: null,
    songs: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        order: 2,
        name: "Salmo responsorial",
        liturgicalType: "Salmo",
        lyrics: null,
        chords: null,
        audios: [],
        sheetMusic: [],
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        order: 1,
        name: "Canto de entrada",
        liturgicalType: "Entrada",
        lyrics: "Aleluia",
        chords: "C G",
        audios: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            title: "Soprano",
            voicePart: "soprano",
            signedUrl: "https://assets.example.test/soprano.mp3",
            expiresAt: future,
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            title: "Tenor",
            voicePart: "tenor",
            signedUrl: "https://assets.example.test/tenor.mp3",
            expiresAt: future,
          },
        ],
        sheetMusic: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            title: "Partitura",
            signedUrl: "https://assets.example.test/score.pdf",
            expiresAt: future,
          },
        ],
      },
    ],
    documents: [],
  },
};

function setup() {
  const props = { onPlay: vi.fn(), onOpenSong: vi.fn(), onOpenScore: vi.fn() };
  render(<ChoristerSongsTab songs={feed.event.songs} {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("ChoristerSongsTab", () => {
  it("orders songs from the feed and filters them locally by search", async () => {
    const { user } = setup();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Canto de entrada", "Salmo responsorial"]);

    await user.type(screen.getByRole("searchbox", { name: "Buscar cantos" }), "salmo");
    expect(
      screen.queryByRole("heading", { name: "Canto de entrada", level: 3 }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Salmo responsorial", level: 3 }),
    ).toBeInTheDocument();
  });

  it("filters available audio by voice and emits only asset identifiers for read-only actions", async () => {
    const { onOpenScore, onOpenSong, onPlay, user } = setup();

    await user.click(screen.getByRole("combobox", { name: "Filtrar por naipe" }));
    await user.click(await screen.findByRole("option", { name: "Tenor" }));
    expect(screen.queryByRole("button", { name: "Tocar Soprano" })).not.toBeInTheDocument();
    const playButton = screen.getByRole("button", { name: "Tocar Tenor" });
    expect(playButton).toHaveClass("min-h-11");
    await user.click(playButton);
    await user.click(screen.getByRole("button", { name: "Abrir canto Canto de entrada" }));
    await user.click(screen.getByRole("button", { name: "Abrir partitura de Canto de entrada" }));

    expect(onPlay).toHaveBeenCalledExactlyOnceWith("55555555-5555-4555-8555-555555555555");
    expect(onOpenSong).toHaveBeenCalledExactlyOnceWith("33333333-3333-4333-8333-333333333333");
    expect(onOpenScore).toHaveBeenCalledExactlyOnceWith("66666666-6666-4666-8666-666666666666");
  });

  it("keeps read-only content without administrative upload controls", () => {
    setup();
    expect(screen.getByText("Este canto ainda não possui áudio publicado.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enviar|upload|editar|remover/i }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Cantos publicados" })).getAllByRole("button")
        .length,
    ).toBeGreaterThan(0);
  });
});
