import { describe, it, expect, vi } from "vitest";
import { prepareFeedbackAccess, claimFeedbackVideo } from "./eventFeedbackAccess.server";
describe("registered feedback access", () => {
  it("requires a registered identity and never signs video for an invalid registration", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "feedback_registration_not_found" } });
    const sign = vi.fn();
    await expect(
      prepareFeedbackAccess({ identity: "529.982.247-25" }, { rpc, sign }),
    ).rejects.toThrow("inscrições");
    expect(sign).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "prepare_registered_event_feedback",
      expect.objectContaining({
        p_identity: "cpf:52998224725",
        p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });
  it("resumes an already viewed registration without signing another URL", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ responded: true, video_available: false }], error: null });
    const sign = vi.fn();
    const result = await prepareFeedbackAccess({ token: "a".repeat(64) }, { rpc, sign });
    expect(result).toMatchObject({ responded: true, videoUrl: null, token: "a".repeat(64) });
    expect(sign).not.toHaveBeenCalled();
  });
  it("signs only validated access and checks the server before opening", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ responded: false, video_available: true }], error: null })
      .mockResolvedValue({ data: false, error: null });
    const sign = vi.fn().mockResolvedValue("https://example.invalid/private-signed.mp4");
    const result = await prepareFeedbackAccess({ identity: "pessoa@example.com" }, { rpc, sign });
    expect(result.videoUrl).toContain("private-signed");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      claimFeedbackVideo(
        { token: result.token, claimId: "22222222-2222-4222-8222-222222222222" },
        rpc,
      ),
    ).resolves.toEqual({ allowed: false });
  });
});
