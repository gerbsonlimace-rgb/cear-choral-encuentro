import type { ReactNode } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PaymentLookup } from "@/features/registration/registration.domain";
import { ComplementPaymentConfirmationPage } from "./ComplementPaymentConfirmationPage";

const lookup: PaymentLookup = {
  orderNsu: "11111111-1111-4111-8111-111111111111",
  transactionNsu: "transaction-123",
  slug: "invoice-123",
};

beforeAll(() => {
  window.scrollTo = vi.fn();
});

async function renderWithRouter(page: ReactNode) {
  const rootRoute = createRootRoute({ component: Outlet });
  const confirmationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/confirmacao",
    component: () => page,
  });
  const regentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/regente",
    component: () => <h1>Área do regente</h1>,
  });
  const adminRegistrationsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/inscricoes",
    component: () => <h1>Inscrições</h1>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([confirmationRoute, regentRoute, adminRegistrationsRoute]),
    history: createMemoryHistory({ initialEntries: ["/confirmacao"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("ComplementPaymentConfirmationPage", () => {
  it("shows a confirmed complement and a safe return to the regent portal", async () => {
    await renderWithRouter(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={vi.fn().mockResolvedValue({
          status: "paid",
          paymentMethod: "pix",
          installments: 1,
        })}
      />,
    );

    expect(await screen.findByText("Complemento confirmado")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar à área do regente" })).toHaveAttribute(
      "href",
      "/regente",
    );
  });

  it("uses the supplied administrator return destination and label", async () => {
    await renderWithRouter(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        returnTo="/admin/inscricoes"
        returnLabel="Voltar às inscrições"
        verifyPayment={vi.fn().mockResolvedValue({
          status: "paid",
          paymentMethod: "pix",
          installments: 1,
        })}
      />,
    );

    expect(await screen.findByText("Complemento confirmado")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar às inscrições" })).toHaveAttribute(
      "href",
      "/admin/inscricoes",
    );
  });

  it("shows processing while verification is in flight", async () => {
    await renderWithRouter(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={async () => await new Promise<never>(() => undefined)}
      />,
    );

    expect(screen.getByText("Confirmando pagamento…")).toBeVisible();
  });

  it("offers a retry after a payment remains unconfirmed", async () => {
    vi.useFakeTimers();
    const verifyPayment = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({ status: "pending" as const })
      .mockResolvedValueOnce({
        status: "paid" as const,
        paymentMethod: "pix" as const,
        installments: 1,
      });

    try {
      await renderWithRouter(
        <ComplementPaymentConfirmationPage
          lookup={lookup}
          verifyPayment={verifyPayment}
          retryDelayMs={10}
        />,
      );
      await vi.advanceTimersByTimeAsync(25);

      expect(screen.getByText("Pagamento complementar ainda não confirmado")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
      await vi.advanceTimersByTimeAsync(0);
      expect(screen.getByText("Complemento confirmado")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a non-confirmed state when verification fails", async () => {
    await renderWithRouter(
      <ComplementPaymentConfirmationPage
        lookup={lookup}
        verifyPayment={vi.fn().mockRejectedValue(new Error("provider unavailable"))}
      />,
    );

    expect(await screen.findByText("Não foi possível verificar agora")).toBeVisible();
  });
});
