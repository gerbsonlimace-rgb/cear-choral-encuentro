import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComplementPaymentConfirmationPage } from "./ComplementPaymentConfirmationPage";

vi.mock("@/lib/regent.functions", () => ({ verifyComplementPayment: vi.fn() }));
const lookup = {
  orderNsu: "33333333-3333-4333-8333-333333333333",
  transactionNsu: "tx-1",
  slug: "invoice-1",
};

describe("ComplementPaymentConfirmationPage", () => {
  it.each([
    ["paid", "Pagamento confirmado"],
    ["pending", "Pagamento não confirmado"],
  ])("renders the %s state", async (status, title) => {
    const verifyPayment = vi.fn().mockResolvedValue({ status });
    render(<ComplementPaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: title })).toBeInTheDocument());
  });

  it("renders processing and retry after a failed verification", async () => {
    const verifyPayment = vi.fn().mockRejectedValue(new Error("temporary"));
    render(<ComplementPaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);
    expect(screen.getByRole("heading", { name: "Processando pagamento…" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Não foi possível verificar agora" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Verificar novamente" })).toBeInTheDocument();
  });
});
