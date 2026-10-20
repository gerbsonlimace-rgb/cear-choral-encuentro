import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, storageFrom, createSignedUrl } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  },
}));

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireParticipantAccess } from "./participant-auth.middleware";
import * as participantAuth from "./participant-auth.server";
import {
  createParticipantAuthorizer,
  createParticipantRegistrationLoader,
  createParticipantPhoneUpdater,
  createSupabaseParticipantRepository,
  findParticipantAccessForAuthorization,
  type ParticipantAccessRepository,
} from "./participant-auth.server";

const activePaidAccount = {
  accountId: "account-1",
  registrationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  accessStatus: "active" as const,
  paymentStatus: "paid" as const,
};

const completeRegistration = {
  id: activePaidAccount.registrationId,
  amount_cents: 35000,
  birth_date: "1990-01-15",
  checkout_url: "https://checkout.example/private",
  choir_id: "22222222-2222-4222-8222-222222222222",
  choir_name: "Coro Diocesano",
  city: "Quixadá",
  cpf: "52998224725",
  created_at: "2026-09-11T10:00:00Z",
  diocese: "Diocese de Quixadá",
  email: "maria@example.com",
  infinitepay_invoice_slug: "private-slug",
  infinitepay_transaction_nsu: "private-transaction",
  installments: 2,
  institution: "Paróquia São José",
  name: "Maria da Silva",
  observations: "Observação interna",
  order_nsu: "33333333-3333-4333-8333-333333333333",
  paid_amount_cents: 35000,
  paid_at: "2026-09-11T12:00:00Z",
  payment_method: "credit_card",
  payment_status: "paid",
  phone: "85999999999",
  photo_path: "private/user-1/photo.jpg",
  pricing_type: "promotional",
  receipt_url: "https://receipt.example/paid",
  registration_price_cents: 30000,
  role: "Regente",
  standard_price_cents: 40000,
  voice_part: "soprano",
};

function repository(
  access: Awaited<ReturnType<ParticipantAccessRepository["findAccessByUserId"]>> = null,
  registration: Awaited<ReturnType<ParticipantAccessRepository["loadPaidRegistration"]>> = null,
): ParticipantAccessRepository {
  return {
    findAccessByUserId: vi.fn(async () => access),
    loadPaidRegistration: vi.fn(async () => registration),
    createPhotoUrl: vi.fn(async () => null),
    loadActiveRegentNames: vi.fn(async () => ["João de Souza"]),
    loadConfirmedComplementCents: vi.fn(async () => 2000),
    updatePaidPhone: vi.fn(async (_registrationId, phone) => phone),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  getUser.mockReset();
  from.mockReset();
  storageFrom.mockReset();
  createSignedUrl.mockReset();
});

describe("participant authorizer", () => {
  it.each([
    ["without a link", null],
    ["with pending access", { ...activePaidAccount, accessStatus: "pending" as const }],
    ["with conflicting access", { ...activePaidAccount, accessStatus: "conflict" as const }],
    ["with a mismatched user", { ...activePaidAccount, userId: "other-user" }],
  ])("returns a neutral unavailable state %s", async (_case, row) => {
    const authorizer = createParticipantAuthorizer(repository(row));

    await expect(authorizer.findAccess("user-1")).resolves.toEqual({ status: "unavailable" });
    await expect(authorizer.requireActive("user-1")).rejects.toThrow("Acesso não autorizado.");
  });

  it("denies app access when the raw initial payment_status is pending", async () => {
    const authorizer = createParticipantAuthorizer(
      repository({ ...activePaidAccount, paymentStatus: "pending" }),
    );

    await expect(authorizer.findAccess("user-1")).resolves.toEqual({ status: "unavailable" });
    await expect(authorizer.requireActive("user-1")).rejects.toThrow("Acesso não autorizado.");
  });

  it("authorizes only an active paid account owned by the verified user", async () => {
    const authorizer = createParticipantAuthorizer(repository(activePaidAccount));

    await expect(authorizer.findAccess("user-1")).resolves.toEqual({
      status: "authorized",
      accountId: "account-1",
      registrationId: activePaidAccount.registrationId,
      userId: "user-1",
    });
  });

  it("authorizes app access for an active paid initial registration", async () => {
    const authorizer = createParticipantAuthorizer(repository(activePaidAccount));

    await expect(authorizer.findAccess("user-1")).resolves.toMatchObject({
      status: "authorized",
      registrationId: activePaidAccount.registrationId,
    });
  });
});

