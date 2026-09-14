import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderReadyArt: vi.fn(),
  loadImage: vi.fn(),
  loadPhoto: vi.fn(),
  canvasToPhotoFile: vi.fn(),
  downloadPhotoFile: vi.fn(),
  sharePhotoFile: vi.fn(),
  detectFaceAdjustment: vi.fn(),
}));

vi.mock("./renderReadyArt", () => ({ renderReadyArt: mocks.renderReadyArt }));
vi.mock("./photoArt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photoArt")>()),
  loadImage: mocks.loadImage,
  loadPhoto: mocks.loadPhoto,
  canvasToPhotoFile: mocks.canvasToPhotoFile,
  downloadPhotoFile: mocks.downloadPhotoFile,
  sharePhotoFile: mocks.sharePhotoFile,
  detectFaceAdjustment: mocks.detectFaceAdjustment,
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
    mocks.detectFaceAdjustment.mockResolvedValue({ zoom: 1, x: 0.35, y: -0.2 });
  });

  it("starts a three-step mobile wizard with the seven approved Story arts", async () => {
    render(<PhotoArtEditor />);

    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Escolha uma arte" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getAllByRole("img", { name: /homem pardo/i })).not.toHaveLength(0);
    expect(screen.getAllByRole("img", { name: /mulher parda/i })).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Baixar imagem" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Compartilhar no Instagram" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    expect(screen.getByText("Etapa 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Foto e ajuste" })).toBeInTheDocument();
    expect(screen.getByText("Story 9:16")).toBeInTheDocument();
    expect(screen.getByLabelText("Tamanho da foto")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continuar para compartilhar" })).toBeDisabled();
    await waitFor(() => expect(mocks.loadImage).toHaveBeenCalledTimes(2));
  });

  it("inserts the photo and lets the participant adjust it before finishing", async () => {
    render(<PhotoArtEditor />);
    fireEvent.click(screen.getByRole("radio", { name: /Canto novo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    await waitFor(() => expect(mocks.loadImage).toHaveBeenCalledTimes(4));

    const file = new File(["photo"], "pessoa.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Inserir minha foto"), { target: { files: [file] } });

    const continueButton = screen.getByRole("button", { name: "Continuar para compartilhar" });
    await waitFor(() => expect(continueButton).toBeEnabled());

    expect(screen.getByText("Etapa 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Foto e ajuste" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tamanho da foto")).toBeInTheDocument();
    expect(screen.getByText(/arraste para mover/i)).toBeInTheDocument();
    expect(mocks.renderReadyArt).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        art: expect.objectContaining({ id: "canto-novo" }),
        photo: expect.anything(),
        adjustment: { zoom: 1, x: 0.35, y: -0.2 },
      }),
    );
  });

  it("finishes with download, Instagram sharing and the diocesan profile tag", async () => {
    mocks.sharePhotoFile.mockResolvedValue("unsupported");
    render(<PhotoArtEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    fireEvent.change(screen.getByLabelText("Inserir minha foto"), {
      target: { files: [new File(["photo"], "pessoa.jpg", { type: "image/jpeg" })] },
    });

    const continueToShare = screen.getByRole("button", { name: "Continuar para compartilhar" });
    await waitFor(() => expect(continueToShare).toBeEnabled());
    fireEvent.click(continueToShare);

    expect(screen.getByText("Etapa 3 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sua arte está pronta" })).toBeInTheDocument();
    expect(screen.getByText("@corodiocesanoqxd")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Baixar imagem" }));
    expect(mocks.downloadPhotoFile).toHaveBeenCalledWith(expect.any(File));

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar no Instagram" }));
    expect(
      await screen.findByText(/baixe a imagem, abra o Instagram e marque @corodiocesanoqxd/i),
    ).toBeInTheDocument();
  });

  it("allows returning to the previous wizard step", () => {
    render(<PhotoArtEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Escolha uma arte" })).toBeInTheDocument();
  });
});
