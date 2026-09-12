import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";

import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { ChoristerAppShell } from "./ChoristerAppShell";

const future = "2099-11-20T12:00:00.000Z";

const participant: ParticipantRegistrationView = {
  identity: {
    name: "Maria da Silva",
    cpf: "***.***.***-25" as MaskedCpf,
    birthDate: "1990-01-15",
  },
  registration: { choirName: "Coral Santa Cecília", diocese: "Diocese de Quixadá" },
  payment: { status: "paid" },
};

const feed: ChoristerPortalFeed = {
  status: "published",
  event: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "II Encontro de Coros Diocesanos e Litúrgicos",
    date: "2026-11-20",
    location: "Quixadá",
    coverImageUrl: null,
    songs: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        order: 1,
        name: "Canto de entrada",
        liturgicalType: "Entrada",
        lyrics: null,
        chords: null,
        audios: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            title: "Soprano",
            voicePart: "soprano",
            signedUrl: "https://assets.example.test/audio.mp3",
            expiresAt: future,
          },
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            title: "Tenor",
            voicePart: "tenor",
            signedUrl: "https://assets.example.test/tenor.mp3",
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
    ],
    documents: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        kind: "manual",
        title: "Manual do encontro",
        signedUrl: "https://assets.example.test/manual.pdf",
        expiresAt: future,
        sortOrder: 1,
      },
    ],
  },
};

function setup() {
  const props = {
    participant,
    feed,
    onChangePassword: vi.fn(),
    onDownloadReceipt: vi.fn(),
    onLogout: vi.fn(),
    onPlay: vi.fn(),
    onOpenSong: vi.fn(),
    onOpenScore: vi.fn(),
  };
  render(<ChoristerAppShell {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("ChoristerAppShell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the approved four-tab order in the mobile bottom navigation", () => {
    setup();

    const navigation = screen.getByRole("navigation", { name: "Navegação principal do app" });
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Home", "Cantos", "Partituras", "Meu Perfil"]);
    expect(within(navigation).getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(navigation).toHaveClass("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
  });

  it("renders the official event card and takes Home shortcuts to the matching tab", async () => {
    const { user } = setup();

    expect(
      screen.getByRole("heading", { name: "II Encontro de Coros Diocesanos e Litúrgicos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("20–22 de novembro de 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Quixadá").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Olá, Maria")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ensaiar cantos.*1 canto publicado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Abrir partituras.*2 materiais publicados/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ensaiar cantos/i }));
    expect(screen.getByRole("heading", { name: "Cantos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cantos" })).toHaveAttribute("aria-current", "page");
  });

  it("plays signed audio in the persistent player and releases the previous track before switching", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Cantos" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano" }));

    const audio = screen.getByLabelText("Reprodutor de áudio") as HTMLAudioElement;
    expect(audio).toHaveAttribute("src", "https://assets.example.test/audio.mp3");
    expect(screen.getByRole("region", { name: "Player persistente" })).toHaveTextContent(
      "Canto de entradaSoprano",
    );
    await waitFor(() => expect(play).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("region", { name: "Player persistente" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cantos" }));
    await user.click(screen.getByRole("button", { name: "Tocar Tenor" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Reprodutor de áudio")).toHaveAttribute(
        "src",
        "https://assets.example.test/tenor.mp3",
      ),
    );
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("handles ended and failed playback without leaving the player in a playing state", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Cantos" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano" }));
    const audio = screen.getByLabelText("Reprodutor de áudio");

    fireEvent.ended(audio);
    expect(screen.getByRole("button", { name: "Reproduzir Canto de entrada" })).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();

    fireEvent.error(audio);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível reproduzir este áudio. Tente novamente.",
    );
  });
});
