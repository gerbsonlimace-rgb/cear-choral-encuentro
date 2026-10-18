import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AdminRegistrationRow, AdminRegistrationSummary } from "./admin.domain";
import { AdminRegistrationsPage } from "./AdminRegistrationsPage";

vi.mock("@/lib/admin.functions", () => ({
  getAdminAccess: vi.fn(),
  getAdminRegistrationSummary: vi.fn(),
  listAdminRegistrations: vi.fn(),
  exportAdminRegistrations: vi.fn(),
  createAdminRegistrationCheckoutLink: vi.fn(),
  markAdminRegistrationPaid: vi.fn(),
  markAdminRegistrationExempt: vi.fn(),
  deleteAdminRegistration: vi.fn(),
  getAdminRegistrationReceipt: vi.fn(),
  reprocessParticipantAccess: vi.fn(),
  resetParticipantInitialPassword: vi.fn(),
  updateAdminRegistration: vi.fn(),
  listAdminRegistrationRoles: vi.fn(async () => ({})),
  grantAdminFromRegistration: vi.fn(),
  revokeAdminFromRegistration: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("@/lib/choir-pricing.functions", () => ({
  getPublicRegistrationConfiguration: vi.fn(async () => ({
    choirs: [
      {
        id: "choir-1",
        name: "Coro Diocesano de Quixadá",
        diocese: null,
        pricingType: "standard",
        standardPriceCents: 30000,
        registrationPriceCents: 30000,
      },
    ],
  })),
}));

beforeAll(() => {
  // jsdom has no layout/pointer capture; retain the real Radix Select behavior.
  HTMLElement.prototype.scrollIntoView = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
});
afterEach(() => vi.unstubAllGlobals());

const legacy: AdminRegistrationRow = {
  id: "legacy",
  createdAt: "2026-09-01T12:00:00Z",
  name: "Ana Histórica",
  badgeName: "Ana",
  cpf: "529.982.247-25",
  birthDate: "1990-01-02",
  diocese: "Diocese de Quixadá",
  choirName: "Diocese de Quixadá",
  otherChoirName: null,
  email: "ana@example.com",
  phone: "85999990000",
  city: "Quixadá",
  institution: null,
  role: "singer",
  voicePart: "soprano",
  observations: "Participante da edição anterior.",
  includeShirt: false,
  shirtSize: null,
  shirtPriceCents: null,
  paymentStatus: "legacy",
  amountCents: null,
  paidAmountCents: null,
  paymentMethod: null,
  installments: null,
  paidAt: null,
  pricingType: null,
  standardPriceCents: null,
  registrationPriceCents: null,
  photoUrl: null,
  regentName: null,
  musicalProfile: null,
};
const pending: AdminRegistrationRow = {
  ...legacy,
  id: "pending",
  name: "Bruno Pendente",
  paymentStatus: "pending",
  amountCents: 10000,
  musicalProfile: "regente",
};
const paid: AdminRegistrationRow = {
  ...legacy,
  id: "paid",
  name: "Clara Paga",
  paymentStatus: "paid",
  amountCents: 13990,
  paidAmountCents: 13990,
  paymentMethod: "credit_card",
  installments: 2,
  paidAt: "2026-09-02T12:00:00Z",
  photoUrl: "https://example.com/foto-clara.jpg",
  musicalProfile: "instrumentista",
  participantAccess: { label: "Ativo", canReprocess: false, canReset: true },
};
const partial: AdminRegistrationRow = {
  ...paid,
  id: "partial",
  name: "Daniela Parcial",
  paidAmountCents: 18000,
  financialState: {
    status: "partially_paid",
    pendingCents: 12000,
    confirmedPrincipalCents: 18000,
  },
  openComplementPayment: {
    id: "open-unsafe",
    amountCents: 12000,
    status: "pending",
    checkoutUrl: "http://evil.example/checkout",
    createdAt: "2026-09-10T12:00:00Z",
    paidAt: null,
    initiatedByName: "Admin",
    initiatedAs: "admin",
  },
};
const page = { rows: [legacy, pending, paid], total: 3, page: 1, pageSize: 25 };
const summary: AdminRegistrationSummary = {
  total: 14,
  paid: 8,
  pending: 4,
  legacy: 2,
  receivedCents: 20000,
  pendingCents: 50000,
  pendingRegentCents: 40000,
  expectedCents: 70000,
  byChoir: [
    {
      choirName: "Diocese de Quixadá",
      total: 7,
      receivedCents: 20000,
      pendingCents: 50000,
      pendingRegentCents: 40000,
      expectedCents: 70000,
    },
    {
      choirName: "Diocese de Sobral",
      total: 4,
      receivedCents: 0,
      pendingCents: 0,
      pendingRegentCents: 0,
      expectedCents: 0,
    },
    {
      choirName: "Arquidiocese de Fortaleza",
      total: 3,
      receivedCents: 0,
      pendingCents: 0,
      pendingRegentCents: 0,
      expectedCents: 0,
    },
  ],
};

function setup(overrides = {}) {
  const props = {
    checkAdmin: vi
      .fn()
      .mockResolvedValue({ status: "authorized", userId: "admin", email: "admin@example.com" }),
    loadRegistrations: vi.fn().mockResolvedValue(page),
    loadSummary: vi.fn().mockResolvedValue(summary),
    exportRegistrations: vi
      .fn()
      .mockResolvedValue({ fileName: "inscricoes-2026-09-07.csv", content: "\uFEFFNome\r\nAna" }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "token" } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onSignedOut: vi.fn(),
    onMissingSession: vi.fn(),
    ...overrides,
  };
  render(<AdminRegistrationsPage {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("AdminRegistrationsPage read-only views", () => {
  it("does not create a duplicate checkout when an open complement URL is unsafe", async () => {
    setup({
      loadRegistrations: vi.fn().mockResolvedValue({
        rows: [partial],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    await waitFor(() => expect(screen.getAllByText("Daniela Parcial")).toHaveLength(2));
    expect(screen.getAllByText("Pagamento em processamento")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Pagar saldo/ })).not.toBeInTheDocument();
  });

  it("lets an administrator generate a payment link or mark a pending registration as paid", async () => {
    const createPaymentLink = vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.com.br/registration-pending",
      reused: false,
    });
    const markPaid = vi.fn().mockResolvedValue({
      status: "paid",
      registrationId: "pending",
    });
    const copyToClipboard = vi.fn().mockResolvedValue(undefined);
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({
        rows: [pending],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
      createPaymentLink,
      markPaid,
      copyToClipboard,
    });

    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }));
    await user.click(screen.getByRole("menuitem", { name: "Gerar link de pagamento" }));
    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith(
        "https://checkout.infinitepay.com.br/registration-pending",
      ),
    );

    await user.click(within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }));
    await user.click(screen.getByRole("menuitem", { name: "Marcar como pago" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Marcar inscrição como paga");
    await user.upload(
      within(dialog).getByLabelText("Comprovante de pagamento"),
      new File(["%PDF-1.4"], "pix-pendente.pdf", { type: "application/pdf" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() =>
      expect(markPaid).toHaveBeenCalledWith({
        data: {
          registrationId: "pending",
          receipt: {
            base64: "JVBERi0xLjQ=",
            mimeType: "application/pdf",
            fileName: "pix-pendente.pdf",
          },
        },
      }),
    );
    expect(await screen.findByText("Inscrição marcada como paga.")).toBeInTheDocument();
    expect(createPaymentLink).toHaveBeenCalledWith({ data: { registrationId: "pending" } });
  });

  it("lets an administrator exempt a pending participant and confirms all values will be zero", async () => {
    const markExempt = vi.fn().mockResolvedValue({
      status: "exempt",
      registrationId: "pending",
    });
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({
        rows: [pending],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
      markExempt,
    });

    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }));
    await user.click(screen.getByRole("menuitem", { name: "Marcar como isento" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Todos os valores ficarão em R$ 0,00");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar isenção" }));

    await waitFor(() =>
      expect(markExempt).toHaveBeenCalledWith({ data: { registrationId: "pending" } }),
    );
    expect(
      await screen.findByText("Participante marcado como isento. Valores zerados."),
    ).toBeInTheDocument();
  });

  it("approves a free registration without offering payment actions", async () => {
    const freePending: AdminRegistrationRow = {
      ...pending,
      paymentOrigin: "exemption",
      isFreeRegistration: true,
      amountCents: 0,
      pricingType: "standard",
      standardPriceCents: 0,
      registrationPriceCents: 0,
    };
    const markExempt = vi.fn().mockResolvedValue({ status: "exempt", registrationId: "pending" });
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({ rows: [freePending], total: 1, page: 1, pageSize: 25 }),
      markExempt,
    });
    const table = await screen.findByRole("table", { name: "Inscrições" });
    expect(within(table).getAllByText("Aguardando aprovação").length).toBeGreaterThan(0);
    await user.click(within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }));
    expect(screen.queryByRole("menuitem", { name: "Gerar link de pagamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Marcar como pago" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Aprovar como isento" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Aprovar isenção" }));
    await waitFor(() => expect(markExempt).toHaveBeenCalledWith({ data: { registrationId: "pending" } }));
    expect(await screen.findByText("Inscrição aprovada como isenta.")).toBeVisible();
  });

  it("shows an approved registration as exempt using the existing exemption state", async () => {
    const approvedFree: AdminRegistrationRow = {
      ...paid,
      id: "approved-free",
      isFreeRegistration: true,
      paymentOrigin: "exemption",
      amountCents: 0,
      paidAmountCents: 0,
      paidAt: null,
      paymentMethod: null,
      installments: null,
    };
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({ rows: [approvedFree], total: 1, page: 1, pageSize: 25 }),
    });
    const table = await screen.findByRole("table", { name: "Inscrições" });
    expect(within(table).getAllByText("Isento").length).toBeGreaterThan(0);
    expect(within(table).queryByText("Gratuito")).not.toBeInTheDocument();
    await user.click(within(table).getByRole("row", { name: "Ver todos os dados de Clara Paga" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Isenção administrativa")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Isento").length).toBeGreaterThan(0);
  });

  it("requires a receipt and submits its contents with immediate manual payment", async () => {
    const markPaid = vi.fn().mockResolvedValue({
      status: "paid",
      registrationId: "pending",
    });
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({
        rows: [pending],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
      markPaid,
    });

    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }));
    await user.click(screen.getByRole("menuitem", { name: "Marcar como pago" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Confirmar pagamento" });
    expect(confirm).toBeDisabled();

    await user.upload(
      within(dialog).getByLabelText("Comprovante de pagamento"),
      new File(["%PDF-1.4"], "pix-pendente.pdf", { type: "application/pdf" }),
    );
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    await waitFor(() =>
      expect(markPaid).toHaveBeenCalledWith({
        data: {
          registrationId: "pending",
          receipt: {
            base64: "JVBERi0xLjQ=",
            mimeType: "application/pdf",
            fileName: "pix-pendente.pdf",
          },
        },
      }),
    );
  });

  it("opens a server-signed receipt link for manually paid registrations", async () => {
    const getReceiptUrl = vi.fn().mockResolvedValue({
      signedUrl: "https://storage.example/signed/comprovante.pdf",
      expiresIn: 3600,
    });
    const openReceiptUrl = vi.fn();
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({
        rows: [{ ...paid, paymentOrigin: "manual", hasManualReceipt: true }],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
      getReceiptUrl,
      openReceiptUrl,
    });

    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(within(table).getByRole("button", { name: "Mais ações para Clara Paga" }));
    await user.click(screen.getByRole("menuitem", { name: "Ver comprovante" }));

    await waitFor(() =>
      expect(getReceiptUrl).toHaveBeenCalledWith({ data: { registrationId: "paid" } }),
    );
    expect(openReceiptUrl).toHaveBeenCalledWith("https://storage.example/signed/comprovante.pdf");
  });

  it("renders derived states on desktop and mobile and opens the exact server-owned balance", async () => {
    const partialWithoutOpen = {
      ...partial,
      id: "partial-pay",
      name: "Eduarda Parcial",
      openComplementPayment: null,
    } satisfies AdminRegistrationRow;
    const settled = {
      ...paid,
      id: "settled",
      name: "Fernanda Paga",
      financialState: { status: "paid", pendingCents: 0, confirmedPrincipalCents: 30000 },
    } satisfies AdminRegistrationRow;
    const loadRegistrations = vi.fn().mockResolvedValue({
      rows: [partialWithoutOpen, pending, settled],
      total: 3,
      page: 1,
      pageSize: 25,
    });
    const startCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.infinitepay.io/partial-pay",
      orderNsu: "order-1",
    });
    const navigateToCheckout = vi.fn();
    const { user } = setup({ loadRegistrations, startCheckout, navigateToCheckout });
    await screen.findByRole("table");

    for (const view of [
      screen.getByRole("table"),
      screen.getByRole("region", { name: "Cartões de inscrições" }),
    ]) {
      expect(within(view).getByText("Parcialmente pago")).toBeInTheDocument();
      expect(within(view).getAllByText("Pagamento").length).toBeGreaterThan(0);
      expect(within(view).getAllByText(/R\$\s*120,00/).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Pendente taxa de inscrição").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Mais ações para Eduarda Parcial" })[0]);
    await user.click(screen.getByRole("menuitem", { name: /Pagar saldo de R\$\s*120,00/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Eduarda Parcial");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Pagar saldo de R\$\s*120,00/,
      }),
    );
    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith({ data: { registrationId: "partial-pay" } }),
    );
    expect(navigateToCheckout).toHaveBeenCalledWith("https://checkout.infinitepay.io/partial-pay");

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("combobox", { name: "Situação" }));
    await user.click(await screen.findByRole("option", { name: "Parcialmente pagas" }));
    await waitFor(() =>
      expect(loadRegistrations).toHaveBeenLastCalledWith({
        data: { search: "", paymentStatus: "partially_paid", choirId: "all", musicalProfile: "all", page: 1, pageSize: 25 },
      }),
    );
  });

  it("renders the aggregated initial payload without repeating authorization or reads", async () => {
    const checkAdmin = vi.fn();
    const loadRegistrations = vi.fn();
    const loadSummary = vi.fn();
    const loadInitialData = vi.fn().mockResolvedValue({
      access: { status: "authorized", userId: "admin", email: "admin@example.com" },
      data: { registrations: page, summary },
    });

    setup({ checkAdmin, loadRegistrations, loadSummary, loadInitialData });

    expect(await screen.findByText("3 inscrições encontradas")).toBeInTheDocument();
    expect(loadInitialData).toHaveBeenCalledOnce();
    expect(checkAdmin).not.toHaveBeenCalled();
    expect(loadRegistrations).not.toHaveBeenCalled();
    expect(loadSummary).not.toHaveBeenCalled();
  });

  it("keeps financial totals above the filters without repeating the summary breakdown", async () => {
    const { loadSummary, user } = setup();

    const financial = await screen.findByRole("group", { name: "Resumo financeiro" });
    expect(within(financial).getByText("Recebido").parentElement).toHaveTextContent("R$ 200,00");
    expect(within(financial).getByText("Pendente taxa de inscrição").parentElement).toHaveTextContent("R$ 500,00");
    expect(within(financial).getByText("Total previsto").parentElement).toHaveTextContent(
      "R$ 700,00",
    );
    expect(
      screen.queryByRole("region", { name: "Visão geral das inscrições" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Financeiro por coro/diocese")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Pesquisar inscrições"), "Clara");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    await screen.findByRole("table");
    expect(loadSummary).toHaveBeenCalledOnce();
  });

  it("links separately to choir and event-value administration", async () => {
    setup();

    expect(await screen.findByRole("link", { name: "Coros" })).toHaveAttribute(
      "href",
      "/admin/coros",
    );
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/admin/configuracoes",
    );
  });

  it("renders equivalent desktop and mobile records with honest historical payment data", async () => {
    setup();
    expect(await screen.findByText("3 inscrições encontradas")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Inscrições" });
    const cards = screen.getByRole("region", { name: "Cartões de inscrições" });
    for (const view of [table, cards]) {
      const scope = within(view);
      expect(scope.getByText("Histórico")).toBeInTheDocument();
      expect(scope.getByText("Pendente taxa de inscrição")).toBeInTheDocument();
      expect(scope.getByText("Pago")).toBeInTheDocument();
      expect(scope.getByText("Valores não informados")).toBeInTheDocument();
      expect(scope.getByText("Ana Histórica")).toBeInTheDocument();
      expect(scope.getByText("AH")).toBeInTheDocument();
      expect(scope.getByText("CP")).toBeInTheDocument();
      expect(scope.getAllByText("Coralista").length).toBeGreaterThan(0);
      expect(scope.getByText("Regente")).toBeInTheDocument();
      expect(scope.getByText("Instrumentista")).toBeInTheDocument();
      expect(scope.getAllByText("R$ 139,90").length).toBe(1);
      expect(scope.getAllByText("R$ 100,00").length).toBe(1);
      expect(scope.getAllByText("85999990000").length).toBe(3);
      expect(scope.getAllByText("ana@example.com").length).toBe(3);
    }
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Data e hora",
      "Coralista",
      "Função",
      "E-mail",
      "Pagamento",
      "WhatsApp",
      "Coro",
      "Mais",
    ]);
    expect(within(table).getByRole("row", { name: /Ana Histórica/ })).toHaveTextContent(
      "01/09/2026 09:00",
    );
    expect(table.parentElement?.parentElement).toHaveClass("hidden", "md:block");
    expect(cards).toHaveClass("md:hidden");
    const historical = within(table).getByRole("row", { name: /Ana Histórica/ });
    expect(historical).not.toHaveTextContent(/R\$|Pix|Cartão/);
    expect(
      screen.getByText("3 inscrições encontradas").closest('[aria-live="polite"]'),
    ).toBeInTheDocument();
  });

  it("opens a read-only modal with all participant data from row click and keyboard", async () => {
    const { user } = setup();
    const table = await screen.findByRole("table", { name: "Inscrições" });
    const row = within(table).getByRole("row", { name: "Ver todos os dados de Ana Histórica" });

    await user.click(row);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Ana Histórica" })).toBeInTheDocument();
    expect(within(dialog).getByText("Dados pessoais")).toBeInTheDocument();
    expect(within(dialog).getByText("Participação e coro")).toBeInTheDocument();
    expect(within(dialog).getByText("Financeiro")).toBeInTheDocument();
    expect(within(dialog).getByText("Dados da inscrição")).toBeInTheDocument();
    expect(within(dialog).getByText("Ana")).toBeInTheDocument();
    expect(within(dialog).getByText("02/01/1990")).toBeInTheDocument();
    expect(within(dialog).getByText("Soprano")).toBeInTheDocument();
    expect(within(dialog).getByText("Participante da edição anterior.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    row.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("warns about a paid superseded checkout and exposes only its safe receipt link", async () => {
    const reviewed = {
      ...paid,
      supersededCheckoutReview: {
        orderNsu: "old-order",
        amountCents: 10000,
        paidAmountCents: 10000,
        paymentMethod: "pix" as const,
        installments: 1,
        paidAt: "2026-09-19T15:00:00Z",
        transactionNsu: "transaction-1",
        receiptUrl: "https://receipt.infinitepay.io/late",
      },
    } satisfies AdminRegistrationRow;
    const { user } = setup({
      loadRegistrations: vi.fn().mockResolvedValue({ ...page, rows: [reviewed], total: 1 }),
    });
    const table = await screen.findByRole("table", { name: "Inscrições" });

    await user.click(within(table).getByRole("row", { name: "Ver todos os dados de Clara Paga" }));

    const alert = within(screen.getByRole("dialog")).getByRole("alert");
    expect(alert).toHaveTextContent("Pagamento de checkout substituído");
    expect(alert).toHaveTextContent(/R\$\s*100,00/);
    expect(alert).toHaveTextContent("Pix");
    expect(alert).toHaveTextContent("transaction-1");
    expect(alert).toHaveTextContent(
      "Revisão administrativa necessária; a inscrição atual não foi confirmada automaticamente.",
    );
    expect(within(alert).getByRole("link", { name: "Ver comprovante" })).toHaveAttribute(
      "href",
      "https://receipt.infinitepay.io/late",
    );
  });

  it("keeps the row details modal separate from the More actions menu", async () => {
    const { user } = setup();
    const table = await screen.findByRole("table", { name: "Inscrições" });

    await user.click(within(table).getByRole("button", { name: "Mais ações para Ana Histórica" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a useful empty state", async () => {
    setup({ loadRegistrations: vi.fn().mockResolvedValue({ ...page, rows: [], total: 0 }) });
    expect(await screen.findByText("Nenhuma inscrição encontrada.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("AdminRegistrationsPage access and interactions", () => {
  it("shows only server-authorized participant recovery actions and refreshes the current list", async () => {
    const paidPending = {
      ...paid,
      participantAccess: {
        label: "Aguardando criação" as const,
        canReprocess: true,
        canReset: false,
      },
    };
    const loadRegistrations = vi
      .fn()
      .mockResolvedValue({ ...page, rows: [legacy, paidPending], total: 2 });
    const reprocessAccess = vi.fn().mockResolvedValue({ status: "active" });
    const { user } = setup({ loadRegistrations, reprocessAccess });

    await screen.findByRole("table");
    expect(screen.queryByText("Aguardando criação")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Mais ações para Clara Paga" })[0]);
    expect(
      screen.queryByRole("menuitem", { name: "Redefinir senha inicial" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Reprocessar acesso" }));
    await waitFor(() =>
      expect(reprocessAccess).toHaveBeenCalledWith({
        data: { registrationId: "paid" },
      }),
    );
    await waitFor(() => expect(loadRegistrations).toHaveBeenCalledTimes(2));
  });

  it("requires reset confirmation and discloses that existing sessions stay open", async () => {
    const resetInitialPassword = vi
      .fn()
      .mockResolvedValue({ status: "success", sessionsRevoked: false });
    const { user } = setup({ resetInitialPassword });
    await screen.findByRole("table");

    await user.click(screen.getAllByRole("button", { name: "Mais ações para Clara Paga" })[0]);
    await user.click(screen.getByRole("menuitem", { name: "Redefinir senha inicial" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar redefinição" }));
    await waitFor(() => expect(resetInitialPassword).toHaveBeenCalled());
    expect(
      screen.getByText("Senha redefinida. Sessões que já estavam abertas não foram encerradas."),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/senha inicial:|\\d{11}/i);
  });

  it("waits for server authorization before the first list request", async () => {
    let resolve!: (value: { status: "authorized"; userId: string; email: null }) => void;
    const checkAdmin = vi.fn(
      () =>
        new Promise<{ status: "authorized"; userId: string; email: null }>((done) => {
          resolve = done;
        }),
    );
    const { loadRegistrations } = setup({ checkAdmin });
    expect(screen.getByText("Verificando acesso…")).toBeInTheDocument();
    expect(loadRegistrations).not.toHaveBeenCalled();
    await act(async () => resolve({ status: "authorized", userId: "admin", email: null }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(loadRegistrations).toHaveBeenCalledOnce();
  });

  it("denies nonmembers without loading registrations", async () => {
    const { loadRegistrations, user, signOut, onSignedOut } = setup({
      checkAdmin: vi.fn().mockResolvedValue({ status: "forbidden" }),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Acesso não autorizado.");
    expect(loadRegistrations).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Exportar CSV" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("redirects a missing session only after the access check fails", async () => {
    const { onMissingSession, loadRegistrations } = setup({
      checkAdmin: vi.fn().mockRejectedValue(new Error("secret")),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    });
    await waitFor(() => expect(onMissingSession).toHaveBeenCalledOnce());
    expect(screen.getByText("Sessão expirada. Redirecionando para entrar…")).toBeInTheDocument();
    expect(loadRegistrations).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("secret");
  });

  it("keeps a present local session unauthorized and allows an access retry", async () => {
    const checkAdmin = vi
      .fn()
      .mockRejectedValueOnce(new Error("secret"))
      .mockResolvedValue({ status: "authorized", userId: "admin", email: null });
    const { onMissingSession, loadRegistrations, user } = setup({ checkAdmin });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível verificar seu acesso. Tente novamente.",
    );
    expect(loadRegistrations).not.toHaveBeenCalled();
    expect(onMissingSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(checkAdmin).toHaveBeenCalledTimes(2);
  });

  it("keeps session-read failures retryable without granting access or redirecting", async () => {
    const { loadRegistrations, onMissingSession } = setup({
      checkAdmin: vi.fn().mockRejectedValue(new Error("network")),
      getSession: vi.fn().mockRejectedValue(new Error("storage")),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível verificar seu acesso.",
    );
    expect(loadRegistrations).not.toHaveBeenCalled();
    expect(onMissingSession).not.toHaveBeenCalled();
  });

  it("resets pages for search and status, retains filters during pagination, and keeps search out of the URL", async () => {
    const loadRegistrations = vi
      .fn()
      .mockImplementation(async ({ data }) => ({ ...page, total: 60, page: data.page }));
    const { user } = setup({ loadRegistrations });
    await screen.findByText("60 inscrições encontradas");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pesquisar inscrições"), "  Clara  ");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    await waitFor(() =>
      expect(loadRegistrations).toHaveBeenLastCalledWith({
        data: { search: "Clara", paymentStatus: "all", choirId: "all", musicalProfile: "all", page: 1, pageSize: 25 },
      }),
    );
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Página 2 de 3");
    screen.getByRole("combobox", { name: "Situação" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.click(await screen.findByRole("option", { name: "Pagas" }));
    await waitFor(() =>
      expect(loadRegistrations).toHaveBeenLastCalledWith({
        data: { search: "Clara", paymentStatus: "paid", choirId: "all", musicalProfile: "all", page: 1, pageSize: 25 },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Página 2 de 3");
    expect(loadRegistrations).toHaveBeenLastCalledWith({
      data: { search: "Clara", paymentStatus: "paid", choirId: "all", musicalProfile: "all", page: 2, pageSize: 25 },
    });
    expect(window.location.href).not.toContain("Clara");
  }, 15000);

  it("exports server CSV with active filters and releases the temporary download", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:test-download");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const clicks: { href: string; download: string; connected: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download, connected: this.isConnected });
    });
    const { user, exportRegistrations } = setup();
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Pesquisar inscrições"), " Ana ");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(exportRegistrations).toHaveBeenCalledWith({
      data: { search: "Ana", paymentStatus: "all", choirId: "all", musicalProfile: "all" },
    });
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const content = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(content).toBe("Nome\r\nAna");
    expect(clicks).toEqual([
      { href: "blob:test-download", download: "inscricoes-2026-09-07.csv", connected: true },
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-download");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(screen.getByText("CSV exportado.")).toBeInTheDocument();
  });

  it("blocks duplicate exports while pending and reports export errors generically", async () => {
    let reject!: (error: Error) => void;
    const exportRegistrations = vi.fn(
      () =>
        new Promise<never>((_, fail) => {
          reject = fail;
        }),
    );
    const { user } = setup({ exportRegistrations });
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(screen.getByRole("button", { name: "Exportando…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Exportando…" }));
    expect(exportRegistrations).toHaveBeenCalledOnce();
    await act(async () => reject(new Error("secret")));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível exportar. Tente novamente.",
    );
    expect(document.body).not.toHaveTextContent("secret");
  });

  it("shows loading and a retryable list error without leaking server details", async () => {
    let reject!: (error: Error) => void;
    const loadRegistrations = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<never>((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(page);
    const { user } = setup({ loadRegistrations });
    expect(await screen.findByText("Carregando inscrições…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pesquisar" })).toBeDisabled();
    await act(async () => reject(new Error("secret")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as inscrições. Tente novamente.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("secret");
  });

  it("clears records on logout and navigates after successful sign out", async () => {
    const { user, signOut, onSignedOut } = setup();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Histórica")).not.toBeInTheDocument();
  });
});

describe("AdminRegistrationsPage edit registration", () => {
  const choirOption = {
    id: "choir-1",
    name: "Coro Diocesano de Quixadá",
    diocese: null,
    pricingType: "standard" as const,
    standardPriceCents: 30000,
    registrationPriceCents: 30000,
  };

  it("opens a prefilled edit dialog from the actions menu and saves changes", async () => {
    const updateRegistration = vi
      .fn()
      .mockResolvedValue({ status: "updated", registrationId: "pending" });
    const loadChoirs = vi.fn().mockResolvedValue({ choirs: [choirOption] });
    const { user } = setup({ updateRegistration, loadChoirs });
    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(
      within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Editar dados/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nome completo")).toHaveValue("Bruno Pendente");
    expect(within(dialog).getByLabelText("E-mail")).toHaveValue("ana@example.com");
    await user.clear(within(dialog).getByLabelText("Nome completo"));
    await user.type(within(dialog).getByLabelText("Nome completo"), "Bruno Corrigido");
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateRegistration).toHaveBeenCalledOnce());
    expect(updateRegistration.mock.calls[0][0].data).toMatchObject({
      registrationId: "pending",
      name: "Bruno Corrigido",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows the error when saving fails", async () => {
    const updateRegistration = vi
      .fn()
      .mockRejectedValue(new Error("Já existe uma conta com esse e-mail."));
    const { user } = setup({
      updateRegistration,
      loadChoirs: vi.fn().mockResolvedValue({ choirs: [choirOption] }),
    });
    const table = await screen.findByRole("table", { name: "Inscrições" });
    await user.click(
      within(table).getByRole("button", { name: "Mais ações para Bruno Pendente" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Editar dados/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Já existe uma conta com esse e-mail.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
