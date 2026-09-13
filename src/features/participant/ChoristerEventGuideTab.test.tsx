import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/event-activity.functions", () => ({
  getParticipantEventActivities: vi.fn().mockResolvedValue([]),
}));

import type { ChoristerPortalCollection } from "@/features/chorister-app/choristerApp.domain";

import { ChoristerEventGuideTab } from "./ChoristerEventGuideTab";
import { getParticipantEventActivities } from "@/lib/event-activity.functions";

const events: ChoristerPortalCollection["events"] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Grande Concerto",
    date: "2026-11-21",
    location: "Quixadá - CE",
    coverImageUrl: null,
    songs: [],
    documents: [],
    guide: { notes: "Chegue com antecedência." },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Solenidade de Cristo Rei",
    date: "2026-11-22",
    location: "Catedral Jesus, Maria e José",
    coverImageUrl: null,
    songs: [],
    documents: [],
  },
];

describe("ChoristerEventGuideTab", () => {
  it("loads the real configurable programme by default", async () => {
    render(<ChoristerEventGuideTab events={events} />);
    await screen.findByText("Nenhuma atividade publicada para este dia.");
    expect(getParticipantEventActivities).toHaveBeenCalled();
  });

  it("does not use CoroApp events as programme entries while the CRUD is loading", async () => {
    render(<ChoristerEventGuideTab events={events} loadActivities={() => new Promise(() => {})} />);

    expect(screen.queryByText("Grande Concerto")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Atualizando programação");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("keeps the official guide notes compact without rendering CoroApp event cards", async () => {
    render(
      <ChoristerEventGuideTab events={events} loadActivities={vi.fn().mockResolvedValue([])} />,
    );

    expect(screen.getByRole("heading", { name: "Guia do evento" })).toBeInTheDocument();
    expect(screen.getByText("Chegue com antecedência.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Grande Concerto" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Solenidade de Cristo Rei" }),
    ).not.toBeInTheDocument();
  });

  it("shows a compact three-day agenda and only offers QR attendance when required", async () => {
    const user = userEvent.setup();
    render(
      <ChoristerEventGuideTab
        events={events}
        loadActivities={vi.fn().mockResolvedValue([
          {
            id: "31111111-1111-4111-8111-111111111111",
            title: "Credenciamento",
            activityDate: "2026-11-20",
            startsAt: "16:00",
            endsAt: "18:00",
            location: "Centro Pastoral",
            description: "Entrega do material",
            sortOrder: 10,
            requiresQr: false,
          },
          {
            id: "32222222-2222-4222-8222-222222222222",
            title: "2ª Conferência",
            activityDate: "2026-11-21",
            startsAt: "19:30",
            endsAt: "21:30",
            location: "Praça da Catedral",
            description: null,
            sortOrder: 20,
            requiresQr: true,
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            title: "Missa de encerramento",
            activityDate: "2026-11-22",
            startsAt: null,
            endsAt: null,
            location: "Catedral",
            description: null,
            sortOrder: 30,
            requiresQr: false,
          },
        ])}
      />,
    );

    expect(await screen.findByRole("tab", { name: /20 de novembro/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /21 de novembro/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /22 de novembro/i })).toBeInTheDocument();
    const firstDay = screen.getByRole("tab", { name: /20 de novembro/i });
    firstDay.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /21 de novembro/i })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /21 de novembro/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(firstDay);
    expect(screen.getByText("Credenciamento")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /registrar presença/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /21 de novembro/i }));

    expect(screen.queryByText("Grande Concerto")).not.toBeInTheDocument();
    expect(screen.getByText("Chegue com antecedência.")).toBeInTheDocument();
    expect(screen.getByText("2ª Conferência")).toBeInTheDocument();
    const attendanceAction = screen.getByRole("link", {
      name: "Registrar presença em 2ª Conferência",
    });
    expect(attendanceAction).toHaveAttribute("href", "/participante/presenca");
    expect(attendanceAction).toHaveClass("min-h-11");
    expect(screen.queryByText("Credenciamento")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /22 de novembro/i }));
    expect(screen.getByText("Missa de encerramento")).toBeInTheDocument();
    expect(screen.queryByText("Solenidade de Cristo Rei")).not.toBeInTheDocument();
    expect(screen.getAllByText("Na sequência")).not.toHaveLength(0);
  });

  it("derives programme days from CRUD activities without restricting their dates", async () => {
    const user = userEvent.setup();
    render(
      <ChoristerEventGuideTab
        events={events}
        loadActivities={vi.fn().mockResolvedValue([
          {
            id: "34444444-4444-4444-8444-444444444444",
            title: "Ensaio extraordinário",
            activityDate: "2027-01-03",
            startsAt: "09:00",
            endsAt: "10:30",
            location: "Auditório",
            description: null,
            sortOrder: 1,
            requiresQr: false,
          },
          {
            id: "35555555-5555-4555-8555-555555555555",
            title: "Recepção complementar",
            activityDate: "2027-01-04",
            startsAt: "08:00",
            endsAt: null,
            location: null,
            description: null,
            sortOrder: 1,
            requiresQr: false,
          },
        ])}
      />,
    );

    expect(await screen.findByRole("tab", { name: /3 de janeiro, domingo/i })).toBeInTheDocument();
    expect(screen.getByText("Ensaio extraordinário")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /4 de janeiro, segunda/i }));
    expect(screen.getByText("Recepção complementar")).toBeInTheDocument();
    expect(screen.queryByText("Ensaio extraordinário")).not.toBeInTheDocument();
  });

  it("reports an unavailable CRUD without falling back to CoroApp events", async () => {
    render(
      <ChoristerEventGuideTab
        events={events}
        loadActivities={vi.fn().mockRejectedValue(new Error("unavailable"))}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a programação agora",
    );
    expect(screen.queryByText("Grande Concerto")).not.toBeInTheDocument();
  });
});
