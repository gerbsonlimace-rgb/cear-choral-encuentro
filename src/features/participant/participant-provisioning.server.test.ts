import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ParticipantAuthFailure,
  ParticipantLinkFailure,
  createParticipantProvisioningService,
  createSupabaseParticipantAuthAdmin,
  createSupabaseParticipantProvisioningRepository,
  type PaidRegistrationIdentity,
  type ParticipantAccountRow,
  type ParticipantAuthAdmin,
  type ParticipantProvisioningRepository,
} from "./participant-provisioning.server";

const { from, rpc, authAdmin } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  authAdmin: {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUserById: vi.fn(),
    listUsers: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, rpc, auth: { admin: authAdmin } },
}));

const registrationId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const claimId = "33333333-3333-4333-8333-333333333333";
const adminUserId = "44444444-4444-4444-8444-444444444444";
const createdUserId = "55555555-5555-4555-8555-555555555555";

const paidRegistration: PaidRegistrationIdentity = {
  id: registrationId,
  email: " Participante@Example.com ",
  cpf: "529.982.247-25",
  birthDate: "1990-01-15",
};

const claimedAccount: ParticipantAccountRow = {
  id: accountId,
  registrationId,
  userId: null,
  accessStatus: "pending",
  provisioningClaimId: claimId,
};

function setup() {
  const repository = {
    findPaidRegistration: vi.fn(async () => paidRegistration),
    claim: vi.fn(async () => claimedAccount),
    activate: vi.fn(async () => true),
    fail: vi.fn(async () => {}),
    findByRegistration: vi.fn(async () => claimedAccount),
    findByUserId: vi.fn(async () => null),
    appendEvent: vi.fn(async () => {}),
  } satisfies ParticipantProvisioningRepository & {
    findByUserId: (userId: string) => Promise<ParticipantAccountRow | null>;
  };
  const auth: ParticipantAuthAdmin = {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async () => ({ id: createdUserId })),
    deleteUser: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    createMagicLink: vi.fn(async () => "https://example.supabase.co/auth/v1/verify?token=one-time"),
  };
  const service = createParticipantProvisioningService({
    repository,
    auth,
    createClaimId: () => claimId,
  });
  return { repository, auth, service };
}

