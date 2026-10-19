import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminChoirSummaryCard } from "./AdminChoirSummaryCard";
import { deliverFile } from "@/lib/file-download";

vi.mock("@/lib/file-download", () => ({ deliverFile: vi.fn().mockResolvedValue(undefined) }));
const item = { choirName: "Coro de Quixadá", total: 30, receivedCents: 20000, pendingCents: 10000, pendingRegentCents: 0, expectedCents: 30000 };

describe("choir summary PDF", () => {
  it("prepares the exact card choir with every payment state, then delivers only on the final click", async () => {
    const preparePdf = vi.fn().mockResolvedValue({ base64: btoa("%PDF-fixture"), fileName: "quixada.pdf" });
    render(<AdminChoirSummaryCard item={item} preparePdf={preparePdf} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF de Coro de Quixadá" }));
    await screen.findByRole("button", { name: "Baixar PDF de Coro de Quixadá" });
    expect(preparePdf).toHaveBeenCalledExactlyOnceWith({ data: { choirName: "Coro de Quixadá", choirId: "all", paymentStatus: "all", musicalProfile: "all", search: "", loginStatus: "all" } });
    expect(deliverFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF de Coro de Quixadá" }));
    expect(deliverFile).toHaveBeenCalledWith(expect.any(Blob), "quixada.pdf");
    expect(preparePdf).toHaveBeenCalledOnce();
  });

  it("allows another preparation after a failure without delivering a partial file", async () => {
    const preparePdf = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue({ base64: btoa("%PDF-fixture"), fileName: "quixada.pdf" });
    render(<AdminChoirSummaryCard item={item} preparePdf={preparePdf} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Baixar PDF de Coro de Quixadá" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("button", { name: "Baixar PDF de Coro de Quixadá" });
    expect(preparePdf).toHaveBeenCalledTimes(2);
  });
});