import type { ComponentProps } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a href={to} {...props} />,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoristerNotices } from "./ChoristerNotices";
import { ChoristerHomeTab } from "./ChoristerHomeTab";
import type { MaskedCpf } from "./participant.domain";

const notice = {
  id: "notice-1",
  eventId: "event-1",
  eventName: "Grande Concerto",
  title: "Ensaio geral",
  body: "Chegue às 18h.\nLeve sua partitura.",
  isPublished: true,
  createdAt: "2026-09-13T12:00:00.000Z",
  updatedAt: "2026-09-13T12:00:00.000Z",
};

describe("ChoristerNotices", () => {
  it("shows the notices section inside the participant home", async () => {
    render(
      <ChoristerHomeTab
        participant={{
          identity: {
            name: "Maria da Silva",
            cpf: "***.***.***-25" as MaskedCpf,
            birthDate: "1990-01-15",
          },
          registration: { choirName: "Coral Santa Cecília", diocese: "Quixadá" },
          payment: { status: "paid" },
        }}
        loadNotices={async () => [notice]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Maria da Silva" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ensaio geral" })).toBeInTheDocument();
  });

  it("keeps the newest notices first and makes older notices accessible", async () => {
    const user = userEvent.setup();
    render(
      <ChoristerNotices
        loadNotices={async () => [
          { ...notice, id: "oldest", title: "Aviso antigo", createdAt: "2026-09-01T12:00:00.000Z" },
          notice,
          { ...notice, id: "2", title: "Segundo aviso" },
          { ...notice, id: "3", title: "Terceiro aviso" },
        ]}
      />,
    );
    await screen.findByText("Ensaio geral");
    expect(screen.queryByText("Aviso antigo")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todos os avisos (4)" }));
    expect(screen.getByText("Aviso antigo")).toBeInTheDocument();
  });
  it("shows event, date and full plain-text notice content", async () => {
    render(<ChoristerNotices loadNotices={async () => [notice]} />);
    expect(await screen.findByRole("heading", { name: "Ensaio geral" })).toBeInTheDocument();
    expect(screen.getByText("Grande Concerto")).toBeInTheDocument();
    expect(screen.getByText(/Chegue às 18h/)).toHaveTextContent("Leve sua partitura.");
    expect(document.querySelector("time")).toHaveAttribute("datetime", notice.createdAt);
  });

  it("distinguishes loading failure from an empty feed and permits retry", async () => {
    const user = userEvent.setup();
    const loadNotices = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    render(<ChoristerNotices loadNotices={loadNotices} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os avisos.",
    );
    expect(screen.queryByText("Nenhum aviso publicado por enquanto.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar avisos" }));
    expect(await screen.findByText("Nenhum aviso publicado por enquanto.")).toBeInTheDocument();
  });

  it("updates the feed after a notice is withdrawn", async () => {
    const user = userEvent.setup();
    const loadNotices = vi.fn().mockResolvedValueOnce([notice]).mockResolvedValueOnce([]);
    render(<ChoristerNotices loadNotices={loadNotices} />);
    await screen.findByText("Ensaio geral");
    await user.click(screen.getByRole("button", { name: "Atualizar avisos" }));
    await screen.findByText("Nenhum aviso publicado por enquanto.");
    expect(screen.queryByText("Ensaio geral")).not.toBeInTheDocument();
  });
});