describe("participant phone update", () => {
  it("updates only the registration selected by verified participant access", async () => {
    const data = repository(activePaidAccount, completeRegistration);
    const update = createParticipantPhoneUpdater(data);

    await expect(update({ ...activePaidAccount, status: "authorized" }, " (85) 98888-7777 "))
      .resolves.toEqual({ phone: "(85) 98888-7777" });
    expect(data.updatePaidPhone).toHaveBeenCalledExactlyOnceWith(
      activePaidAccount.registrationId,
      "(85) 98888-7777",
    );
  });

  it("rejects an invalid phone before writing participant data", async () => {
    const data = repository(activePaidAccount, completeRegistration);
    const update = createParticipantPhoneUpdater(data);

    await expect(update({ ...activePaidAccount, status: "authorized" }, "123"))
      .rejects.toThrow("Informe um WhatsApp brasileiro válido.");
    expect(data.updatePaidPhone).not.toHaveBeenCalled();
  });
});

describe("participant access probe", () => {
  it.each([undefined, null, "", "Basic secret", "Bearer "])(
    "returns unauthenticated for missing or malformed credentials (%s)",
    async (authorization) => {
      await expect(findParticipantAccessForAuthorization(authorization)).resolves.toEqual({
        status: "unauthenticated",
      });
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it("returns unauthenticated when Auth rejects the bearer token", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } });

    await expect(
      findParticipantAccessForAuthorization("Bearer signed.token.value"),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("fails closed without leaking an Auth transport failure", async () => {
    getUser.mockRejectedValue(new Error("private Auth transport details"));

    await expect(
      findParticipantAccessForAuthorization("Bearer signed.token.value"),
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("uses only the Auth server user id and returns neutral unavailable on lookup failure", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { registrationId: "victim" } } },
      error: null,
    });
    const findAccess = vi.fn(async () => {
      throw new Error("private database details");
    });

    await expect(
      findParticipantAccessForAuthorization("Bearer signed.token.value", { findAccess }),
    ).resolves.toEqual({ status: "unavailable" });
    expect(findAccess).toHaveBeenCalledExactlyOnceWith("user-1");
  });
});

describe("participant registration loader", () => {
  it.each([
    [2000, "partially_paid", 8000],
    [10000, "paid", 0],
  ] as const)(
    "discounts %i confirmed cents from the raffle balance",
    async (complement, status, pendingCents) => {
      const data = repository(activePaidAccount, { ...completeRegistration, amount_cents: 30000 });
      vi.mocked(data.loadConfirmedComplementCents).mockResolvedValue(complement);
      const view = await createParticipantRegistrationLoader(data).load({
        ...activePaidAccount,
        status: "authorized",
      });
      expect(view.payment.financialState).toEqual({
        status,
        pendingCents,
        confirmedPrincipalCents: 30000 + complement,
      });
      expect(data.loadConfirmedComplementCents).toHaveBeenCalledExactlyOnceWith(
        activePaidAccount.registrationId,
      );
      expect(data.loadActiveRegentNames).toHaveBeenCalledExactlyOnceWith(
        completeRegistration.choir_id,
      );
    },
  );
  it("keeps the portal usable without inventing a balance when the ledger fails", async () => {
    const data = repository(activePaidAccount, completeRegistration);
    vi.mocked(data.loadConfirmedComplementCents).mockRejectedValue(
      new Error("private ledger failure"),
    );
    const view = await createParticipantRegistrationLoader(data).load({
      ...activePaidAccount,
      status: "authorized",
    });
    expect(view.payment.financialState).toBeNull();
    expect(JSON.stringify(view)).not.toContain("private ledger failure");
  });
  it("returns the complete approved paid view with masked CPF and a signed photo URL", async () => {
    const data = repository(activePaidAccount, completeRegistration);
    vi.mocked(data.createPhotoUrl).mockResolvedValue("https://signed.example/photo");

    const view = await createParticipantRegistrationLoader(data).load({
      status: "authorized",
      accountId: activePaidAccount.accountId,
      registrationId: activePaidAccount.registrationId,
      userId: activePaidAccount.userId,
    });

    expect(view).toEqual({
      identity: {
        name: "Maria da Silva",
        cpf: "***.***.***-25",
        birthDate: "1990-01-15",
        email: "maria@example.com",
        phone: "85999999999",
        photoUrl: "https://signed.example/photo",
      },
      registration: {
        choirName: "Coro Diocesano",
        regentNames: ["João de Souza"],
        diocese: "Diocese de Quixadá",
        city: "Quixadá",
        institution: "Paróquia São José",
        role: "Regente",
        voicePart: "soprano",
        pricingType: "promotional",
        standardPriceCents: 40000,
        registrationPriceCents: 30000,
      },
      payment: {
        status: "paid",
        financialState: { status: "legacy", pendingCents: null, confirmedPrincipalCents: null },
        amountCents: 35000,
        paidAmountCents: 35000,
        paymentMethod: "credit_card",
        installments: 2,
        paidAt: "2026-09-11T12:00:00Z",
        orderNsu: "33333333-3333-4333-8333-333333333333",
        receiptUrl: "https://receipt.example/paid",
      },
    });
    expect(data.loadPaidRegistration).toHaveBeenCalledExactlyOnceWith(
      activePaidAccount.registrationId,
    );
    expect(data.createPhotoUrl).toHaveBeenCalledExactlyOnceWith("private/user-1/photo.jpg");
    expect(JSON.stringify(view)).not.toContain("52998224725");
    expect(JSON.stringify(view)).not.toContain("private/user-1/photo.jpg");
  });

  it("omits absent optional values and uses a neutral photo when signing fails", async () => {
    const sparse = {
      ...completeRegistration,
      city: null,
      email: null,
      institution: null,
      photo_path: "private/failing.jpg",
      pricing_type: null,
      receipt_url: null,
      role: null,
      voice_part: null,
    };
    const data = repository(activePaidAccount, sparse);
    vi.mocked(data.createPhotoUrl).mockRejectedValue(new Error("storage unavailable"));

    const view = await createParticipantRegistrationLoader(data).load({
      status: "authorized",
      accountId: activePaidAccount.accountId,
      registrationId: activePaidAccount.registrationId,
      userId: activePaidAccount.userId,
    });

    expect(view.identity.photoUrl).toBeNull();
    expect(view.identity).not.toHaveProperty("email");
    expect(view.registration).not.toHaveProperty("city");
    expect(view.registration).not.toHaveProperty("institution");
    expect(view.registration).not.toHaveProperty("pricingType");
    expect(view.registration).not.toHaveProperty("role");
    expect(view.registration).not.toHaveProperty("shirtSize");
    expect(view.registration).not.toHaveProperty("voicePart");
    expect(view.payment).not.toHaveProperty("receiptUrl");
    expect(JSON.stringify(view)).not.toContain("private/failing.jpg");
  });

  it("fails closed when the authorized paid registration cannot be reloaded", async () => {
    const data = repository(activePaidAccount, null);

    await expect(
      createParticipantRegistrationLoader(data).load({
        status: "authorized",
        accountId: activePaidAccount.accountId,
        registrationId: activePaidAccount.registrationId,
        userId: activePaidAccount.userId,
      }),
    ).rejects.toThrow("Não foi possível carregar os dados da inscrição.");
  });
});

