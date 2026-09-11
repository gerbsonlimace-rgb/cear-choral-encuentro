import { describe, expect, it } from "vitest";
import { fingerprintRegentPasswordCandidate } from "./regent-password-candidate.server";

describe("regent password candidate fingerprint", () => {
  it("uses a keyed, membership-bound HMAC without retaining the password", async () => {
    const fingerprint = await fingerprintRegentPasswordCandidate("test-secret", {
      membershipId: "membership-1",
      userId: "user-1",
      password: "SenhaNova123",
    });

    expect(fingerprint).toBe("a29aaeff6eff5420b17f5326d5aaace484dc90a03b3c81964d52caab7b16972f");
    await expect(
      fingerprintRegentPasswordCandidate("another-secret", {
        membershipId: "membership-1",
        userId: "user-1",
        password: "SenhaNova123",
      }),
    ).resolves.not.toBe(fingerprint);
    await expect(
      fingerprintRegentPasswordCandidate("test-secret", {
        membershipId: "membership-2",
        userId: "user-1",
        password: "SenhaNova123",
      }),
    ).resolves.not.toBe(fingerprint);
  });
});
