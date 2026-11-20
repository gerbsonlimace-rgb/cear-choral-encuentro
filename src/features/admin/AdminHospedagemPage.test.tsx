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
  it("releases a cancelled occupant before allocating a replacement", async () => {
    const persistPlan = vi.fn().mockResolvedValue(undefined);
    const plan: LodgingPlan = {
      ...emptyLodgingPlan(),
      namedRooms: [
        { key: "CP17", name: "CP17", location: "Centro Pastoral", floor: "", notes: "" },
      ],
      assignments: { "no-1": "CP17", "no-2": "CP17", "no-3": "CP17" },
    };
    const data = bootstrap(plan);
    data.data!.registrations = registrations.map((row) =>
      row.id === "no-1" ? { ...row, cancelledAt: "2026-11-20T00:00:00Z" } : row,
    );
    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => data}
        persistPlan={persistPlan}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Quarto de Com quarto"), {
      target: { value: "CP17" },
    });
    await waitFor(() =>
      expect(persistPlan).toHaveBeenCalledWith({
        ...plan,
        assignments: { "no-2": "CP17", "no-3": "CP17", lodging: "CP17" },
      }),
    );
  });

  it("loads named rooms without replacing their assignments and flags every R$ 80 registration", async () => {
    const persistPlan = vi.fn().mockResolvedValue(undefined);
    const plan: LodgingPlan = {
      ...emptyLodgingPlan(),
      namedRooms: [
        {
          key: "CP17",
          name: "CP17",
          location: "Centro Pastoral",
          floor: "Térreo",
          notes: "Reserva do mapa",
        },
      ],
      assignments: { "no-1": "CP17", "no-2": "CP17", "no-3": "CP17" },
    };
    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => bootstrap(plan)}
        persistPlan={persistPlan}
      />,
    );
    const room = await screen.findByRole("region", { name: "Quarto CP17" });
    expect(within(room).getByText("Sem quarto 1 *")).toBeInTheDocument();
    expect(screen.getByText("* Não solicitou inscrição com quarto")).toBeInTheDocument();
    expect(screen.queryByText("Capacidade e disponibilidade")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Quarto de Com quarto"), { target: { value: "CP17" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("CP17 comporta até 3 pessoas");
    await new Promise((resolve) => setTimeout(resolve, 1400));
    expect(persistPlan).not.toHaveBeenCalled();
  });

  it("persists a physical room change while preserving the rest of the map", async () => {
    const persistPlan = vi.fn().mockResolvedValue(undefined);
    const plan: LodgingPlan = {
      ...emptyLodgingPlan(),
      namedRooms: [{ key: "SEM06", name: "SEM06", location: "Seminário", floor: "", notes: "" }],
      noLodgingIds: ["no-1", "no-2", "no-3"],
    };
    render(
      <AdminHospedagemPage
        onSignedOut={vi.fn()}
        onMissingSession={vi.fn()}
        loadInitialData={async () => bootstrap(plan)}
        persistPlan={persistPlan}
      />,
    );
    fireEvent.change(await screen.findByLabelText("Quarto de Com quarto"), {
      target: { value: "SEM06" },
    });
    await waitFor(() =>
      expect(persistPlan).toHaveBeenCalledWith({ ...plan, assignments: { lodging: "SEM06" } }),
    );
    expect(
      within(screen.getByRole("region", { name: "Quarto SEM06" })).getByText("Com quarto"),
    ).toBeInTheDocument();
  });

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

    await waitFor(() => expect(persistPlan).toHaveBeenCalled(), { timeout: 5000 });
    const saved = persistPlan.mock.calls[0][0] as LodgingPlan;
    expect(Object.values(saved.assignments)).toEqual([lodgingRoomKey("Coro Teste", 0)]);
  });
});
