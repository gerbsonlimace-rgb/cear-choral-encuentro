import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegentParticipantList } from "./RegentParticipantList";
import type { PortalParticipant } from "./regent-payments.domain";

const row: PortalParticipant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Maria Silva",
  cpf: "12345678901",
  phone: "889999991234",
  whatsappUrl: "https://wa.me/55889999991234",
  photoUrl: null,
  paymentStatus: "paid",
  pricingType: "promotional",
  standardPriceCents: 30000,
  registrationPriceCents: 20000,
  complement: { eligible: true, totalCents: 10000, paidCents: 0, balanceCents: 10000 },
  payments: [],
};

describe("RegentParticipantList", () => {
  it("shows formatted CPF, WhatsApp, fallback and payment action", () => {
    render(<RegentParticipantList rows={[row]} onPay={vi.fn()} />);
    expect(screen.getAllByText("123.456.789-01").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /WhatsApp/i })[0]).toHaveAttribute(
      "href",
      row.whatsappUrl,
    );
    expect(screen.getAllByRole("button", { name: "Pagar complemento" }).length).toBeGreaterThan(0);
  });
});
