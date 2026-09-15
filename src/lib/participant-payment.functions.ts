import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireParticipantAccess } from "@/features/participant/participant-auth.middleware";
import { paymentLookupSchema } from "@/features/registration/registration.domain";

export type ParticipantBalanceCheckoutResult =
  | { ok: true; checkoutUrl: string; orderNsu: string }
  | {
      ok: false;
      code: "open_payment" | "already_paid" | "unavailable";
      message: string;
    };

export const startParticipantBalanceCheckout = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess])
  .validator(z.object({}).strict())
  .handler(async ({ context }): Promise<ParticipantBalanceCheckoutResult> => {
    const { getParticipantRegistrationLoader } =
      await import("@/features/participant/participant-auth.server");
    const { getRegentPaymentService } = await import("@/features/regent/regent-payment.server");
    const access = context.participantAccess;
    const participant = await getParticipantRegistrationLoader().load(access);
    try {
      const checkout = await getRegentPaymentService().startCheckout(
        { registrationId: access.registrationId },
        {
          role: "participant",
          userId: access.userId,
          registrationId: access.registrationId,
          name: participant.identity.name,
        },
      );
      return { ok: true, ...checkout };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      return {
        ok: false,
        code:
          message === "Já existe um pagamento complementar em aberto."
            ? "open_payment"
            : message === "O complemento desta inscrição já está quitado."
              ? "already_paid"
              : "unavailable",
        message:
          message === "Já existe um pagamento complementar em aberto."
            ? "Já existe um pagamento em aberto. Aguarde a confirmação ou consulte seu regente."
            : message === "O complemento desta inscrição já está quitado."
              ? "Seu saldo já foi quitado. Atualize os valores."
              : "Não foi possível preparar o pagamento. Atualize os valores e tente novamente. Se você já pagou, aguarde a confirmação.",
      };
    }
  });

export const verifyParticipantBalancePayment = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess])
  .validator(paymentLookupSchema)
  .handler(async ({ context, data }) => {
    const { getRegentPaymentService } = await import("@/features/regent/regent-payment.server");
    const access = context.participantAccess;
    return getRegentPaymentService().reconcilePaymentForAccess(data, {
      role: "participant",
      userId: access.userId,
      registrationId: access.registrationId,
      name: "Participante",
    });
  });
