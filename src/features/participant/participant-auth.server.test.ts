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
  include_shirt: true,
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
  shirt_price_cents: 5000,
  shirt_size: "M",
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
    ["with an unpaid registration", { ...activePaidAccount, paymentStatus: "pending" as const }],
    ["with a mismatched user", { ...activePaidAccount, userId: "other-user" }],
  ])("returns a neutral unavailable state %s", async (_case, row) => {
    const authorizer = createParticipantAuthorizer(repository(row));

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
        diocese: "Diocese de Quixadá",
        city: "Quixadá",
        institution: "Paróquia São José",
        role: "Regente",
        voicePart: "soprano",
        includeShirt: true,
        shirtSize: "M",
        pricingType: "promotional",
        standardPriceCents: 40000,
        registrationPriceCents: 30000,
        shirtPriceCents: 5000,
      },
      payment: {
        status: "paid",
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
      shirt_size: null,
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