describe("Supabase participant repository", () => {
  it("reads only confirmed complements belonging to the authorized registration across pages", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi
        .fn()
        .mockResolvedValueOnce({
          data: Array.from({ length: 500 }, () => ({ amount_cents: 10 })),
          error: null,
        })
        .mockResolvedValueOnce({ data: [{ amount_cents: 2000 }], error: null }),
    };
    from.mockReturnValue(builder);
    await expect(
      createSupabaseParticipantRepository().loadConfirmedComplementCents(
        activePaidAccount.registrationId,
      ),
    ).resolves.toBe(7000);
    expect(from).toHaveBeenCalledWith("registration_complement_payments");
    expect(builder.eq.mock.calls).toEqual([
      ["registration_id", activePaidAccount.registrationId],
      ["status", "paid"],
      ["registration_id", activePaidAccount.registrationId],
      ["status", "paid"],
    ]);
    expect(builder.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
  });
  it("rejects a failed ledger query instead of treating it as zero paid", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: "private failure" } }),
    };
    from.mockReturnValue(builder);
    await expect(
      createSupabaseParticipantRepository().loadConfirmedComplementCents(
        activePaidAccount.registrationId,
      ),
    ).rejects.toThrow("Não foi possível validar o acesso do participante.");
  });
  it("loads active regents only for the registration choir and avoids querying an absent choir", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ name: "João" }, { name: "João" }, { name: "Maria" }],
        error: null,
      }),
    };
    from.mockReturnValue(builder);
    const repo = createSupabaseParticipantRepository();
    await expect(repo.loadActiveRegentNames(null)).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
    await expect(repo.loadActiveRegentNames(completeRegistration.choir_id)).resolves.toEqual([
      "João",
      "Maria",
    ]);
    expect(builder.eq).toHaveBeenCalledExactlyOnceWith("choir_id", completeRegistration.choir_id);
    expect(builder.is).toHaveBeenCalledExactlyOnceWith("revoked_at", null);
  });
  function query(result: { data: Record<string, unknown> | null; error: unknown }) {
    const select = vi.fn();
    const eq = vi.fn();
    const maybeSingle = vi.fn(async () => result);
    const builder = { select, eq, maybeSingle };
    select.mockReturnValue(builder);
    eq.mockReturnValue(builder);
    return builder;
  }

  it("queries only the verified user's active account and its paid registration", async () => {
    const accountQuery = query({
      data: {
        id: activePaidAccount.accountId,
        registration_id: activePaidAccount.registrationId,
        user_id: activePaidAccount.userId,
        access_status: activePaidAccount.accessStatus,
      },
      error: null,
    });
    const registrationQuery = query({
      data: { id: activePaidAccount.registrationId, payment_status: "paid" },
      error: null,
    });
    from.mockImplementation((table) => {
      if (table === "participant_accounts") return accountQuery;
      if (table === "registrations") return registrationQuery;
      throw new Error(`Unexpected table: ${String(table)}`);
    });

    await expect(
      createSupabaseParticipantRepository().findAccessByUserId("user-1"),
    ).resolves.toEqual(activePaidAccount);

    expect(from.mock.calls).toEqual([["participant_accounts"], ["registrations"]]);
    expect(accountQuery.select).toHaveBeenCalledExactlyOnceWith(
      "id,registration_id,user_id,access_status",
    );
    expect(accountQuery.eq.mock.calls).toEqual([
      ["user_id", "user-1"],
      ["access_status", "active"],
    ]);
    expect(accountQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(registrationQuery.select).toHaveBeenCalledExactlyOnceWith("id,payment_status");
    expect(registrationQuery.eq.mock.calls).toEqual([
      ["id", activePaidAccount.registrationId],
      ["payment_status", "paid"],
    ]);
    expect(registrationQuery.maybeSingle).toHaveBeenCalledOnce();
  });

  it("stops after maybeSingle returns no active account", async () => {
    const accountQuery = query({ data: null, error: null });
    from.mockReturnValue(accountQuery);

    await expect(
      createSupabaseParticipantRepository().findAccessByUserId("user-1"),
    ).resolves.toBeNull();

    expect(from).toHaveBeenCalledExactlyOnceWith("participant_accounts");
    expect(accountQuery.maybeSingle).toHaveBeenCalledOnce();
  });

  it("returns no access when maybeSingle finds no paid linked registration", async () => {
    const accountQuery = query({
      data: {
        id: activePaidAccount.accountId,
        registration_id: activePaidAccount.registrationId,
        user_id: activePaidAccount.userId,
        access_status: activePaidAccount.accessStatus,
      },
      error: null,
    });
    const registrationQuery = query({ data: null, error: null });
    from.mockImplementation((table) =>
      table === "participant_accounts" ? accountQuery : registrationQuery,
    );

    await expect(
      createSupabaseParticipantRepository().findAccessByUserId("user-1"),
    ).resolves.toBeNull();

    expect(registrationQuery.maybeSingle).toHaveBeenCalledOnce();
  });

  it("creates a private photo URL for exactly 60 seconds", async () => {
    storageFrom.mockReturnValue({ createSignedUrl });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/photo" },
      error: null,
    });

    await expect(
      createSupabaseParticipantRepository().createPhotoUrl("private/photo.jpg"),
    ).resolves.toBe("https://signed.example/photo");
    expect(storageFrom).toHaveBeenCalledExactlyOnceWith("registration-photos");
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith("private/photo.jpg", 60);
  });

  it.each([
    ["a signing error", { data: null, error: { message: "storage unavailable" } }],
    ["a missing signed URL", { data: { signedUrl: null }, error: null }],
  ])("returns null for %s without exposing the private path", async (_case, response) => {
    storageFrom.mockReturnValue({ createSignedUrl });
    createSignedUrl.mockResolvedValue(response);
    const privatePath = "private/participant/photo.jpg";

    const result = await createSupabaseParticipantRepository().createPhotoUrl(privatePath);

    expect(result).toBeNull();
    expect(JSON.stringify(result)).not.toContain(privatePath);
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith(privatePath, 60);
  });
});

