import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderPhotoArt: vi.fn(),
  loadImage: vi.fn(),
  loadPhoto: vi.fn(),
  canvasToPhotoFile: vi.fn(),
  downloadPhotoFile: vi.fn(),
  sharePhotoFile: vi.fn(),
}));

vi.mock("./renderPhotoArt", () => ({ renderPhotoArt: mocks.renderPhotoArt }));
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

  it("prioritizes the mobile creation flow and keeps output actions disabled until a photo is ready", async () => {
    render(<PhotoArtEditor />);

    expect(screen.getByRole("heading", { name: "Crie sua foto do encontro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Escolher uma foto")).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio", { name: /Clássica|Leve|Jovem|Amarela|Melodia|Quixadá/ }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("img", { name: /Modelo de exemplo/ })).toHaveLength(6);
    expect(screen.getAllByRole("img", { name: /modelo de exemplo homem/i })).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: /modelo de exemplo mulher/i })).toHaveLength(3);
    expect(screen.getByRole("img", { name: /modelo de exemplo homem pardo/i })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /modelo de exemplo mulher parda/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio", { name: /#EuVou|Cantai|Música|oração|louvor|melodia/ }),
    ).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Baixar imagem" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compartilhar imagem" })).toBeDisabled();
  });

  it("renders the chosen style and phrase, then downloads the prepared PNG", async () => {
    render(<PhotoArtEditor />);
    await waitFor(() => expect(mocks.loadImage).toHaveBeenCalledTimes(2));

    const file = new File(["photo"], "pessoa.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Escolher uma foto"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("radio", { name: /Leve/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Minha voz é oração/ }));

    await waitFor(() =>
      expect(mocks.renderPhotoArt).toHaveBeenLastCalledWith(
        expect.any(HTMLCanvasElement),
        expect.objectContaining({ style: "leve", phrase: "oracao" }),
      ),
    );
    const download = await screen.findByRole("button", { name: "Baixar imagem" });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    expect(mocks.downloadPhotoFile).toHaveBeenCalledWith(expect.any(File));
  });

  it("explains when native file sharing is unavailable", async () => {
    mocks.sharePhotoFile.mockResolvedValue("unsupported");
    render(<PhotoArtEditor />);
    fireEvent.change(screen.getByLabelText("Escolher uma foto"), {
      target: { files: [new File(["photo"], "pessoa.jpg", { type: "image/jpeg" })] },
    });
    const share = await screen.findByRole("button", { name: "Compartilhar imagem" });
    await waitFor(() => expect(share).toBeEnabled());
    fireEvent.click(share);
    expect(
      await screen.findByText(/seu navegador não oferece o compartilhamento direto/i),
    ).toBeInTheDocument();
  });
});
