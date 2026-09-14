import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParticipantPhotoArtGate } from "./ParticipantPhotoArtGate";

describe("ParticipantPhotoArtGate", () => {
  it("waits for the browser session and then shows the editor to an authorized participant", async () => {
    const checkAccess = vi.fn().mockResolvedValue({ status: "authorized" });
    render(
      <ParticipantPhotoArtGate checkAccess={checkAccess} onMissingAccess={vi.fn()}>
        <h1>Editor autorizado</h1>
      </ParticipantPhotoArtGate>,
    );

    expect(screen.getByText("Validando seu acesso…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Editor autorizado" })).toBeInTheDocument();
    expect(checkAccess).toHaveBeenCalledOnce();
  });

  it("redirects only after the client-side access check denies the session", async () => {
    const onMissingAccess = vi.fn();
    render(
      <ParticipantPhotoArtGate
        checkAccess={() => Promise.resolve({ status: "unauthenticated" })}
        onMissingAccess={onMissingAccess}
      >
        <h1>Editor autorizado</h1>
      </ParticipantPhotoArtGate>,
    );

    await waitFor(() => expect(onMissingAccess).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Editor autorizado" })).not.toBeInTheDocument();
  });
});
