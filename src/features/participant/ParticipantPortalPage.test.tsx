import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  ChoristerPortalCollectionState,
  ChoristerPortalFeed,
  ChoristerPortalFeedState,
} from "@/features/chorister-app/choristerApp.domain";

import type { ParticipantAccess } from "./participant-auth.server";
import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { ParticipantPortalPage } from "./ParticipantPortalPage";

vi.mock("@/lib/participant.functions", () => ({
  getParticipantAccess: vi.fn(),
  getParticipantRegistration: vi.fn(),
}));
vi.mock("@/lib/chorister-app.functions", () => ({ getChoristerPortalFeed: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

const authorizedAccess = {
  status: "authorized",
  accountId: "11111111-1111-4111-8111-111111111111",
  registrationId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
} satisfies ParticipantAccess;

const fullView: ParticipantRegistrationView = {
  identity: {
    name: "Maria da Silva",
    cpf: "***.***.***-25" as MaskedCpf,
    birthDate: "1990-01-15",
    email: "maria@example.com",
    phone: "(85) 99999-0000",
    photoUrl: "https://example.com/signed-photo.jpg",
  },
  registration: {
    choirName: "Coral Santa Cecília",
    diocese: "Diocese de Quixadá",
    city: "Quixadá",
    institution: "Paróquia Catedral",
    role: "Regente",
    voicePart: "soprano",
    pricingType: "promotional",
    standardPriceCents: 12000,
    registrationPriceCents: 9000,
  },
  payment: {
    status: "paid",
    amountCents: 12500,
    paidAmountCents: 12500,
    paymentMethod: "credit_card",
    installments: 3,
    paidAt: "2026-09-10T15:30:00.000Z",
    orderNsu: "pedido-1234",
    receiptUrl: "https://example.com/receipt/1234",
  },
};

const publishedFeed: ChoristerPortalFeed = {
  status: "published",
  event: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "II Encontro de Coros Diocesanos e Litúrgicos",
    date: "2026-11-20",
    location: "Quixadá",
    coverImageUrl: null,
    songs: [],
    documents: [],
  },
};

type PortalOverrides = Partial<{
  checkAccess: () => Promise<ParticipantAccess>;
  loadRegistration: () => Promise<ParticipantRegistrationView>;
  loadFeed: () => Promise<ChoristerPortalFeedState>;
  signOut: () => Promise<{ error: unknown }>;
  onMissingAccess: () => void;
  onSignedOut: () => void;
  reauthenticateForPasswordChange: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: unknown }>;
  updatePassword: (password: string) => Promise<{ error: unknown }>;
  getSignedInEmail: () => Promise<{ email: string | null; error: unknown }>;
  downloadReceipt: (view: ParticipantRegistrationView) => Promise<void>;
}>;

function setup(overrides: PortalOverrides = {}) {
  const props = {
    checkAccess: vi.fn().mockResolvedValue(authorizedAccess),
    loadRegistration: vi.fn().mockResolvedValue(fullView),
    loadFeed: vi.fn().mockResolvedValue(publishedFeed),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onMissingAccess: vi.fn(),
    onSignedOut: vi.fn(),
    reauthenticateForPasswordChange: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    getSignedInEmail: vi
      .fn()
      .mockResolvedValue({ email: "sessao-verificada@example.com", error: null }),
    downloadReceipt: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<ParticipantPortalPage {...props} />);
  return { ...props, user: userEvent.setup() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("ParticipantPortalPage", () => {
  it("renders every configured CoroApp event without mixing their repertoires", async () => {
    const collection: ChoristerPortalCollectionState = {
      status: "published",
      events: [
        publishedFeed.event,
        {
          ...publishedFeed.event,
          id: "55555555-5555-4555-8555-555555555555",
          name: "Solenidade de Cristo Rei",
          date: "2026-11-22",
          location: "Catedral Jesus, Maria e José",
        },
      ],
    };
    const user = userEvent.setup();
    render(
      <ParticipantPortalPage
        onMissingAccess={vi.fn()}
        onSignedOut={vi.fn()}
        checkAccess={async () => authorizedAccess}
        loadRegistration={async () => fullView}
        loadCollection={async () => collection}
        signOut={async () => ({ error: null })}
      />,
    );

    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Cantos" }));
    expect(screen.getByText(publishedFeed.event.name)).toBeInTheDocument();
    expect(screen.getByText("Solenidade de Cristo Rei")).toBeInTheDocument();
  });

  it("does not load the registration, feed, or protected data before participant authorization", async () => {
    const access = deferred<ParticipantAccess>();
    const loadRegistration = vi.fn().mockResolvedValue(fullView);
    const loadFeed = vi.fn().mockResolvedValue(publishedFeed);
    setup({ checkAccess: () => access.promise, loadRegistration, loadFeed });

    expect(screen.getByText("Verificando acesso…")).toBeInTheDocument();
    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    expect(loadRegistration).not.toHaveBeenCalled();
    expect(loadFeed).not.toHaveBeenCalled();

    await act(async () => access.resolve(authorizedAccess));

    expect(
      await screen.findByRole("heading", {
        name: "Maria",
      }),
    ).toBeInTheDocument();
    expect(loadRegistration).toHaveBeenCalledOnce();
    expect(loadFeed).toHaveBeenCalledOnce();
  });

  it.each<ParticipantAccess>([{ status: "unauthenticated" }, { status: "unavailable" }])(
    "redirects missing or unavailable participant access without rendering protected data",
    async (access) => {
      const loadRegistration = vi.fn().mockResolvedValue(fullView);
      const loadFeed = vi.fn().mockResolvedValue(publishedFeed);
      const onMissingAccess = vi.fn();
      setup({
        checkAccess: vi.fn().mockResolvedValue(access),
        loadRegistration,
        loadFeed,
        onMissingAccess,
      });

      await waitFor(() => expect(onMissingAccess).toHaveBeenCalledOnce());
      expect(loadRegistration).not.toHaveBeenCalled();
      expect(loadFeed).not.toHaveBeenCalled();
      expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    },
  );

  it("keeps an authorized load failure generic and retries successfully", async () => {
    const loadRegistration = vi
      .fn()
      .mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAIL"))
      .mockResolvedValueOnce(fullView);
    const loadFeed = vi.fn().mockResolvedValue(publishedFeed);
    const { user } = setup({ loadRegistration, loadFeed });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar seus dados. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_DATABASE_DETAIL");

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", {
        name: "Maria",
      }),
    ).toBeInTheDocument();
    expect(loadRegistration).toHaveBeenCalledTimes(2);
    expect(loadFeed).toHaveBeenCalledOnce();
  });

  it("keeps the authenticated shell and profile available when materials are not published", async () => {
    const { user } = setup({ loadFeed: vi.fn().mockResolvedValue({ status: "not_published" }) });

    expect(
      await screen.findByText("Os materiais do encontro ainda não foram publicados."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    expect(within(profile).getByText("Maria da Silva")).toBeInTheDocument();
    expect(within(profile).getByText("Coral Santa Cecília")).toBeInTheDocument();
  });

  it("shows a retryable neutral state when the authorized feed is unavailable", async () => {
    const loadFeed = vi
      .fn()
      .mockResolvedValueOnce({ status: "unavailable" } satisfies ChoristerPortalFeedState)
      .mockResolvedValueOnce(publishedFeed);
    const { user } = setup({ loadFeed });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os materiais do encontro. Tente novamente.",
    );
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    expect(within(profile).getByText("Maria da Silva")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", {
        name: "Maria",
      }),
    ).toBeInTheDocument();
    expect(loadFeed).toHaveBeenCalledTimes(2);
  });

  it("renews an expired score from the authorized feed without exposing its stale URL", async () => {
    const expiredFeed: ChoristerPortalFeed = {
      ...publishedFeed,
      event: {
        ...publishedFeed.event,
        songs: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            order: 1,
            name: "Canto de entrada",
            liturgicalType: "Entrada",
            lyrics: null,
            chords: null,
            audios: [],
            sheetMusic: [
              {
                id: "66666666-6666-4666-8666-666666666666",
                title: "Partitura",
                signedUrl: "https://assets.example.test/stale-score.pdf",
                expiresAt: "2020-01-01T00:00:00.000Z",
              },
            ],
          },
        ],
      },
    };
    const renewedFeed: ChoristerPortalFeed = {
      ...expiredFeed,
      event: {
        ...expiredFeed.event,
        songs: expiredFeed.event.songs.map((song) => ({
          ...song,
          sheetMusic: song.sheetMusic.map((asset) => ({
            ...asset,
            signedUrl: "https://assets.example.test/renewed-score.pdf",
            expiresAt: "2099-11-20T12:00:00.000Z",
          })),
        })),
      },
    };
    const loadFeed = vi.fn().mockResolvedValueOnce(expiredFeed).mockResolvedValueOnce(renewedFeed);
    const { user } = setup({ loadFeed });

    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Cantos" }));
    await user.click(screen.getByRole("button", { name: "Abrir partitura de Canto de entrada" }));

    expect(await screen.findByTitle("PDF Partitura")).toHaveAttribute(
      "src",
      "https://assets.example.test/renewed-score.pdf",
    );
    expect(loadFeed).toHaveBeenCalledTimes(2);
    expect(document.body).not.toHaveTextContent("https://assets.example.test/stale-score.pdf");
  });

  it("clears protected content, signs out, and then navigates to login", async () => {
    const signOut = deferred<{ error: null }>();
    const onSignedOut = vi.fn();
    const { user } = setup({ signOut: () => signOut.promise, onSignedOut });
    await screen.findByRole("heading", { name: "Maria" });

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    expect(within(profile).getByText("Maria da Silva")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    expect(
      screen.queryByText("II Encontro de Coros Diocesanos e Litúrgicos"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Saindo…")).toBeInTheDocument();
    expect(onSignedOut).not.toHaveBeenCalled();

    await act(async () => signOut.resolve({ error: null }));
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("shows every available safe identification, registration, and payment field", async () => {
    const { user } = setup();
    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;

    expect(within(profile).getByRole("img", { name: "Foto de Maria da Silva" })).toHaveAttribute(
      "src",
      fullView.identity.photoUrl,
    );
    for (const value of [
      "Maria da Silva",
      "***.***.***-25",
      "15/01/1990",
      "maria@example.com",
      "(85) 99999-0000",
      "Coral Santa Cecília",
      "Diocese de Quixadá",
      "Quixadá",
      "Paróquia Catedral",
      "Regente",
      "Soprano",
      "Promocional",
      "Pago",
      "Cartão de crédito",
      "3x",
      "10/09/2026 às 12:30",
      "pedido-1234",
    ]) {
      expect(within(profile).getAllByText(value).length).toBeGreaterThan(0);
    }
    for (const [label, amount] of [
      ["Valor normal", /R\$\s*120,00/],
      ["Valor da inscrição", /R\$\s*90,00/],
      ["Valor da cobrança", /R\$\s*125,00/],
      ["Valor pago", /R\$\s*125,00/],
    ] as const) {
      expect(within(profile).getByText(label).parentElement).toHaveTextContent(amount);
    }
    expect(within(profile).getByRole("link", { name: "Abrir comprovante" })).toHaveAttribute(
      "href",
      fullView.payment.receiptUrl,
    );
    expect(document.body).not.toHaveTextContent("529.982.247-25");
    expect(document.body).not.toHaveTextContent("registration-photos/");
  });

  it("omits unavailable fields and renders a neutral fallback avatar", async () => {
    const sparseView: ParticipantRegistrationView = {
      identity: {
        name: "João Lima",
        cpf: "***.***.***-09" as MaskedCpf,
        birthDate: "1985-03-02",
        email: null,
        phone: null,
        photoUrl: null,
      },
      registration: {
        choirName: "Coral Diocesano",
        diocese: "Diocese de Crato",
        city: null,
        institution: null,
        role: null,
        voicePart: null,
        pricingType: null,
        standardPriceCents: null,
        registrationPriceCents: null,
      },
      payment: {
        status: "paid",
        amountCents: null,
        paidAmountCents: null,
        paymentMethod: null,
        installments: null,
        paidAt: null,
        orderNsu: null,
        receiptUrl: null,
      },
    };
    const { user } = setup({ loadRegistration: vi.fn().mockResolvedValue(sparseView) });
    await screen.findByRole("heading", { name: "João" });
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;

    expect(within(profile).getByRole("img", { name: "Foto não disponível" })).toHaveTextContent(
      "JL",
    );
    for (const absentLabel of [
      "E-mail",
      "Telefone",
      "Cidade",
      "Instituição",
      "Função",
      "Parte vocal",
      "Tamanho da camisa",
      "Tipo do valor",
      "Valor normal",
      "Valor da inscrição",
      "Valor da camisa",
      "Valor da cobrança",
      "Valor pago",
      "Forma de pagamento",
      "Parcelas",
      "Pago em",
      "Pedido",
      "Comprovante",
    ]) {
      expect(within(profile).queryByText(absentLabel)).not.toBeInTheDocument();
    }
    expect(profile).not.toHaveTextContent(/null|undefined/i);
  });

  it("replaces a failed signed photo with the neutral avatar fallback", async () => {
    const { user } = setup();
    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    fireEvent.error(within(profile).getByRole("img", { name: "Foto de Maria da Silva" }));

    expect(within(profile).getByRole("img", { name: "Foto não disponível" })).toHaveTextContent(
      "MD",
    );
    expect(
      within(profile).queryByRole("img", { name: "Foto de Maria da Silva" }),
    ).not.toBeInTheDocument();
  });

  it("replaces participant placeholders with the approved five-tab Coralista navigation", async () => {
    const { user } = setup();
    await screen.findByRole("heading", { name: "Maria" });

    const navigation = screen.getByRole("navigation", { name: "Navegação de Participante" });
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Início", "Cantos", "Documentos", "Programação", "Meu Perfil"]);
    expect(screen.queryByRole("button", { name: /playlist|certificado/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cantos" }));
    expect(screen.getByRole("heading", { name: "Músicas" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Documentos" }));
    expect(screen.getByRole("heading", { name: "Documentos", level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Programação" }));
    expect(screen.getByRole("heading", { name: "Guia do evento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    expect(screen.getByRole("heading", { name: "Meu Perfil" })).toBeInTheDocument();
  });

  it("opens a functional voluntary password-change dialog from the header", async () => {
    const { user, getSignedInEmail, reauthenticateForPasswordChange, updatePassword } = setup();
    await screen.findByRole("heading", { name: "Maria" });

    expect(screen.queryByText(/obrigat[oó]ri[ao].*senha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /recuperar|esqueci/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(screen.getByRole("dialog", { name: "Alterar senha" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Senha atual"), "senha-atual");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "nova-senha");
    const dialog = screen.getByRole("dialog", { name: "Alterar senha" });
    await user.click(within(dialog).getByRole("button", { name: "Alterar senha" }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledOnce());
    expect(getSignedInEmail).toHaveBeenCalledOnce();
    expect(reauthenticateForPasswordChange).toHaveBeenCalledExactlyOnceWith({
      email: "sessao-verificada@example.com",
      password: "senha-atual",
    });
    expect(updatePassword).toHaveBeenCalledExactlyOnceWith("nova-senha");
  });

  it("offers the PDF only for a complete paid snapshot and retries a generation failure", async () => {
    const downloadReceipt = vi
      .fn()
      .mockRejectedValueOnce(new Error("PRIVATE_PDF_DETAIL"))
      .mockResolvedValueOnce(undefined);
    const { user } = setup({ downloadReceipt });
    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    const downloadButton = within(profile).getByRole("button", {
      name: "Baixar comprovante em PDF",
    });

    await user.click(downloadButton);

    expect(await within(profile).findByRole("alert")).toHaveTextContent(
      "Não foi possível gerar o comprovante em PDF. Tente novamente.",
    );
    expect(profile).not.toHaveTextContent("PRIVATE_PDF_DETAIL");

    await user.click(downloadButton);

    await waitFor(() => expect(downloadReceipt).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(profile).queryByRole("alert")).not.toBeInTheDocument());
    expect(downloadReceipt).toHaveBeenNthCalledWith(1, fullView);
    expect(downloadReceipt).toHaveBeenNthCalledWith(2, fullView);
  });

  it.each([
    ["order", { orderNsu: null }],
    ["paid amount", { paidAmountCents: null }],
    ["payment date", { paidAt: null }],
  ])("hides the PDF action without the required %s", async (_field, paymentOverride) => {
    const incompleteView: ParticipantRegistrationView = {
      ...fullView,
      payment: { ...fullView.payment, ...paymentOverride },
    };
    const { user } = setup({ loadRegistration: vi.fn().mockResolvedValue(incompleteView) });
    await screen.findByRole("heading", { name: "Maria" });
    await user.click(screen.getByRole("button", { name: "Meu Perfil" }));
    const profile = screen.getByRole("heading", { name: "Meu Perfil" }).closest("section")!;
    expect(
      within(profile).queryByRole("button", { name: "Baixar comprovante em PDF" }),
    ).not.toBeInTheDocument();
  });
});
