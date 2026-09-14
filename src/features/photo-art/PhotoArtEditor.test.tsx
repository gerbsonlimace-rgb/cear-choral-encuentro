import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderReadyArt: vi.fn(),
  loadImage: vi.fn(),
  loadPhoto: vi.fn(),
  canvasToPhotoFile: vi.fn(),
  downloadPhotoFile: vi.fn(),
  sharePhotoFile: vi.fn(),
}));

vi.mock("./renderReadyArt", () => ({ renderReadyArt: mocks.renderReadyArt }));
vi.mock("./photoArt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photoArt")>()),
  loadImage: mocks.loadImage,
  loadPhoto: mocks.loadPhoto,
  canvasToPhotoFile: mocks.canvasToPhotoFile,
  downloadPhotoFile: mocks.downloadPhotoFile,
  sharePhotoFile: mocks.sharePhotoFile,
}));

import { PhotoArtEditor } from "./PhotoArtEditor";

describe("PhotoArtEditor", () => {
  beforeEach(() => {
    const image = { naturalWidth: 1000, naturalHeight: 1200 } as HTMLImageElement;
    mocks.loadImage.mockResolvedValue(image);
    mocks.loadPhoto.mockResolvedValue(image);
    mocks.canvasToPhotoFile.mockResolvedValue(
      new File(["png"], "encontro-coros-quixada.png", { type: "image/png" }),
    );
    mocks.sharePhotoFile.mockResolvedValue("shared");
  });

  it("offers seven complete Story arts and no independent phrase or format controls", async () => {
    render(<PhotoArtEditor />);

    expect(screen.getByRole("heading", { name: "Escolha uma arte pronta" })).toBeInTheDocument();
    expect(screen.getByText("Story 9:16")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.queryByRole("radiogroup", { name: "Frase" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Formato" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /homem pardo/i })).not.toHaveLength(0);
    expect(screen.getAllByRole("img", { name: /mulher parda/i })).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Baixar imagem" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compartilhar imagem" })).toBeDisabled();
    await waitFor(() => expect(mocks.loadImage).toHaveBeenCalledTimes(2));
  });

  it("loads the selected fixed artwork and inserts only the participant photo", async () => {
    render(<PhotoArtEditor />);
    await waitFor(() => expect(mocks.renderReadyArt).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("radio", { name: /Canto novo/ }));
    await waitFor(() => expect(mocks.loadImage).toHaveBeenCalledTimes(4));

    const file = new File(["photo"], "pessoa.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Inserir minha foto"), { target: { files: [file] } });

    await waitFor(() =>
      expect(mocks.renderReadyArt).toHaveBeenLastCalledWith(
        expect.any(HTMLCanvasElement),
        expect.objectContaining({
          art: expect.objectContaining({ id: "canto-novo" }),
          photo: expect.anything(),
        }),
      ),
    );
    expect(screen.getByLabelText("Tamanho da foto")).toBeInTheDocument();
    expect(screen.getByText(/Arraste a foto na prévia/)).toBeInTheDocument();
  });

  it("downloads the prepared Story and explains when native sharing is unavailable", async () => {
    mocks.sharePhotoFile.mockResolvedValue("unsupported");
    render(<PhotoArtEditor />);
    await waitFor(() => expect(mocks.renderReadyArt).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Inserir minha foto"), {
      target: { files: [new File(["photo"], "pessoa.jpg", { type: "image/jpeg" })] },
    });

    const download = screen.getByRole("button", { name: "Baixar imagem" });
    const share = screen.getByRole("button", { name: "Compartilhar imagem" });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    expect(mocks.downloadPhotoFile).toHaveBeenCalledWith(expect.any(File));

    fireEvent.click(share);
    expect(
      await screen.findByText(/seu navegador não oferece o compartilhamento direto/i),
    ).toBeInTheDocument();
  });
});