describe("participant provisioning service", () => {
  it("does not provision when the raw initial payment_status is pending", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.findPaidRegistration).mockImplementation(async () => null);

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "pending" });

    expect(repository.claim).not.toHaveBeenCalled();
    expect(auth.findUserByEmail).not.toHaveBeenCalled();
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("provisions a paid initial registration after payment confirmation", async () => {
    const { repository, auth, service } = setup();

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(repository.claim).toHaveBeenCalledWith(registrationId, claimId);
    expect(auth.createUser).toHaveBeenCalledOnce();
  });

  it("returns an existing active link without calling Auth", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.claim).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: createdUserId,
      provisioningClaimId: null,
    });

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(auth.findUserByEmail).not.toHaveBeenCalled();
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("returns initial credentials only for a paid active linked participant", async () => {
    const { repository, service } = setup();
    vi.mocked(repository.findByRegistration).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: createdUserId,
      provisioningClaimId: null,
    });

    await expect(service.getInitialCredentials(registrationId)).resolves.toEqual({
      portalUrl: "/acessar",
      initialPassword: "529982",
    });
  });

  it("does not return initial credentials before the participant link is confirmed", async () => {
    const { repository, service } = setup();

    await expect(service.getInitialCredentials(registrationId)).resolves.toBeNull();
  });

  it("lets only the current claim holder call Auth", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.claim).mockResolvedValue({
      ...claimedAccount,
      provisioningClaimId: "66666666-6666-4666-8666-666666666666",
    });

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "pending" });

    expect(auth.findUserByEmail).not.toHaveBeenCalled();
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("rejects an Auth email already in use", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "conflict" });

    expect(auth.findUserByEmail).toHaveBeenCalledWith("participante@example.com");
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith({ accountId, registrationId, claimId, status: "conflict", code: "EMAIL_CONFLICT" });
  });

  it("keeps an Auth user linked to another participant out of a second registration", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    vi.mocked(repository.findByUserId).mockImplementation(async () => ({
      ...claimedAccount,
      registrationId: "66666666-6666-4666-8666-666666666666",
      userId: "existing-user",
      accessStatus: "active",
      provisioningClaimId: null,
    }));

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "conflict" });

    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith({
      accountId,
      registrationId,
      claimId,
      status: "conflict",
      code: "EMAIL_CONFLICT",
    });
  });

  it("does not attempt to link an existing Auth user", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(auth.findUserByEmail).mockResolvedValue({ id: "existing-user" });
    await expect(service.provision(registrationId)).resolves.toEqual({ status: "conflict" });

    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps a duplicate-email create race blocked", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(auth.findUserByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-user" });
    vi.mocked(auth.createUser).mockRejectedValue(new ParticipantAuthFailure("email_conflict"));

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "conflict" });

    expect(auth.findUserByEmail).toHaveBeenCalledTimes(2);
    expect(auth.createUser).toHaveBeenCalledOnce();
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith({ accountId, registrationId, claimId, status: "conflict", code: "EMAIL_CONFLICT" });
  });

  it("creates a confirmed Auth user, activates the exact claim, and audits no secrets", async () => {
    const { repository, auth, service } = setup();

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(auth.createUser).toHaveBeenCalledWith({
      email: "participante@example.com",
      password: "529982",
      emailConfirm: true,
    });
    expect(repository.activate).toHaveBeenCalledWith({
      accountId,
      registrationId,
      claimId,
      userId: createdUserId,
    });
    expect(vi.mocked(repository.claim).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.createUser).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(auth.createUser).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.activate).mock.invocationCallOrder[0],
    );
    const auditPayload = JSON.stringify(vi.mocked(repository.appendEvent).mock.calls);
    expect(auditPayload).not.toContain("52998224725");
    expect(auditPayload).not.toContain("15011990");
    expect(auditPayload).not.toContain(claimId);
    expect(auditPayload).not.toContain("token");
    expect(repository.appendEvent).toHaveBeenCalledWith({
      registrationId,
      participantAccountId: accountId,
      eventType: "provisioned",
    });
  });

  it("compensates only its new user after an authoritative rejected link and absent reconciliation", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.activate).mockResolvedValue(false);
    vi.mocked(repository.findByRegistration).mockResolvedValue(claimedAccount);

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "pending" });

    expect(repository.findByRegistration).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith(createdUserId);
    expect(vi.mocked(repository.findByRegistration).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.deleteUser).mock.invocationCallOrder[0],
    );
    expect(repository.fail).toHaveBeenCalledWith({
      accountId,
      registrationId,
      claimId,
      status: "pending",
      code: "LINK_REJECTED",
    });
  });

  it("reconciles a lost activation response to active before considering cleanup", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.activate).mockRejectedValue(new ParticipantLinkFailure("unknown"));
    vi.mocked(repository.findByRegistration).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: createdUserId,
      provisioningClaimId: null,
    });

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(repository.findByRegistration).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("removes only its orphan after an authoritative rejection reveals another active link", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.activate).mockRejectedValue(
      new ParticipantLinkFailure("confirmed_rejection"),
    );
    vi.mocked(repository.findByRegistration).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: "77777777-7777-4777-8777-777777777777",
      provisioningClaimId: null,
    });

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith(createdUserId);
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("audits a failed orphan cleanup without changing the reconciled active account", async () => {
    const { repository, auth, service } = setup();
    const otherLinkedUserId = "77777777-7777-4777-8777-777777777777";
    vi.mocked(repository.activate).mockRejectedValue(
      new ParticipantLinkFailure("confirmed_rejection"),
    );
    vi.mocked(repository.findByRegistration).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: otherLinkedUserId,
      provisioningClaimId: null,
    });
    vi.mocked(auth.deleteUser).mockRejectedValue(
      Object.assign(new Error("cleanup exposed 52998224725 and password"), {
        token: "SECRET",
        claimId,
      }),
    );

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "active" });

    expect(auth.deleteUser).toHaveBeenCalledExactlyOnceWith(createdUserId);
    expect(auth.deleteUser).not.toHaveBeenCalledWith(otherLinkedUserId);
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(repository.fail).not.toHaveBeenCalled();
    expect(repository.appendEvent).toHaveBeenCalledWith({
      registrationId,
      participantAccountId: accountId,
      eventType: "provisioning_pending",
      errorCode: "AUTH_CLEANUP_FAILED",
    });
    const auditPayload = JSON.stringify(vi.mocked(repository.appendEvent).mock.calls);
    expect(auditPayload).not.toContain("52998224725");
    expect(auditPayload).not.toContain("password");
    expect(auditPayload).not.toContain("SECRET");
    expect(auditPayload).not.toContain(claimId);
  });

  it("never deletes the new user when an unknown link outcome is still invisible", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.activate).mockRejectedValue(new ParticipantLinkFailure("unknown"));
    vi.mocked(repository.findByRegistration).mockResolvedValue(claimedAccount);

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "pending" });

    expect(repository.findByRegistration).toHaveBeenCalledExactlyOnceWith(registrationId);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps a paid registration pending after Auth fails and audits only a safe code", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(auth.createUser).mockRejectedValue(
      Object.assign(new Error("provider returned CPF 52998224725 and password"), {
        token: "SECRET",
      }),
    );

    await expect(service.provision(registrationId)).resolves.toEqual({ status: "pending" });

    expect(repository.activate).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith({
      accountId,
      registrationId,
      claimId,
      status: "pending",
      code: "AUTH_UNAVAILABLE",
    });
    const auditPayload = JSON.stringify(vi.mocked(repository.appendEvent).mock.calls);
    expect(auditPayload).toContain("AUTH_UNAVAILABLE");
    expect(auditPayload).not.toContain("52998224725");
    expect(auditPayload).not.toContain("SECRET");
    expect(auditPayload).not.toContain("password");
  });

  it("records reprocessing before reusing the same provisioning path", async () => {
    const { repository, service } = setup();

    await expect(service.reprocess(registrationId, adminUserId)).resolves.toEqual({
      status: "active",
    });

    expect(repository.appendEvent).toHaveBeenNthCalledWith(1, {
      registrationId,
      participantAccountId: accountId,
      eventType: "reprocess_requested",
      adminUserId,
    });
    expect(repository.findPaidRegistration).toHaveBeenCalledOnce();
    expect(repository.claim).toHaveBeenCalledOnce();
  });

  it("resets only an active linked paid participant to the server-derived initial password", async () => {
    const { repository, auth, service } = setup();
    vi.mocked(repository.findByRegistration).mockResolvedValue({
      ...claimedAccount,
      accessStatus: "active",
      userId: createdUserId,
      provisioningClaimId: null,
    });

    await expect(service.resetInitialPassword(registrationId, adminUserId)).resolves.toEqual({
      status: "success",
      sessionsRevoked: false,
    });

    expect(auth.updatePassword).toHaveBeenCalledExactlyOnceWith(
      createdUserId,
      "529982",
    );
    expect(repository.appendEvent).toHaveBeenCalledWith({
      registrationId,
      participantAccountId: accountId,
      eventType: "password_reset",
      adminUserId,
    });
    expect(JSON.stringify(vi.mocked(repository.appendEvent).mock.calls)).not.toContain(
      "52998224725",
    );
  });

  it.each([
    { paid: null, account: claimedAccount },
    { paid: paidRegistration, account: null },
    { paid: paidRegistration, account: claimedAccount },
    {
      paid: paidRegistration,
      account: { ...claimedAccount, accessStatus: "active" as const, userId: null },
    },
  ])(
    "refuses password reset unless the account is paid, active, and linked",
    async ({ paid, account }) => {
      const { repository, auth, service } = setup();
      vi.mocked(repository.findPaidRegistration).mockImplementation(async () => paid);
      vi.mocked(repository.findByRegistration).mockImplementation(async () => account);

      await expect(service.resetInitialPassword(registrationId, adminUserId)).rejects.toThrow(
        "Participant password reset unavailable",
      );

      expect(auth.updatePassword).not.toHaveBeenCalled();
      expect(repository.appendEvent).not.toHaveBeenCalled();
    },
  );
});

