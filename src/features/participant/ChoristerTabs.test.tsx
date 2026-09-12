import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";

import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { ChoristerProfileTab } from "./ChoristerProfileTab";
import { ChoristerScoresTab } from "./ChoristerScoresTab";
import { ChoristerSongsTab } from "./ChoristerSongsTab";

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { configurable: true, value: () => false },
  scrollIntoView: { configurable: true, value: () => undefined },
});

afterEach(() => vi.restoreAllMocks());

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

const scoreFeed: ChoristerPortalFeed = {
  ...feed,
  event: {
    ...feed.event,
    songs: [
      ...feed.event.songs,
      {
        id: "77777777-7777-4777-8777-777777777777",
        order: 3,
        name: "Canto de comunhão",
        liturgicalType: "Comunhão",
        lyrics: null,
        chords: null,
        audios: [],
        sheetMusic: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            title: "Partitura de comunhão",
            signedUrl: "https://assets.example.test/communion.pdf",
            expiresAt: future,
          },
        ],
      },
    ],
    documents: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        kind: "manual",
        title: "Manual do encontro",
        signedUrl: "https://assets.example.test/manual.pdf",
        expiresAt: future,
        sortOrder: 2,
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "document",
        title: "Orientações litúrgicas",
        signedUrl: "https://assets.example.test/guidance.pdf",
        expiresAt: future,
        sortOrder: 1,
      },
    ],
  },
};

const participant: ParticipantRegistrationView = {
  identity: {
    name: "Maria da Silva",
    cpf: "***.***.***-25" as MaskedCpf,
    birthDate: "1990-01-15",
    email: "maria@example.com",
    phone: "(85) 99999-0000",
    photoUrl: null,
  },
  registration: {
    choirName: "Coral Santa Cecília",
    diocese: "Diocese de Quixadá",
    city: null,
    institution: null,
    role: null,
    voicePart: "soprano",
    pricingType: null,
    standardPriceCents: null,
    registrationPriceCents: null,
  },
  payment: {
    status: "paid",
    amountCents: 12000,
    paidAmountCents: 12000,
    paymentMethod: "pix",
    installments: null,
    paidAt: "2026-09-10T15:30:00.000Z",
    orderNsu: "pedido-1234",
    receiptUrl: "https://receipts.example.test/pedido-1234",
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

  it("keeps every voice option at the 44px minimum touch target", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: "Filtrar por naipe" }));
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveClass("min-h-11");
    }
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

