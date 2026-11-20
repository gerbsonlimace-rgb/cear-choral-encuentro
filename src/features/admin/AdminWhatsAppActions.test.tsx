import { fireEvent, render, screen, cleanup, renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRegistrationWhatsAppButton, AdminWhatsAppToolbar, AdminWhatsAppSelection, useAdminWhatsApp, type AdminWhatsAppController } from "./AdminWhatsAppActions";
import type { AdminRegistrationRow } from "./admin.domain";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() } } }));
afterEach(cleanup);
const row = { id: "5bf18595-a8bb-4d54-bfb1-1ffd2e385304", name: "Ana", paymentStatus: "paid", cancelledAt: null } as AdminRegistrationRow;
function controller(): AdminWhatsAppController {
  return { connected: true, requesting: false, error: "", refresh: vi.fn(), pause: vi.fn(), send: vi.fn(), resend: vi.fn(),
    selectedIds: [], sendSelected: vi.fn(), toggleSelected: vi.fn(), selectPage: vi.fn(), clearSelection: vi.fn(),
    status: { phase: "idle", total: 0, completed: 0, busy: false, registrations: {} } } as unknown as AdminWhatsAppController;
}

describe("WhatsApp actions in registrations", () => {
  it("never starts a send on render and sends only the clicked registration", () => {
    const control = controller();
    render(<AdminRegistrationWhatsAppButton row={row} controller={control} />);
    expect(control.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar cartão pelo WhatsApp para Ana" }));
    expect(control.send).toHaveBeenCalledExactlyOnceWith(row.id);
  });
  it("sends all through one explicit toolbar action", () => {
    const control = controller();
    render(<AdminWhatsAppToolbar controller={control} />);
    expect(control.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar todos" }));
    expect(control.send).toHaveBeenCalledExactlyOnceWith();
  });
  it.each(["sent", "review"] as const)("resends a %s card only after confirmation", (state) => {
    const control = controller();
    control.status.registrations[row.id] = state;
    render(<AdminRegistrationWhatsAppButton row={row} controller={control} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cartão pelo WhatsApp para Ana" }));
    expect(control.resend).not.toHaveBeenCalled();
    expect(control.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cartão" }));
    expect(control.resend).toHaveBeenCalledExactlyOnceWith(row.id);
    expect(control.send).not.toHaveBeenCalled();
  });
  it("cancelling the resend confirmation sends nothing", () => {
    const control = controller();
    control.status.registrations[row.id] = "sent";
    render(<AdminRegistrationWhatsAppButton row={row} controller={control} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cartão pelo WhatsApp para Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(control.resend).not.toHaveBeenCalled();
  });
  it.each(["offline", "pending", "cancelled", "busy"])("prevents individual sends when %s", (condition) => {
    const control = controller();
    const participant = { ...row };
    if (condition === "offline") control.connected = false;
    if (condition === "pending") participant.paymentStatus = "pending";
    if (condition === "cancelled") participant.cancelledAt = "2026-11-20T08:00:00Z";
    if (condition === "busy") control.status.busy = true;
    render(<AdminRegistrationWhatsAppButton row={participant} controller={control} />);
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(control.send).not.toHaveBeenCalled();
  });
  it("shows progress and pauses without starting another batch", () => {
    const control = controller();
    control.status = { ...control.status, phase: "sending", total: 157, completed: 12, busy: true };
    render(<AdminWhatsAppToolbar controller={control} />);
    expect(screen.queryByRole("button", { name: "Enviar todos" })).toBeNull();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "12");
    fireEvent.click(screen.getByRole("button", { name: "Pausar após este cartão" }));
    expect(control.pause).toHaveBeenCalledOnce();
    expect(control.send).not.toHaveBeenCalled();
  });
  it("sends a selection only through its specific button", () => {
    const control = controller();
    control.selectedIds = [row.id];
    render(<AdminWhatsAppToolbar controller={control} rows={[row]} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar selecionados (1)" }));
    expect(control.sendSelected).toHaveBeenCalledExactlyOnceWith();
    expect(control.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar elegíveis desta página" }));
    expect(control.selectPage).toHaveBeenCalledExactlyOnceWith([row], false);
  });
  it("does not allow sending an empty selection", () => {
    const control = controller();
    render(<AdminWhatsAppToolbar controller={control} />);
    expect(screen.getByRole("button", { name: "Enviar selecionados (0)" })).toBeDisabled();
  });
  it("selects a participant without sending the card", () => {
    const control = controller();
    render(<AdminWhatsAppSelection row={row} controller={control} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Ana para envio por WhatsApp" }));
    expect(control.toggleSelected).toHaveBeenCalledExactlyOnceWith(row, true);
    expect(control.send).not.toHaveBeenCalled();
    expect(control.sendSelected).not.toHaveBeenCalled();
  });
  it("keeps selection across pages and selects only eligible participants", async () => {
    const second = { ...row, id: "2eb9f28d-23f9-4f32-9e01-e9459986d8b9", name: "Bia" };
    const pending = { ...row, id: "pending", paymentStatus: "pending" } as AdminRegistrationRow;
    const { result, rerender } = renderHook(({ rows }) => useAdminWhatsApp(true, rows), { initialProps: { rows: [row, pending] } });
    act(() => result.current.selectPage([row, pending], true));
    expect(result.current.selectedIds).toEqual([row.id]);
    rerender({ rows: [second] });
    act(() => result.current.selectPage([second], true));
    expect(result.current.selectedIds).toEqual([row.id, second.id]);
    act(() => result.current.selectPage([second], false));
    expect(result.current.selectedIds).toEqual([row.id]);
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
    // Empty selections are no-ops and cannot fall back to an all-recipient request.
    await act(async () => { await result.current.sendSelected(); });
    expect(result.current.requesting).toBe(false);
  });
});
