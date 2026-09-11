import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ParticipantAccess } from "./participant-auth.server";
import type { MaskedCpf, ParticipantRegistrationView } from "./participant.domain";
import { ParticipantPortalPage } from "./ParticipantPortalPage";

vi.mock("@/lib/participant.functions", () => ({
  getParticipantAccess: vi.fn(),
  getParticipantRegistration: vi.fn(),
}));
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
    includeShirt: true,
    shirtSize: "M",
    pricingType: "promotional",
    standardPriceCents: 12000,
    registrationPriceCents: 9000,
    shirtPriceCents: 3500,
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

type PortalOverrides = Partial<{
  checkAccess: () => Promise<ParticipantAccess>;
  loadRegistration: () => Promise<ParticipantRegistrationView>;
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
  it("does not load or reveal personal data before participant authorization", async () => {
    const access = deferred<ParticipantAccess>();
    const loadRegistration = vi.fn().mockResolvedValue(fullView);
    setup({ checkAccess: () => access.promise, loadRegistration });

    expect(screen.getByText("Verificando acesso…")).toBeInTheDocument();
    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    expect(loadRegistration).not.toHaveBeenCalled();

    await act(async () => access.resolve(authorizedAccess));

    expect(
      await screen.findByRole("heading", { name: "Maria da Silva", level: 1 }),
    ).toBeInTheDocument();
    expect(loadRegistration).toHaveBeenCalledOnce();
  });

  it.each<ParticipantAccess>([{ status: "unauthenticated" }, { status: "unavailable" }])(
    "redirects missing or unavailable participant access without rendering protected data",
    async (access) => {
      const loadRegistration = vi.fn().mockResolvedValue(fullView);
      const onMissingAccess = vi.fn();
      setup({ checkAccess: vi.fn().mockResolvedValue(access), loadRegistration, onMissingAccess });

      await waitFor(() => expect(onMissingAccess).toHaveBeenCalledOnce());
      expect(loadRegistration).not.toHaveBeenCalled();
      expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    },
  );

  it("keeps an authorized load failure generic and retries successfully", async () => {
    const loadRegistration = vi
      .fn()
      .mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAIL"))
      .mockResolvedValueOnce(fullView);
    const { user } = setup({ loadRegistration });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar seus dados. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_DATABASE_DETAIL");

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("heading", { name: "Maria da Silva", level: 1 }),
    ).toBeInTheDocument();
    expect(loadRegistration).toHaveBeenCalledTimes(2);
  });

  it("clears protected content, signs out, and then navigates to login", async () => {
    const signOut = deferred<{ error: null }>();
    const onSignedOut = vi.fn();
    const { user } = setup({ signOut: () => signOut.promise, onSignedOut });
    expect(
      await screen.findByRole("heading", { name: "Maria da Silva", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.queryByText("Maria da Silva")).not.toBeInTheDocument();
    expect(screen.getByText("Saindo…")).toBeInTheDocument();
    expect(onSignedOut).not.toHaveBeenCalled();

    await act(async () => signOut.resolve({ error: null }));
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("shows every available safe identification, registration, and payment field", async () => {
    setup();
    const identification = await screen.findByRole("tabpanel", { name: "Identificação" });

    expect(
      within(identification).getByRole("img", { name: "Foto de Maria da Silva" }),
    ).toHaveAttribute("src", fullView.identity.photoUrl);
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
      "Sim",
      "M",
      "Promocional",
      "Pago",
      "Cartão de crédito",
      "3x",
      "10/09/2026 às 12:30",
      "pedido-1234",
    ]) {
      expect(within(identification).getAllByText(value).length).toBeGreaterThan(0);
    }
    for (const [label, amount] of [
      ["Valor normal", /R\$\s*120,00/],
      ["Valor da inscrição", /R\$\s*90,00/],
      ["Valor da camisa", /R\$\s*35,00/],
      ["Valor da cobrança", /R\$\s*125,00/],
      ["Valor pago", /R\$\s*125,00/],
    ] as const) {
      expect(within(identification).getByText(label).parentElement).toHaveTextContent(amount);
    }
    expect(within(identification).getByRole("link", { name: "Abrir comprovante" })).toHaveAttribute(
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
        includeShirt: false,
        shirtSize: null,
        pricingType: null,
        standardPriceCents: null,
        registrationPriceCents: null,
        shirtPriceCents: null,
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
    setup({ loadRegistration: vi.fn().mockResolvedValue(sparseView) });
    const identification = await screen.findByRole("tabpanel", { name: "Identificação" });

    expect(
      within(identification).getByRole("img", { name: "Foto não disponível" }),
    ).toHaveTextContent("JL");
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
      expect(within(identification).queryByText(absentLabel)).not.toBeInTheDocument();
    }
    expect(identification).not.toHaveTextContent(/null|undefined/i);
    expect(within(identification).getByText("Não")).toBeInTheDocument();
  });

  it("replaces a failed signed photo with the neutral avatar fallback", async () => {
    setup();
    const identification = await screen.findByRole("tabpanel", { name: "Identificação" });
    fireEvent.error(within(identification).getByRole("img", { name: "Foto de Maria da Silva" }));

    expect(
      within(identification).getByRole("img", { name: "Foto não disponível" }),
    ).toHaveTextContent("MD");
    expect(
      within(identification).queryByRole("img", { name: "Foto de Maria da Silva" }),
    ).not.toBeInTheDocument();
  });

  it("shares one semantic section state across responsive keyboard navigation", async () => {
    const { user } = setup();
    await screen.findByRole("heading", { name: "Maria da Silva", level: 1 });

    const navigations = screen.getAllByRole("navigation", {
      name: "Seções da área do participante",
    });
    expect(navigations).toHaveLength(2);
    expect(navigations[0]).toHaveClass("md:hidden", "overflow-x-auto");
    expect(navigations[1]).toHaveClass("hidden", "md:block");
    expect(within(navigations[0]).getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
    expect(within(navigations[1]).getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    for (const navigation of navigations) {
      expect(
        within(navigation)
          .getAllByRole("tab")
          .map((tab) => tab.textContent),
      ).toEqual(["Identificação", "Playlist", "Partituras e Manuais", "Certificado"]);
    }

    const mobilePlaylist = within(navigations[0]).getByRole("tab", { name: "Playlist" });
    await user.click(mobilePlaylist);
    expect(screen.getByRole("tabpanel", { name: "Playlist" })).toHaveTextContent(
      "A playlist do encontro será disponibilizada em breve.",
    );
    expect(within(navigations[1]).getByRole("tab", { name: "Playlist" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    expect(fireEvent.keyDown(mobilePlaylist, { key: "ArrowRight" })).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Partituras e Manuais" })).toHaveTextContent(
      "As partituras e os materiais de orientação serão disponibilizados em breve.",
    );
    const mobileScores = within(navigations[0]).getByRole("tab", {
      name: "Partituras e Manuais",
    });
    expect(document.activeElement).toBe(mobileScores);

    expect(fireEvent.keyDown(mobileScores, { key: "ArrowDown" })).toBe(true);
    expect(document.activeElement).toBe(mobileScores);
    expect(screen.getByRole("tabpanel", { name: "Partituras e Manuais" })).toBeInTheDocument();

    const desktopCertificate = within(navigations[1]).getByRole("tab", { name: "Certificado" });
    await user.click(desktopCertificate);
    expect(screen.getByRole("tabpanel", { name: "Certificado" })).toHaveTextContent(
      "Seu certificado estará disponível após o evento.",
    );

    expect(fireEvent.keyDown(desktopCertificate, { key: "ArrowDown" })).toBe(false);
    const desktopIdentification = within(navigations[1]).getByRole("tab", {
      name: "Identificação",
    });
    expect(document.activeElement).toBe(desktopIdentification);
    expect(screen.getByRole("tabpanel", { name: "Identificação" })).toBeInTheDocument();

    expect(fireEvent.keyDown(desktopIdentification, { key: "ArrowRight" })).toBe(true);
    expect(document.activeElement).toBe(desktopIdentification);
    expect(screen.getByRole("tabpanel", { name: "Identificação" })).toBeInTheDocument();
  });

  it("opens a functional voluntary password-change dialog from the header", async () => {
    const { user, getSignedInEmail, reauthenticateForPasswordChange, updatePassword } = setup();
    await screen.findByRole("heading", { name: "Maria da Silva", level: 1 });

    expect(screen.queryByText(/obrigat[oó]ri[ao].*senha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /recuperar|esqueci/i })).not.toBeInTheDocument();

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
    const identification = await screen.findByRole("tabpanel", { name: "Identificação" });
    const downloadButton = within(identification).getByRole("button", {
      name: "Baixar comprovante em PDF",
    });

    await user.click(downloadButton);

    expect(await within(identification).findByRole("alert")).toHaveTextContent(
      "Não foi possível gerar o comprovante em PDF. Tente novamente.",
    );
    expect(identification).not.toHaveTextContent("PRIVATE_PDF_DETAIL");

    await user.click(downloadButton);

    await waitFor(() => expect(downloadReceipt).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(identification).queryByRole("alert")).not.toBeInTheDocument(),
    );
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
    setup({ loadRegistration: vi.fn().mockResolvedValue(incompleteView) });

    const identification = await screen.findByRole("tabpanel", { name: "Identificação" });
    expect(
      within(identification).queryByRole("button", { name: "Baixar comprovante em PDF" }),
    ).not.toBeInTheDocument();
  });
});