describe("Supabase participant adapters", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    authAdmin.createUser.mockReset();
    authAdmin.deleteUser.mockReset();
    authAdmin.updateUserById.mockReset();
    authAdmin.listUsers.mockReset();
  });

  it("normalizes the email and checks every Auth page", async () => {
    authAdmin.listUsers
      .mockResolvedValueOnce({
        data: { users: [{ id: "other", email: "other@example.com" }], nextPage: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [{ id: "existing", email: "PARTICIPANTE@example.com" }], nextPage: null },
        error: null,
      });

    await expect(
      createSupabaseParticipantAuthAdmin().findUserByEmail(" Participante@Example.com "),
    ).resolves.toEqual({ id: "existing" });

    expect(authAdmin.listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 });
    expect(authAdmin.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
  });

  it("uses confirmed server-side creation, direct deletion, and direct password update", async () => {
    authAdmin.createUser.mockResolvedValue({ data: { user: { id: createdUserId } }, error: null });
    authAdmin.deleteUser.mockResolvedValue({ data: {}, error: null });
    authAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: createdUserId } },
      error: null,
    });
    const auth = createSupabaseParticipantAuthAdmin();

    await auth.createUser({
      email: " Participante@Example.com ",
      password: "temporary-secret",
      emailConfirm: true,
    });
    await auth.deleteUser(createdUserId);
    await auth.updatePassword(createdUserId, "new-secret");

    expect(authAdmin.createUser).toHaveBeenCalledWith({
      email: "participante@example.com",
      password: "temporary-secret",
      email_confirm: true,
    });
    expect(authAdmin.deleteUser).toHaveBeenCalledExactlyOnceWith(createdUserId);
    expect(authAdmin.updateUserById).toHaveBeenCalledExactlyOnceWith(createdUserId, {
      password: "new-secret",
    });
  });

  it.each(["email_exists", "user_already_exists"])(
    "preserves duplicate-email Auth code %s as a typed conflict outcome",
    async (code) => {
      authAdmin.createUser.mockResolvedValue({
        data: { user: null },
        error: { code, message: "private provider details" },
      });

      await expect(
        createSupabaseParticipantAuthAdmin().createUser({
          email: "participante@example.com",
          password: "temporary-secret",
          emailConfirm: true,
        }),
      ).rejects.toMatchObject({ outcome: "email_conflict" });
    },
  );

  it("keeps an unknown Auth create failure distinct from an email conflict", async () => {
    authAdmin.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "over_request_rate_limit", message: "private provider details" },
    });

    await expect(
      createSupabaseParticipantAuthAdmin().createUser({
        email: "participante@example.com",
        password: "temporary-secret",
        emailConfirm: true,
      }),
    ).rejects.toMatchObject({ outcome: "unknown" });
  });

  it.each(["activate", "fail"] as const)(
    "%s filters by registration, account, and claim and rejects an unaffected row",
    async (operation) => {
      const response = { data: null, error: null };
      const query = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => response),
      };
      from.mockReturnValue(query);
      const repository = createSupabaseParticipantProvisioningRepository();

      const result =
        operation === "activate"
          ? repository.activate({
              accountId,
              registrationId,
              claimId,
              userId: createdUserId,
            })
          : repository.fail({
              accountId,
              registrationId,
              claimId,
              status: "pending",
              code: "AUTH_UNAVAILABLE",
            });

      if (operation === "activate") await expect(result).resolves.toBe(false);
      else await expect(result).rejects.toThrow("Participant claim is no longer owned");
      expect(query.eq.mock.calls).toEqual(
        expect.arrayContaining([
          ["id", accountId],
          ["registration_id", registrationId],
          ["provisioning_claim_id", claimId],
        ]),
      );
    },
  );

  it("classifies a thrown activation transport error as unknown", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => {
        throw Object.assign(new Error("connection lost"), { code: "23505" });
      }),
    };
    from.mockReturnValue(query);

    await expect(
      createSupabaseParticipantProvisioningRepository().activate({
        accountId,
        registrationId,
        claimId,
        userId: createdUserId,
      }),
    ).rejects.toMatchObject({ outcome: "unknown" });
  });
});
