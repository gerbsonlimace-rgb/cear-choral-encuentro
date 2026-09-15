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
  reprocessParticipantAccess: vi.fn(),
  resetParticipantInitialPassword: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

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
  cpf: "529.982.247-25",
  choirName: "Diocese de Quixadá",
  email: "ana@example.com",
  phone: "85999990000",
  city: "Quixadá",
  institution: null,
  role: "Coralista",
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
};
const pending: AdminRegistrationRow = {
  ...legacy,
  id: "pending",
  name: "Bruno Pendente",
  paymentStatus: "pending",
  amountCents: 10000,
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
  expectedCents: 110000,
  byChoir: [
    {
      choirName: "Diocese de Quixadá",
      total: 7,
      receivedCents: 20000,
      pendingCents: 50000,
      pendingRegentCents: 40000,
      expectedCents: 110000,
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
    await user.click(within(table).getByRole("button", { name: "Gerar link de pagamento" }));
    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith(
        "https://checkout.infinitepay.com.br/registration-pending",
      ),
    );

    await user.click(within(table).getByRole("button", { name: "Marcar como pago" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Marcar inscrição como paga");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar pagamento" }),
    );
    await waitFor(() =>
      expect(markPaid).toHaveBeenCalledWith({ data: { registrationId: "pending" } }),
    );
    expect(await screen.findByText("Inscrição marcada como paga.")).toBeInTheDocument();
    expect(createPaymentLink).toHaveBeenCalledWith({ data: { registrationId: "pending" } });
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
      expect(within(view).getAllByText("Valor pendente").length).toBeGreaterThan(0);
      expect(within(view).getAllByText(/R\$\s*120,00/).length).toBeGreaterThan(0);
      expect(
        within(view).getByRole("button", { name: /Pagar saldo de R\$\s*120,00/ }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: /Pagar saldo de R\$\s*120,00/ })[0]);
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
        data: { search: "", paymentStatus: "partially_paid", page: 1, pageSize: 25 },
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
    expect(within(financial).getByText("Pendente").parentElement).toHaveTextContent("R$ 500,00");
    expect(within(financial).getByText("Total previsto").parentElement).toHaveTextContent(
      "R$ 1.100,00",
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
      expect(scope.getByText("Pendente")).toBeInTheDocument();
      expect(scope.getByText("Pago")).toBeInTheDocument();
      expect(scope.getAllByText("Não informado").length).toBeGreaterThan(0);
      expect(scope.getByText("Ana Histórica")).toBeInTheDocument();
      expect(scope.getByText("AH")).toBeInTheDocument();
      expect(scope.getByText("CP")).toBeInTheDocument();
      expect(scope.getAllByText("R$ 139,90").length).toBe(1);
      expect(scope.getAllByText("R$ 100,00").length).toBe(1);
      expect(scope.getAllByText("85999990000").length).toBe(3);
      expect(scope.getAllByText("Regente").length).toBeGreaterThan(0);
    }
    expect(table.parentElement?.parentElement).toHaveClass("hidden", "md:block");
    expect(cards).toHaveClass("md:hidden");
    const historical = within(table).getByRole("row", { name: /Ana Histórica/ });
    expect(historical).not.toHaveTextContent(/R\$|Pix|Cartão/);
    expect(
      screen.getByText("3 inscrições encontradas").closest('[aria-live="polite"]'),
    ).toBeInTheDocument();
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

    expect(await screen.findAllByText("Aguardando criação")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reprocessar acesso" })).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Redefinir senha inicial" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Reprocessar acesso" })[0]);
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

    await user.click(screen.getAllByRole("button", { name: "Redefinir senha inicial" })[0]);
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
        data: { search: "Clara", paymentStatus: "all", page: 1, pageSize: 25 },
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
        data: { search: "Clara", paymentStatus: "paid", page: 1, pageSize: 25 },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Página 2 de 3");
    expect(loadRegistrations).toHaveBeenLastCalledWith({
      data: { search: "Clara", paymentStatus: "paid", page: 2, pageSize: 25 },
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
      data: { search: "Ana", paymentStatus: "all" },
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