type MiddlewareHandler = (input: {
  context: Record<string, unknown>;
  next: (input: unknown) => Promise<unknown>;
}) => Promise<unknown>;

describe("participant middleware", () => {
  it("composes verified auth and resolves access only from context.userId", async () => {
    expect(requireParticipantAccess.options.middleware).toContain(requireSupabaseAuth);
    const requireActive = vi.fn(async () => ({
      status: "authorized" as const,
      accountId: activePaidAccount.accountId,
      registrationId: activePaidAccount.registrationId,
      userId: activePaidAccount.userId,
    }));
    vi.spyOn(participantAuth, "getParticipantAuthorizer").mockReturnValue({
      findAccess: vi.fn(),
      requireActive,
    });
    const handler = (requireParticipantAccess.options as { server: MiddlewareHandler }).server;

    await expect(
      handler({
        context: {
          userId: "user-1",
          registrationId: "44444444-4444-4444-8444-444444444444",
        },
        next: async (result) => result,
      }),
    ).resolves.toEqual({
      context: {
        participantAccess: {
          status: "authorized",
          accountId: activePaidAccount.accountId,
          registrationId: activePaidAccount.registrationId,
          userId: activePaidAccount.userId,
        },
      },
    });
    expect(requireActive).toHaveBeenCalledExactlyOnceWith("user-1");
  });
});
