import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminFeedbackPdfExport } from "./AdminFeedbackPdfExport";
import { deliverFile, openPreparedPdf } from "@/lib/file-download";

vi.mock("@/lib/admin-event-feedback.functions", () => ({ exportAdminEventFeedbackPdf: vi.fn() }));
vi.mock("@/lib/file-download", () => ({
  deliverFile: vi.fn().mockResolvedValue(undefined),
  openPreparedPdf: vi.fn(),
}));
const file = { fileName: "resultados.pdf", base64: btoa("%PDF-example") };

describe("feedback PDF export", () => {
  it("prepares first and delivers only in the final user click, without another request", async () => {
    let resolve!: (value: typeof file) => void;
    const prepare = vi.fn(
      () =>
        new Promise<typeof file>((done) => {
          resolve = done;
        }),
    );
    render(<AdminFeedbackPdfExport prepare={prepare} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    expect(screen.getByRole("button", { name: /Preparando/ })).toBeDisabled();
    expect(deliverFile).not.toHaveBeenCalled();
    resolve(file);
    await userEvent.click(await screen.findByRole("button", { name: "Abrir PDF" }));
    expect(openPreparedPdf).toHaveBeenCalledWith(expect.any(Blob));
    await userEvent.click(screen.getByRole("button", { name: "Baixar ou compartilhar" }));
    expect(deliverFile).toHaveBeenCalledWith(expect.any(Blob), "resultados.pdf");
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("allows retry after a preparation error without offering an invalid download", async () => {
    const prepare = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(file);
    render(<AdminFeedbackPdfExport prepare={prepare} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível preparar");
    expect(screen.queryByRole("button", { name: "Abrir PDF" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    expect(await screen.findByRole("button", { name: "Abrir PDF" })).toBeEnabled();
  });
});
