import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoristerSongPlayer } from "./ChoristerSongPlayer";

const song = {
  id: "song",
  order: 1,
  name: "Canto de entrada",
  liturgicalType: "Entrada",
  lyrics: "Cantemos juntos",
  chords: "C  G  Am",
  sheetMusic: [],
  audios: [
    {
      id: "soprano",
      title: "Soprano",
      voicePart: "soprano" as const,
      signedUrl: "https://example.test/s.mp3",
      expiresAt: "2099-01-01",
    },
    {
      id: "tenor",
      title: "Tenor",
      voicePart: "tenor" as const,
      signedUrl: "https://example.test/t.mp3",
      expiresAt: "2099-01-01",
    },
  ],
};

function setup(overrides = {}) {
  const props = {
    song,
    event: {
      id: "event",
      name: "Encontro de Coros",
      date: "2026-11-20",
      location: null,
      coverImageUrl: null,
      songs: [song],
      documents: [],
    },
    activeAudioId: "soprano",
    isPlaying: true,
    currentTime: 30,
    duration: 120,
    playerStatus: "ready" as const,
    onClose: vi.fn(),
    onPlay: vi.fn(),
    onTogglePlayback: vi.fn(),
    onSeek: vi.fn(),
    onOpenScore: vi.fn(),
    onDownloadScore: vi.fn(),
    ...overrides,
  };
  render(<ChoristerSongPlayer {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("ChoristerSongPlayer", () => {
  it("renews an expired score before displaying the PDF inside the player", async () => {
    const score = {
      id: "score",
      title: "Partitura",
      signedUrl: "https://example.test/expired.pdf",
      expiresAt: "2020-01-01",
    };
    const freshScore = {
      ...score,
      signedUrl: "https://example.test/fresh.pdf",
      expiresAt: "2099-01-01",
    };
    const onOpenScore = vi.fn().mockResolvedValue(freshScore);
    const { user } = setup({ song: { ...song, sheetMusic: [score] }, onOpenScore });
    await user.click(screen.getByRole("tab", { name: "Partitura" }));
    expect(await screen.findByTitle("PDF Partitura")).toHaveAttribute("src", freshScore.signedUrl);
    expect(onOpenScore).toHaveBeenCalledWith(score);
    expect(screen.queryByText("Manuais e documentos")).not.toBeInTheDocument();
  });
  it("uses the CoroApp content tabs and keeps playback controls across tabs", async () => {
    const { user } = setup();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Letra",
      "Partitura",
      "Cifra",
    ]);
    expect(screen.getByText("Cantemos juntos")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Cifra" }));
    expect(screen.getByText("C G Am")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pausar Soprano" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Partitura" }));
    expect(screen.getByText("Partitura não disponível.")).toBeVisible();
  });

  it("pauses the current voice, switches voice, and seeks using the shared player", async () => {
    const { user, onPlay, onTogglePlayback, onSeek, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Pausar Soprano" }));
    expect(onTogglePlayback).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Tocar Tenor" }));
    expect(onPlay).toHaveBeenCalledWith("tenor");
    fireEvent.change(screen.getByRole("slider", { name: "Progresso do áudio" }), {
      target: { value: "45" },
    });
    expect(onSeek).toHaveBeenCalledWith(45);
    await user.click(screen.getByRole("button", { name: "Fechar player expandido" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not display another song's progress and prefers the participant voice", async () => {
    const { user, onPlay } = setup({ activeAudioId: "another-song", initialVoicePart: "tenor" });
    expect(screen.getByRole("slider", { name: "Progresso do áudio" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Progresso do áudio" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reproduzir Canto de entrada" }));
    expect(onPlay).toHaveBeenCalledWith("tenor");
  });

  it("keeps an unpublished song readable without offering playback", () => {
    setup({ song: { ...song, audios: [] } });
    expect(screen.getByRole("button", { name: "Reproduzir Canto de entrada" })).toBeDisabled();
    expect(screen.getByText("Este canto ainda não possui áudio publicado.")).toBeVisible();
    expect(screen.getByText("Cantemos juntos")).toBeVisible();
  });
});