describe("ChoristerScoresTab", () => {
  it("groups published scores by song and documents by their feed order", () => {
    const onOpen = vi.fn();
    const onDownload = vi.fn();

    render(<ChoristerScoresTab event={scoreFeed.event} onOpen={onOpen} onDownload={onDownload} />);

    expect(screen.getByRole("heading", { name: "Partituras" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Canto de entrada", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Canto de comunhão", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Orientações litúrgicas", "Manual do encontro"]);
    expect(
      screen.queryByRole("button", { name: /enviar|upload|editar|remover/i }),
    ).not.toBeInTheDocument();
  });

  it("treats a blocked handle as a neutral error without exposing an expired PDF", async () => {
    const expiredEvent = {
      ...scoreFeed.event,
      songs: scoreFeed.event.songs.map((song) => ({
        ...song,
        sheetMusic: song.sheetMusic.map((asset) => ({
          ...asset,
          expiresAt: "2020-01-01T00:00:00.000Z",
        })),
      })),
    };
    const onOpen = vi.fn().mockResolvedValue(undefined);
    const onDownload = vi.fn();
    const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();

    render(<ChoristerScoresTab event={expiredEvent} onOpen={onOpen} onDownload={onDownload} />);

    await user.click(screen.getAllByRole("button", { name: "Abrir" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir este PDF");
    await user.click(screen.getByRole("button", { name: "Abrir em nova guia" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
  });

  it("uses an isolated popup handle for a non-expired PDF", async () => {
    const popup = { close: vi.fn(), location: { href: "" }, opener: window };
    const openWindow = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab event={scoreFeed.event} onOpen={vi.fn()} onDownload={vi.fn()} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    await user.click(within(view.container).getByRole("button", { name: "Abrir em nova guia" }));

    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toBe("https://assets.example.test/score.pdf");
    expect(openWindow).not.toHaveBeenCalledWith(
      "https://assets.example.test/score.pdf",
      "_blank",
      expect.anything(),
    );
  });

  it("uses one refreshed signed URL after expiry and stops renewing when its iframe fails", async () => {
    const refreshed = {
      ...scoreFeed.event.songs[1].sheetMusic[0],
      signedUrl: "https://assets.example.test/refreshed-score.pdf",
      expiresAt: future,
    };
    const onOpen = vi.fn().mockResolvedValue(refreshed);
    const user = userEvent.setup();
    const expiredEvent = {
      ...scoreFeed.event,
      songs: scoreFeed.event.songs.map((song) => ({
        ...song,
        sheetMusic: song.sheetMusic.map((asset) => ({
          ...asset,
          expiresAt: "2020-01-01T00:00:00.000Z",
        })),
      })),
    };

    const view = render(
      <ChoristerScoresTab event={expiredEvent} onOpen={onOpen} onDownload={vi.fn()} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    const viewer = await within(view.container).findByTitle("PDF Partitura");
    expect(viewer).toHaveAttribute("src", refreshed.signedUrl);
    fireEvent(viewer, new Event("error", { bubbles: true }));

    expect(await within(view.container).findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir este PDF",
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps one renewal per viewer when an iframe fails before its initial request resolves", async () => {
    const firstAsset = scoreFeed.event.songs[1].sheetMusic[0];
    const newerAsset = {
      ...scoreFeed.event.songs[2].sheetMusic[0],
      signedUrl: "https://assets.example.test/newer-score.pdf",
    };
    let resolveFirst: (asset: typeof firstAsset) => void = () => undefined;
    const firstRequest = new Promise<typeof firstAsset>((resolve) => {
      resolveFirst = resolve;
    });
    const onOpen = vi
      .fn()
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce(newerAsset);
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab event={scoreFeed.event} onOpen={onOpen} onDownload={vi.fn()} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    const firstViewer = await within(view.container).findByTitle("PDF Partitura");
    fireEvent(firstViewer, new Event("error", { bubbles: true }));

    expect(await within(view.container).findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir este PDF",
    );
    expect(onOpen.mock.calls.filter(([asset]) => asset.id === firstAsset.id)).toHaveLength(1);

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[1]);
    expect(await within(view.container).findByTitle("PDF Partitura de comunhão")).toHaveAttribute(
      "src",
      newerAsset.signedUrl,
    );

    await act(async () => {
      resolveFirst({ ...firstAsset, signedUrl: "https://assets.example.test/stale-score.pdf" });
      await Promise.resolve();
    });

    expect(within(view.container).getByTitle("PDF Partitura de comunhão")).toHaveAttribute(
      "src",
      newerAsset.signedUrl,
    );
    expect(onOpen.mock.calls.filter(([asset]) => asset.id === firstAsset.id)).toHaveLength(1);
  });

  it("pre-opens a popup and only sends it the renewed URL for an expired PDF", async () => {
    const expiredEvent = {
      ...scoreFeed.event,
      songs: scoreFeed.event.songs.map((song) => ({
        ...song,
        sheetMusic: song.sheetMusic.map((asset) => ({
          ...asset,
          expiresAt: "2020-01-01T00:00:00.000Z",
        })),
      })),
    };
    const renewed = {
      ...scoreFeed.event.songs[1].sheetMusic[0],
      signedUrl: "https://assets.example.test/popup-renewed-score.pdf",
      expiresAt: future,
    };
    let resolveRenewal: (asset: typeof renewed) => void = () => undefined;
    const renewal = new Promise<typeof renewed>((resolve) => {
      resolveRenewal = resolve;
    });
    const onOpen = vi.fn().mockImplementation(() => renewal);
    const popup = { close: vi.fn(), location: { href: "" }, opener: window };
    const openWindow = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab event={expiredEvent} onOpen={onOpen} onDownload={vi.fn()} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    await user.click(within(view.container).getByRole("button", { name: "Abrir em nova guia" }));

    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toBe("");
    expect(onOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRenewal(renewed);
      await Promise.resolve();
    });

    await waitFor(() => expect(popup.location.href).toBe(renewed.signedUrl));
    expect(openWindow).not.toHaveBeenCalledWith(renewed.signedUrl, "_blank", expect.anything());
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("does not navigate a cached renewed PDF after that URL expires", async () => {
    const expiredEvent = {
      ...scoreFeed.event,
      songs: scoreFeed.event.songs.map((song) => ({
        ...song,
        sheetMusic: song.sheetMusic.map((asset) => ({
          ...asset,
          expiresAt: "2020-01-01T00:00:00.000Z",
        })),
      })),
    };
    const renewed = {
      ...scoreFeed.event.songs[1].sheetMusic[0],
      signedUrl: "https://assets.example.test/cached-renewed-score.pdf",
      expiresAt: future,
    };
    const onOpen = vi.fn().mockResolvedValue(renewed);
    const popup = { close: vi.fn(), location: { href: "" }, opener: window };
    const openWindow = vi.spyOn(window, "open");
    openWindow.mockReturnValue(popup as unknown as Window);
    const user = userEvent.setup();

    render(<ChoristerScoresTab event={expiredEvent} onOpen={onOpen} onDownload={vi.fn()} />);

    await user.click(screen.getAllByRole("button", { name: "Abrir" })[0]);
    await screen.findByTitle(`PDF ${renewed.title}`);
    renewed.expiresAt = "2020-01-01T00:00:00.000Z";

    await user.click(screen.getByRole("button", { name: "Abrir em nova guia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir este PDF");
    expect(onOpen).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(popup.location.href).toBe("");
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it("does not renew the same viewer asset again after an iframe failure", async () => {
    const asset = { ...scoreFeed.event.songs[1].sheetMusic[0] };
    const lifecycleEvent = {
      ...scoreFeed.event,
      songs: scoreFeed.event.songs.map((song) =>
        song.id === scoreFeed.event.songs[1].id ? { ...song, sheetMusic: [asset] } : song,
      ),
    };
    const onOpen = vi.fn().mockResolvedValue(undefined);
    const onDownload = vi.fn();
    const popup = { close: vi.fn(), location: { href: "" }, opener: window };
    const openWindow = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab event={lifecycleEvent} onOpen={onOpen} onDownload={onDownload} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    const viewer = await within(view.container).findByTitle("PDF Partitura");
    fireEvent(viewer, new Event("error", { bubbles: true }));
    expect(await within(view.container).findByRole("alert")).toBeInTheDocument();

    asset.expiresAt = "2020-01-01T00:00:00.000Z";
    await user.click(within(view.container).getAllByRole("button", { name: "Abrir" })[0]);
    await user.click(within(view.container).getByRole("button", { name: "Abrir em nova guia" }));
    await user.click(within(view.container).getByRole("button", { name: "Baixar PDF" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDownload).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledExactlyOnceWith("", "_blank");
    expect(popup.opener).toBeNull();
    await waitFor(() => expect(popup.close).toHaveBeenCalledOnce());
  });

  it("does not click a download anchor after the score tab unmounts", async () => {
    const renewed = {
      ...scoreFeed.event.songs[1].sheetMusic[0],
      signedUrl: "https://assets.example.test/unmounted-download.pdf",
    };
    let resolveDownload: (asset: typeof renewed) => void = () => undefined;
    const pendingDownload = new Promise<typeof renewed>((resolve) => {
      resolveDownload = resolve;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab
        event={scoreFeed.event}
        onOpen={vi.fn()}
        onDownload={vi.fn().mockReturnValue(pendingDownload)}
      />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Baixar" })[0]);
    view.unmount();

    await act(async () => {
      resolveDownload(renewed);
      await Promise.resolve();
    });

    expect(click).not.toHaveBeenCalled();
  });

  it("downloads the renewed signed PDF returned by the shell callback", async () => {
    const renewed = {
      ...scoreFeed.event.songs[1].sheetMusic[0],
      signedUrl: "https://assets.example.test/renewed-download.pdf",
      expiresAt: future,
    };
    const onDownload = vi.fn().mockResolvedValue(renewed);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const user = userEvent.setup();
    const view = render(
      <ChoristerScoresTab event={scoreFeed.event} onOpen={vi.fn()} onDownload={onDownload} />,
    );

    await user.click(within(view.container).getAllByRole("button", { name: "Baixar" })[0]);

    await waitFor(() => expect(onDownload).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ id: renewed.id, signedUrl: expect.stringContaining("score.pdf") }),
    );
    expect(click.mock.instances[0]).toHaveAttribute("href", renewed.signedUrl);
  });
});

describe("ChoristerProfileTab", () => {
  it("keeps the existing neutral identity fallback when a private profile photo is unavailable", () => {
    render(
      <ChoristerProfileTab
        participant={participant}
        onChangePassword={vi.fn()}
        onDownloadReceipt={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Foto não disponível" })).toHaveTextContent("MD");
    expect(document.body).not.toHaveTextContent("registration-photos/");
  });

  it("keeps the masked registration actions together and clears its content before logout completes", async () => {
    const onChangePassword = vi.fn();
    const onDownloadReceipt = vi.fn();
    const onLogout = vi.fn();
    const user = userEvent.setup();

    render(
      <ChoristerProfileTab
        participant={participant}
        onChangePassword={onChangePassword}
        onDownloadReceipt={onDownloadReceipt}
        onLogout={onLogout}
      />,
    );

    expect(screen.getByText("***.***.***-25")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("529.982.247-25");
    expect(screen.getByText("10/09/2026 às 12:30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir comprovante" })).toHaveAttribute(
      "href",
      participant.payment.receiptUrl,
    );

    await user.click(screen.getByRole("button", { name: "Baixar comprovante em PDF" }));
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(onDownloadReceipt).toHaveBeenCalledExactlyOnceWith(participant);
    expect(onChangePassword).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Saindo…")).toBeInTheDocument();
    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
  });
});
