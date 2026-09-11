import { describe, expect, it, vi } from "vitest";

import {
  createRegistrationResumeHandler,
  getRegistrationCheckoutFailureMessage,
  resumeRegistrationCheckout,
} from "./registration.functions";

describe("registration resume server function", () => {
  it("uses POST and validates and normalizes identity before invoking the service", async () => {
    const resumeCheckout = vi.fn(async () => ({
      status: "pending" as const,
      checkoutUrl: "https://checkout.infinitepay.com.br/existing",
    }));
    const resume = createRegistrationResumeHandler({ resumeCheckout });

    await expect(resume({ cpf: "529.982.247-25", birthDate: "1990-05-12" })).resolves.toEqual({
      status: "pending",
      checkoutUrl: "https://checkout.infinitepay.com.br/existing",
    });
    expect(resumeCheckout).toHaveBeenCalledWith({
      cpf: "52998224725",
      birthDate: "1990-05-12",
    });
    expect(resumeRegistrationCheckout.method).toBe("POST");
  });

  it("rejects invalid identity before the service can inspect registrations", async () => {
    const resumeCheckout = vi.fn();
    const resume = createRegistrationResumeHandler({ resumeCheckout });

    await expect(resume({ cpf: "111.111.111-11", birthDate: "1990-05-12" })).rejects.toMatchObject({
      name: "ZodError",
    });
    expect(resumeCheckout).not.toHaveBeenCalled();
  });

  it("preserves the stable CPF-conflict guidance in the checkout result", () => {
    expect(
      getRegistrationCheckoutFailureMessage(
        new Error("Já existe uma inscrição para este CPF. Use Retomar pagamento."),
      ),
    ).toBe("Já existe uma inscrição para este CPF. Use Retomar pagamento.");
  });
});
