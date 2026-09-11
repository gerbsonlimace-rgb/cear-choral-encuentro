import { describe, expect, it } from "vitest";
import {
  fingerprintAdminPasswordCandidate,
  fingerprintRegentPasswordCandidate,
} from "./regent-password-candidate.server";

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

describe("administrator password candidate fingerprint", () => {
  it("uses a separate keyed domain while binding membership and user", async () => {
    const candidate = {
      membershipId: "membership-1",
      userId: "user-1",
      password: "NewPassword123",
    };

    await expect(fingerprintAdminPasswordCandidate("test-secret", candidate)).resolves.toBe(
      "84923bd76532a37e387102ea9c30422297e47395c336b6ef8528cf2460655dd9",
    );
    await expect(
      fingerprintAdminPasswordCandidate("test-secret", { ...candidate, userId: "user-2" }),
    ).resolves.not.toBe(await fingerprintAdminPasswordCandidate("test-secret", candidate));
  });
});
