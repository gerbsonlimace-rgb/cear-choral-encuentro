import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminHospedagemBootstrap } from "@/lib/admin.functions";
import type { AdminRegistrationRow } from "./admin.domain";
import { AdminHospedagemPage } from "./AdminHospedagemPage";
import { emptyLodgingPlan, lodgingRoomKey, type LodgingPlan } from "./admin-lodging.domain";

vi.mock("@/lib/admin.functions", () => ({
  getAdminAccess: vi.fn(),
  getAdminRegistrationPhotos: vi.fn().mockResolvedValue({}),
  saveAdminLodgingPlan: vi.fn().mockResolvedValue({ status: "saved" }),
  uploadAdminLodgingPhoto: vi.fn().mockResolvedValue({ path: "extra/1.jpg" }),
}));

const registrations = [
  { id: "no-1", name: "Sem quarto 1", registrationPriceCents: 8000 },
  { id: "no-2", name: "Sem quarto 2", registrationPriceCents: 8000 },
  { id: "no-3", name: "Sem quarto 3", registrationPriceCents: 8000 },
  { id: "lodging", name: "Com quarto", registrationPriceCents: 30000 },
].map((row): AdminRegistrationRow => ({
  ...row,
  badgeName: null,
  choirName: "Coro Teste",
  voicePart: "tenor",
  createdAt: "2026-11-01T10:00:00Z",
  cpf: "000.000.000-00",
  birthDate: "1990-01-01",
  diocese: "Diocese do Teste",
  email: "participante@example.com",
  phone: "(00) 0000-0000",
  city: "Cidade do Teste",
  institution: "Instituição do Teste",
  role: "vocês",
  observations: null,
  includeShirt: false,
  shirtSize: "M",
  otherChoirName: null,
  shirtPriceCents: null,
  paymentStatus: "pending",
  amountCents: null,
  paidAmountCents: null,
  paidAt: null,
  paymentMethod: null,
  installments: null,
  pricingType: "standard",
  standardPriceCents: null,
  photoUrl: null,
  regentName: null,
}));

function bootstrap(plan?: LodgingPlan): AdminHospedagemBootstrap {
  return {
    access: { status: "authorized", userId: "admin", email: null },
    data: { registrations, plan: plan ?? emptyLodgingPlan(), extraPhotoUrls: {} },
  };
}

describe("admin lodging allocation", () => {
  it("separates R$ 80 registrations and lets an eligible participant opt out and back into lodging", async () => {
    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => bootstrap()}
      />,
    );

    const choir = await screen.findByRole("button", { name: /Coro Teste/ });
    expect(choir).toHaveTextContent("Total: 4 · Homens: 1 · Mulheres: 0 · Quartos: 1");
    fireEvent.click(choir);

    const noLodging = screen.getByText("Inscrição sem hospedagem").parentElement!;
    expect(within(noLodging).getByText("Sem quarto 1")).toBeInTheDocument();
    expect(within(noLodging).getByText("Sem quarto 2")).toBeInTheDocument();
    expect(within(noLodging).getByText("Sem quarto 3")).toBeInTheDocument();
    expect(within(noLodging).queryByText("Com quarto")).not.toBeInTheDocument();

    fireEvent.drop(screen.getByRole("region", { name: "Inscrições sem hospedagem" }), {
      dataTransfer: { getData: () => "lodging" },
    });
    expect(within(noLodging).getByText("Com quarto")).toBeInTheDocument();
    expect(choir).toHaveTextContent("Homens: 0 · Mulheres: 0 · Quartos: 0");

    fireEvent.drop(screen.getByRole("region", { name: "Inscritos não alocados" }), {
      dataTransfer: { getData: () => "lodging" },
    });
    expect(within(noLodging).queryByText("Com quarto")).not.toBeInTheDocument();
    expect(choir).toHaveTextContent("Homens: 1 · Mulheres: 0 · Quartos: 1");
  });

  it("restores the saved allocation when the screen is opened again", async () => {
    const plan: LodgingPlan = {
      ...emptyLodgingPlan(),
      roomCapacity: 3,
      roomsAvailable: 12,
      assignments: { lodging: lodgingRoomKey("Coro Teste", 0) },
    };

    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => bootstrap(plan)}
      />,
    );

    const choir = await screen.findByRole("button", { name: /Coro Teste/ });
    fireEvent.click(choir);

    const room = screen.getByText(/TESTE-01/).parentElement!.parentElement!;
    expect(within(room).getByText("Com quarto")).toBeInTheDocument();
    expect(screen.getByLabelText("Capacidade por quarto")).toHaveValue("3");
    expect(screen.getByLabelText("Quartos disponíveis")).toHaveValue("12");
    expect(choir).toBeInTheDocument();
  });

  it("stores the allocation on the server so leaving the screen keeps the rooms", async () => {
    const persistPlan = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => bootstrap()}
        persistPlan={persistPlan}
      />,
    );

    const choir = await screen.findByRole("button", { name: /Coro Teste/ });
    fireEvent.click(choir);

    fireEvent.drop(screen.getByRole("region", { name: "Inscritos não alocados" }), {
      dataTransfer: { getData: () => "lodging" },
    });

    await waitFor(
      () => expect(persistPlan).toHaveBeenCalled(),
      { timeout: 5000 },
    );
    const saved = persistPlan.mock.calls[0][0] as LodgingPlan;
    expect(Object.values(saved.assignments)).toEqual([lodgingRoomKey("Coro Teste", 0)]);
  });
});
