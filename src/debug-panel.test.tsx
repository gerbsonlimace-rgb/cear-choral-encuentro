import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminRegentsPanel } from "@/features/admin/AdminRegentsPanel";

const choirId = "11111111-1111-4111-8111-111111111111";
describe("debug", () => {
  it("searches", async () => {
    const searchCandidates = vi.fn(async () => [
      { userId: "user-9", email: "m@example.com", name: "Irmã M" },
    ]);
    const user = userEvent.setup();
    render(
      <AdminRegentsPanel
        choirs={[{ id: choirId, name: "Coro" }]}
        choirId={choirId}
        loadRegents={vi.fn(async () => [])}
        searchCandidates={searchCandidates}
        linkExistingRegent={vi.fn(async () => ({ status: "success" as const, regent: { id: "r", choirId, userId: "u", name: "Irmã M", email: "m@example.com", passwordChangeRequired: false, revokedAt: null } }))}
      />,
    );
    await screen.findByText("Nenhum regente cadastrado.");
    await user.click(screen.getByRole("button", { name: "Vincular usuário existente" }));
    const input = screen.getByLabelText("Buscar usuário");
    console.log("input found", !!input);
    await user.type(input, "macrina");
    console.log("typed value", (input as HTMLInputElement).value);
    await new Promise((r) => setTimeout(r, 500));
    console.log("calls", searchCandidates.mock.calls);
    await waitFor(() => expect(searchCandidates).toHaveBeenCalled());
  });
});
