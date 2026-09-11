import { z } from "zod";

export type PortalAccess =
  | { role: "admin"; userId: string; email: string | null }
  | {
      role: "regent";
      userId: string;
      membershipId: string;
      choirId: string;
      choirName: string;
      name: string;
      email: string;
      passwordChangeRequired: boolean;
    };

export type RegentAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "password_change_required"; role: "regent"; choirId: string }
  | { status: "authorized"; role: "admin"; email: string | null }
  | {
      status: "authorized";
      role: "regent";
      choirId: string;
      choirName: string;
      name: string;
      email: string;
    };

const choirSelectionIdSchema = z
  .string({ required_error: "Selecione um coro válido." })
  .uuid("Selecione um coro válido.");

export const regentIdSchema = z.string().uuid();

export const regentMutationSchema = z
  .object({
    choirId: choirSelectionIdSchema,
    name: z.string().trim().min(2, "Informe o nome do regente.").max(120),
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  })
  .strict();

export const portalChoirSelectionSchema = z.object({ choirId: choirSelectionIdSchema }).strict();

export type RegentMutation = z.infer<typeof regentMutationSchema>;
export type PortalChoirSelection = z.infer<typeof portalChoirSelectionSchema>;

export function resolveAuthorizedChoir(access: PortalAccess, requestedChoirId?: string): string {
  if (access.role === "regent") return access.choirId;
  return choirSelectionIdSchema.parse(requestedChoirId);
}
