import { describe, expect, it, vi } from "vitest";

const { load, startCheckout, reconcilePaymentForAccess } = vi.hoisted(() => ({
  load: vi.fn(),
  startCheckout: vi.fn(),
  reconcilePaymentForAccess: vi.fn(),
}));
vi.mock("@/features/participant/participant-auth.server", () => ({
  getParticipantRegistrationLoader: () => ({ load }),
}));
vi.mock("@/features/regent/regent-payment.server", () => ({
  getRegentPaymentService: () => ({ startCheckout, reconcilePaymentForAccess }),
}));
vi.mock("@tanstack/react-start", async (original) => ({
  ...(await original<typeof import("@tanstack/react-start")>()),
  createServerFn: ({ method }: { method: string }) => {
    const middlewares: unknown[] = [];
    const builder = {
      middleware(value: unknown[]) {
        middlewares.push(...value);
        return builder;
      },
      validator() {
        return builder;
      },
      handler(fn: unknown) {
        return Object.assign(fn as object, { method, middlewares });
      },
    };
    return builder;
  },
}));
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import {
  startParticipantBalanceCheckout,
  verifyParticipantBalancePayment,
} from "./participant-payment.functions";

const access = {
  status: "authorized",
  userId: "own-user",
  registrationId: "own-registration",
  accountId: "own-account",
};
type Fn = { (input: unknown): Promise<unknown>; method: string; middlewares: unknown[] };

describe("participant payment boundaries", () => {
  it("uses middleware identity and server profile, ignoring hostile request amounts and IDs", async () => {
    load.mockResolvedValue({ identity: { name: "Maria" } });
    startCheckout.mockResolvedValue({
      orderNsu: "order",
      checkoutUrl: "https://checkout.infinitepay.com.br/pay",
    });
    const fn = startParticipantBalanceCheckout as unknown as Fn;
    await fn({
      context: { participantAccess: access },
      data: { registrationId: "victim", amountCents: 1, userId: "victim" },
    });
    expect(fn.method).toBe("POST");
    expect(fn.middlewares).toContain(requireParticipantAccess);
    expect(load).toHaveBeenCalledWith(access);
    expect(startCheckout).toHaveBeenCalledWith(
      { registrationId: "own-registration" },
      {
        role: "participant",
        registrationId: "own-registration",
        userId: "own-user",
        name: "Maria",
      },
    );
  });
  it("verifies provider returns only with the authenticated registration scope", async () => {
    const fn = verifyParticipantBalancePayment as unknown as Fn;
    const lookup = {
      orderNsu: "11111111-1111-4111-8111-111111111111",
      transactionNsu: "transaction",
      slug: "slug",
    };
    await fn({ context: { participantAccess: access }, data: lookup });
    expect(fn.middlewares).toContain(requireParticipantAccess);
    expect(reconcilePaymentForAccess).toHaveBeenCalledWith(
      lookup,
      expect.objectContaining({
        role: "participant",
        registrationId: "own-registration",
        userId: "own-user",
      }),
    );
  });
});
