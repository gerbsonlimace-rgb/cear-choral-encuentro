import type { ComponentProps } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/event-activity.functions", () => ({
  getParticipantEventActivities: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/event-document.functions", () => ({
  getParticipantGeneralDocuments: vi.fn().mockResolvedValue([]),
  getParticipantEventDocumentUrl: vi.fn(),
}));

import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";
import { getParticipantEventActivities } from "@/lib/event-activity.functions";

import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { ChoristerAppShell, type ChoristerAppShellProps } from "./ChoristerAppShell";

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

function setup(overrides: Partial<ChoristerAppShellProps> = {}) {
  const props: ChoristerAppShellProps = {
    participant,
    feed,
    onChangePassword: vi.fn(),
    onDownloadReceipt: vi.fn(),
    onLogout: vi.fn(),
    onPlay: vi.fn(),
    onOpenSong: vi.fn(),
    onOpenScore: vi.fn(),
    onDownloadScore: vi.fn(),
    ...overrides,
  };
  render(<ChoristerAppShell {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("ChoristerAppShell", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["Explorar cantos", "Kit Ensaio"],
    ["Ver documentos", "Documentos"],
    ["Consultar programação", "Agenda"],
  ])("opens the corresponding tab from the home shortcut %s", async (shortcut, tab) => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: shortcut }));
    const navigation = screen.getByRole("navigation", { name: "Navegação de Participante" });
    expect(within(navigation).getByRole("button", { name: tab })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens a song detail with its lyrics and chords from Cantos", async () => {
    const detailedFeed: ChoristerPortalFeed = {
      ...feed,
      event: {
        ...feed.event,
        songs: [
          {
            ...feed.event.songs[0],
            lyrics: "Vem, Senhor, visitar teu povo.",
            chords: "C        G        Am",
          },
        ],
      },
    };
    const { user } = setup({ feed: detailedFeed });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Abrir canto Canto de entrada" }));

    const detail = screen.getByRole("dialog", { name: "Canto de entrada" });
    expect(within(detail).getByText("Vem, Senhor, visitar teu povo.")).toBeInTheDocument();
    await user.click(within(detail).getByRole("tab", { name: "Cifra" }));
    expect(within(detail).getByText(/C\s+G\s+Am/)).toBeInTheDocument();
    await user.click(within(detail).getByRole("button", { name: "Fechar player expandido" }));
    expect(screen.getByRole("button", { name: "Abrir canto Canto de entrada" })).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "Canto de entrada" })).not.toBeInTheDocument();
  });

  it("opens a score viewer in Documentos from a song shortcut", async () => {
    const onOpenScore = vi.fn().mockImplementation((asset) => asset);
    const { user } = setup({ onOpenScore });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Abrir partitura de Canto de entrada" }));

    expect(screen.getByRole("heading", { name: "Documentos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visualizador de Partitura" })).toBeInTheDocument();
    expect(screen.getByTitle("PDF Partitura")).toHaveAttribute(
      "src",
      "https://assets.example.test/score.pdf",
    );
    expect(onOpenScore).not.toHaveBeenCalled();
  });

  it("uses the approved DetraPay-style participant shell", () => {
    setup();

    const navigation = screen.getByRole("navigation", { name: "Navegação de Participante" });
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Home", "Agenda", "Kit Ensaio", "Documentos", "Meu Perfil"]);
    expect(within(navigation).getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("internal-topbar")).toHaveClass("bg-brand-ink");
    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação móvel de Participante",
    });
    expect(
      within(mobileNavigation)
        .getAllByTestId("internal-mobile-primary-item")
        .map((button) => button.textContent),
    ).toEqual(["Home", "Agenda", "Kit Ensaio", "Documentos"]);
    expect(within(mobileNavigation).getByRole("button", { name: /mais/i })).toBeInTheDocument();
  });

  it("keeps only the profile destination inside Mais on mobile", async () => {
    const onTabChange = vi.fn();
    const { user } = setup({ onTabChange });

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação móvel de Participante",
    });
    expect(
      within(mobileNavigation).getByRole("button", { name: "Abrir Agenda" }),
    ).toBeInTheDocument();
    await user.click(within(mobileNavigation).getByRole("button", { name: "Abrir Agenda" }));
    expect(onTabChange).toHaveBeenCalledWith("guia");

    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = await screen.findByRole("dialog", { name: "Mais opções de Participante" });
    expect(within(sheet).queryByRole("button", { name: "Agenda" })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Meu Perfil" }));
    expect(onTabChange).toHaveBeenCalledWith("perfil");
  });

  it("uses one route update when changing tabs with an event selected", async () => {
    const onTabChange = vi.fn();
    const onEventChange = vi.fn();
    const { user } = setup({
      initialTab: "cantos",
      initialEventId: feed.event.id,
      onTabChange,
      onEventChange,
    });

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));

    expect(onTabChange).toHaveBeenCalledExactlyOnceWith("perfil");
    expect(onEventChange).not.toHaveBeenCalled();
  });

  it("preloads the guide once and reuses it when the tab is reopened", async () => {
    const loadGuideActivities = vi.fn().mockResolvedValue([]);
    const { user } = setup({
      loadGuideActivities,
    } as Partial<ChoristerAppShellProps>);

    await waitFor(() => expect(loadGuideActivities).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Agenda" }));
    await user.click(screen.getByRole("button", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "Agenda" }));

    expect(loadGuideActivities).toHaveBeenCalledOnce();
  });

  it("loads the participant programme from the activities CRUD by default", async () => {
    setup();

    await waitFor(() => expect(getParticipantEventActivities).toHaveBeenCalledOnce());
  });

  it("retries a failed guide preload when the programme is opened", async () => {
    const loadGuideActivities = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce([
        {
          id: "77777777-7777-4777-8777-777777777777",
          title: "Programação recuperada",
          activityDate: "2026-11-20",
          startsAt: "09:00",
          endsAt: "10:00",
          location: null,
          description: null,
          sortOrder: 1,
          requiresQr: false,
        },
      ]);
    const { user } = setup({
      loadGuideActivities,
    } as Partial<ChoristerAppShellProps>);

    await waitFor(() => expect(loadGuideActivities).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Agenda" }));
    expect(await screen.findByText("Programação recuperada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "Agenda" }));
    expect(await screen.findByText("Programação recuperada")).toBeInTheDocument();

    expect(loadGuideActivities).toHaveBeenCalledTimes(2);
  });

  it("lists event summaries before opening one dedicated repertoire", async () => {
    const onEventChange = vi.fn();
    const secondEvent = {
      ...feed.event,
      id: "66666666-6666-4666-8666-666666666666",
      name: "Solenidade de Cristo Rei",
      date: "2026-11-22",
      location: "Catedral Jesus, Maria e José",
      songs: [],
      documents: [],
    };
    const { user } = setup({ events: [feed.event, secondEvent], onEventChange });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));

    expect(
      screen.getByRole("button", { name: `Abrir evento ${feed.event.name}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Abrir evento ${secondEvent.name}` }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 áudios · 1 canto · 2 partituras")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Abrir evento ${secondEvent.name}` }));
    expect(onEventChange).toHaveBeenLastCalledWith(secondEvent.id);
    expect(screen.getByRole("button", { name: "Voltar aos eventos" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Abrir evento ${feed.event.name}` }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar aos eventos" }));
    expect(onEventChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByRole("button", { name: `Abrir evento ${feed.event.name}` }),
    ).toBeInTheDocument();
  });

  it("welcomes the participant without promoting an arbitrary event on Home", async () => {
    const grandeConcerto = {
      ...feed.event,
      id: "77777777-7777-4777-8777-777777777777",
      name: "Grande Concerto",
    };
    const { user } = setup({ events: [grandeConcerto, feed.event] });

    expect(screen.getByRole("heading", { name: "Maria da Silva" })).toBeInTheDocument();
    expect(screen.getByText("Bem-vindo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto não disponível" })).toBeInTheDocument();
    expect(screen.queryByText("Evento oficial")).not.toBeInTheDocument();
    expect(screen.queryByText("Grande Concerto")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Boas-vindas e inscrição" })).toHaveTextContent(
      "Saldo indisponível",
    );
    expect(
      screen.queryByRole("button", { name: "Abrir cantos e partituras" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    expect(
      screen.getByRole("button", { name: "Abrir evento Grande Concerto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kit Ensaio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the mobile event chooser as two-column image tiles", async () => {
    const coveredEvent = {
      ...feed.event,
      coverImageUrl: "https://assets.example.test/event-cover.jpg",
    };
    const { user } = setup({
      events: [
        coveredEvent,
        { ...coveredEvent, id: "88888888-8888-4888-8888-888888888888", name: "Outro evento" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    const card = screen.getByRole("button", { name: `Abrir evento ${coveredEvent.name}` });
    const cover = card.querySelector("img");
    expect(card.parentElement).toHaveClass("grid-cols-2");
    expect(card).toHaveClass("aspect-square");
    expect(cover).toHaveAttribute("src", coveredEvent.coverImageUrl);
    expect(cover).toHaveClass("absolute", "inset-0", "size-full", "object-cover");

    await user.click(card);
    const detail = screen.getByRole("region", { name: coveredEvent.name });
    expect(detail.querySelector("img")).toHaveAttribute("src", coveredEvent.coverImageUrl);
  });

  it("lists only general event documents in Documentos and keeps profile in navigation", async () => {
    const { onChangePassword, onDownloadReceipt, onLogout, onOpenScore, user } = setup();

    await user.click(screen.getByRole("button", { name: "Documentos" }));
    expect(screen.queryByRole("heading", { name: "Partituras" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Canto de entrada" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Manual do encontro", level: 3 }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Abrir" })[0]);
    expect(screen.getByTitle("PDF Manual do encontro")).toBeInTheDocument();
    expect(onOpenScore).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    expect(screen.getByText("***.***.***-25")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Baixar comprovante em PDF" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(onDownloadReceipt).not.toHaveBeenCalled();
    expect(onChangePassword).toHaveBeenCalledOnce();
    expect(onLogout).toHaveBeenCalledOnce();
    expect(screen.getByText("Saindo…")).toBeInTheDocument();
    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
  });

  it("plays signed audio inline, offers continue listening, and releases the previous track", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));

    const audio = screen.getByLabelText("Reprodutor de áudio") as HTMLAudioElement;
    expect(audio).toHaveAttribute("src", "https://assets.example.test/audio.mp3");
    expect(screen.getByRole("region", { name: "Player de Canto de entrada" })).toHaveTextContent(
      "Soprano",
    );
    await waitFor(() => expect(play).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByRole("region", { name: "Player persistente" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reprodutor de áudio")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar ouvindo Canto de entrada" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar ouvindo Canto de entrada" }));
    expect(screen.getByRole("region", { name: "Player de Canto de entrada" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Tenor" }));
    await user.click(screen.getByRole("button", { name: "Tocar Tenor de Canto de entrada" }));

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

  it("renews an expired audio URL before starting playback", async () => {
    const expiredFeed: ChoristerPortalFeed = {
      ...feed,
      event: {
        ...feed.event,
        songs: feed.event.songs.map((song) => ({
          ...song,
          audios: song.audios.map((audio) => ({
            ...audio,
            expiresAt: "2020-01-01T00:00:00.000Z",
          })),
        })),
      },
    };
    const renewedAudio = {
      ...expiredFeed.event.songs[0].audios[0],
      signedUrl: "https://assets.example.test/fresh-audio.mp3",
      expiresAt: future,
    };
    const onRenewAudio = vi.fn().mockResolvedValue(renewedAudio);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup({ feed: expiredFeed, onRenewAudio });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Reprodutor de áudio")).toHaveAttribute(
        "src",
        renewedAudio.signedUrl,
      ),
    );
    expect(onRenewAudio).toHaveBeenCalledExactlyOnceWith(renewedAudio.id);
  });

  it("tracks audio progress and keeps the seek control touch friendly", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    const audio = screen.getByLabelText("Reprodutor de áudio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { configurable: true, value: 120 });
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 30 });
    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);

    const progress = screen.getByRole("slider", { name: "Progresso do áudio" });
    expect(progress).toHaveValue("30");
    expect(progress).toHaveAttribute("max", "120");
    expect(progress).toHaveClass("min-h-11");

    fireEvent.change(progress, { target: { value: "45" } });
    expect(audio.currentTime).toBe(45);
  });

  it("clears the signed feed and player before handing logout to the route", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    let hadSignedAudioAtLogout = false;
    let contentAtLogout = "";
    const onLogout = vi.fn(() => {
      hadSignedAudioAtLogout = document.querySelector("audio[src]") !== null;
      contentAtLogout = document.body.textContent ?? "";
    });
    const { user } = setup({ onLogout });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    expect(screen.getByLabelText("Reprodutor de áudio")).toHaveAttribute(
      "src",
      "https://assets.example.test/audio.mp3",
    );

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(onLogout).toHaveBeenCalledOnce();
    expect(hadSignedAudioAtLogout).toBe(false);
    expect(contentAtLogout).not.toContain("Manual do encontro");
    expect(screen.queryByLabelText("Reprodutor de áudio")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("https://assets.example.test/audio.mp3");
    expect(document.body).not.toHaveTextContent("Manual do encontro");
  });

  it("closes a pending score popup when changing tabs and logging out", async () => {
    const expiredFeed: ChoristerPortalFeed = {
      ...feed,
      event: {
        ...feed.event,
        songs: feed.event.songs.map((song) => ({
          ...song,
          sheetMusic: song.sheetMusic.map((asset) => ({
            ...asset,
            expiresAt: "2020-01-01T00:00:00.000Z",
          })),
        })),
      },
    };
    const renewed = {
      ...feed.event.songs[0].sheetMusic[0],
      signedUrl: "https://assets.example.test/late-logout-score.pdf",
    };
    let resolveRenewal: (asset: typeof renewed) => void = () => undefined;
    const pendingRenewal = new Promise<typeof renewed>((resolve) => {
      resolveRenewal = resolve;
    });
    const onOpenScore = vi.fn().mockReturnValue(pendingRenewal);
    const popup = { close: vi.fn(), location: { href: "" }, opener: window };
    const openWindow = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const { user } = setup({ feed: expiredFeed, onOpenScore });

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Abrir partitura de Canto de entrada" }));
    await user.click(screen.getByRole("button", { name: "Abrir em nova guia" }));
    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(popup.opener).toBeNull();

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    await act(async () => {
      resolveRenewal(renewed);
      await Promise.resolve();
    });

    await waitFor(() => expect(popup.close).toHaveBeenCalledOnce());
    expect(popup.location.href).toBe("");
    expect(document.body).not.toHaveTextContent(renewed.signedUrl);
  });

  it("handles ended and failed playback without leaving the player in a playing state", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    const audio = screen.getByLabelText("Reprodutor de áudio");

    fireEvent.ended(audio);
    expect(screen.getByRole("button", { name: "Reproduzir Canto de entrada" })).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();

    fireEvent.error(audio);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível reproduzir este áudio. Tente novamente.",
    );
  });

  it("ignores a synchronous non-Abort rejection while the listener changes tracks", async () => {
    let rejectFirstPlay: (reason?: unknown) => void = () => undefined;
    const firstPlay = new Promise<void>((_resolve, reject) => {
      rejectFirstPlay = reject;
    });
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementationOnce(() => firstPlay)
      .mockResolvedValueOnce(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
      rejectFirstPlay(new Error("old track rejected"));
    });
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("radio", { name: "Tenor" }));
    await user.click(screen.getByRole("button", { name: "Tocar Tenor de Canto de entrada" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    expect(screen.getByLabelText("Reprodutor de áudio")).toHaveAttribute(
      "src",
      "https://assets.example.test/tenor.mp3",
    );
    expect(screen.getByRole("button", { name: "Pausar Canto de entrada" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("creates a fresh playback attempt when the listener replays the same track", async () => {
    let rejectFirstPlay: (reason?: unknown) => void = () => undefined;
    const firstPlay = new Promise<void>((_resolve, reject) => {
      rejectFirstPlay = reject;
    });
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementationOnce(() => firstPlay)
      .mockResolvedValueOnce(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Pausar Soprano de Canto de entrada" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    await act(async () => {
      rejectFirstPlay(new Error("first attempt rejected"));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Pausar Canto de entrada" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not surface an intentional AbortError as a playback failure", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("playback interrupted", "AbortError"),
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pausar Canto de entrada" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces a non-Abort rejection for the current playback attempt", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("current track rejected"),
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Kit Ensaio" }));
    await user.click(screen.getByRole("button", { name: "Tocar Soprano de Canto de entrada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível reproduzir este áudio. Tente novamente.",
    );
    expect(screen.getByRole("button", { name: "Reproduzir Canto de entrada" })).toBeInTheDocument();
  });
});
