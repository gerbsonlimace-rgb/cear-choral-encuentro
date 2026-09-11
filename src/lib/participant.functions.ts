import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ParticipantLoginResult } from "@/features/registration/participant-area.server";

const participantLoginSchema = z
  .object({
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    password: z.string().trim().min(6, "Informe CPF + data de nascimento.").max(60),
  })
  .strict();

export const loginParticipant = createServerFn({ method: "POST" })
  .validator(participantLoginSchema)
  .handler(async ({ data }): Promise<ParticipantLoginResult> => {
    const { loginParticipantWithCredentials } = await import(
      "@/features/registration/participant-area.server"
    );

    try {
      return await loginParticipantWithCredentials(data);
    } catch (caught) {
      console.error("[Participant area] login failed", {
        reason: caught instanceof Error ? caught.message : "unknown error",
      });
      return { ok: false, message: "Não foi possível entrar agora. Tente novamente." };
    }
  });
