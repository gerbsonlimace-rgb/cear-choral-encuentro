import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const registrationRoleSchema = z.enum([
  "participant",
  "listener",
  "musician",
  "choir_member",
]);

export type RegistrationRole = z.infer<typeof registrationRoleSchema>;

export const registrationSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório" })
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .trim()
    .email("E-mail inválido")
    .max(255, "E-mail deve ter no máximo 255 caracteres"),
  phone: z
    .string({ required_error: "Telefone é obrigatório" })
    .trim()
    .min(8, "Telefone deve ter pelo menos 8 caracteres")
    .max(30, "Telefone deve ter no máximo 30 caracteres"),
  city: z
    .string({ required_error: "Cidade é obrigatória" })
    .trim()
    .min(2, "Cidade deve ter pelo menos 2 caracteres")
    .max(100, "Cidade deve ter no máximo 100 caracteres"),
  institution: z
    .string()
    .trim()
    .max(200, "Instituição deve ter no máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  role: registrationRoleSchema,
  observations: z
    .string()
    .trim()
    .max(1000, "Observações devem ter no máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((data) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("registrations").insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      institution: data.institution || null,
      role: data.role,
      observations: data.observations || null,
    });

    if (error) {
      console.error("[submitRegistration] insert error:", error);
      throw new Error("Não foi possível salvar sua inscrição. Tente novamente em alguns instantes.");
    }

    return { success: true };
  });
