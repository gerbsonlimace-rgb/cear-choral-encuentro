import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { RegentMutation } from "./regent.domain";

export type AdminRegentRow = RegentMutation & {
  id: string;
  userId: string;
  passwordChangeRequired: boolean;
  revokedAt: string | null;
};
export type RegentCreation = RegentMutation & { password: string };
export type RegentAdminResult =
  | { status: "success"; regent: AdminRegentRow }
  | { status: "conflict" | "error"; message: string };
type RegentGrant = RegentMutation & {
  userId: string;
  grantedBy: string;
  passwordChangeRequired: true;
};
export type RegentAdminRepository = {
  list(): Promise<AdminRegentRow[]>;
  findById(id: string): Promise<AdminRegentRow | null>;
  findActiveByChoir(choirId: string): Promise<AdminRegentRow | null>;
  grant(input: RegentGrant): Promise<AdminRegentRow>;
  replace(input: RegentGrant): Promise<AdminRegentRow>;
  revoke(id: string, actorId: string): Promise<AdminRegentRow>;
  requirePasswordChange(id: string): Promise<AdminRegentRow>;
};
export type RegentAuthAdminPort = {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: {
    email: string;
    password: string;
    emailConfirm: true;
  }): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  updateUserById(userId: string, input: { password: string }): Promise<void>;
};

const failure = (): RegentAdminResult => ({
  status: "error",
  message: "Não foi possível concluir a operação. Tente novamente.",
});
const success = (regent: AdminRegentRow): RegentAdminResult => ({ status: "success", regent });
class RegentConflict extends Error {}

export function createRegentAdminService({
  repository,
  auth,
}: {
  repository: RegentAdminRepository;
  auth: RegentAuthAdminPort;
}) {
  async function provision(
    input: RegentCreation,
    actorId: string,
    replace: boolean,
  ): Promise<RegentAdminResult> {
    let createdUserId: string | undefined;
    try {
      if (await auth.findUserByEmail(input.email)) {
        return {
          status: "conflict",
          message: "Já existe uma conta com esse e-mail. Use outro e-mail.",
        };
      }
      if (!replace && (await repository.findActiveByChoir(input.choirId))) {
        return {
          status: "conflict",
          message: "Este coro já possui um regente ativo. Use Substituir.",
        };
      }
      const user = await auth.createUser({
        email: input.email,
        password: input.password,
        emailConfirm: true,
      });
      createdUserId = user.id;
      const grant: RegentGrant = {
        choirId: input.choirId,
        name: input.name,
        email: input.email,
        userId: user.id,
        grantedBy: actorId,
        passwordChangeRequired: true,
      };
      return success(await (replace ? repository.replace(grant) : repository.grant(grant)));
    } catch (error) {
      if (createdUserId) {
        try {
          await auth.deleteUser(createdUserId);
        } catch {
          return {
            status: "error",
            message:
              "O vínculo não foi concluído e a conta criada precisa de revisão por um administrador. Não repita o cadastro com outro e-mail.",
          };
        }
      }
      return error instanceof RegentConflict
        ? {
            status: "conflict",
            message:
              "Já existe uma conta ou vínculo ativo. Atualize a lista antes de tentar novamente.",
          }
        : failure();
    }
  }
  return {
    async list() {
      try {
        return await repository.list();
      } catch {
        throw new Error("Não foi possível carregar os regentes.");
      }
    },
    create: (input: RegentCreation, actorId: string) => provision(input, actorId, false),
    replace: (input: RegentCreation, actorId: string) => provision(input, actorId, true),
    async revoke(id: string, actorId: string): Promise<RegentAdminResult> {
      try {
        return success(await repository.revoke(id, actorId));
      } catch {
        return failure();
      }
    },
    async resetPassword(id: string, password: string): Promise<RegentAdminResult> {
      try {
        const regent = await repository.findById(id);
        if (!regent || regent.revokedAt)
          return { status: "error", message: "O regente não está ativo. Atualize a lista." };
        // Fail closed: never install a temporary password before the portal gate is set.
        const updated = await repository.requirePasswordChange(id);
        await auth.updateUserById(regent.userId, { password });
        return success(updated);
      } catch {
        return failure();
      }
    },
  };
}

type RegentRow = Database["public"]["Tables"]["choir_regents"]["Row"];
const columns = "id,user_id,choir_id,name,email,password_change_required,revoked_at" as const;
function mapRow(
  row: Pick<
    RegentRow,
    "id" | "user_id" | "choir_id" | "name" | "email" | "password_change_required" | "revoked_at"
  >,
): AdminRegentRow {
  return {
    id: row.id,
    userId: row.user_id,
    choirId: row.choir_id,
    name: row.name,
    email: row.email,
    passwordChangeRequired: row.password_change_required,
    revokedAt: row.revoked_at,
  };
}
function checkError(error: { code?: string } | null) {
  if (!error) return;
  if (["23505", "email_exists", "user_already_exists"].includes(error.code ?? ""))
    throw new RegentConflict();
  throw new Error("Regent operation failed");
}

export function createSupabaseRegentAdminRepository(): RegentAdminRepository {
  async function returning(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>) {
    const { data, error } = await query;
    checkError(error);
    if (!data) throw new Error("Regent not found");
    return mapRow(data as RegentRow);
  }
  return {
    async list() {
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select(columns)
        .order("name");
      checkError(error);
      return (data ?? []).map(mapRow);
    },
    async findById(id) {
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      checkError(error);
      return data ? mapRow(data) : null;
    },
    async findActiveByChoir(choirId) {
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select(columns)
        .eq("choir_id", choirId)
        .is("revoked_at", null)
        .maybeSingle();
      checkError(error);
      return data ? mapRow(data) : null;
    },
    grant(input) {
      return returning(
        supabaseAdmin
          .from("choir_regents")
          .insert({
            choir_id: input.choirId,
            user_id: input.userId,
            name: input.name,
            email: input.email,
            granted_by: input.grantedBy,
            password_change_required: true,
          })
          .select(columns)
          .single(),
      );
    },
    replace(input) {
      return returning(
        supabaseAdmin.rpc("replace_active_choir_regent", {
          p_choir_id: input.choirId,
          p_user_id: input.userId,
          p_name: input.name,
          p_email: input.email,
          p_granted_by: input.grantedBy,
        }),
      );
    },
    revoke(id, actorId) {
      return returning(
        supabaseAdmin
          .from("choir_regents")
          .update({ revoked_at: new Date().toISOString(), revoked_by: actorId })
          .eq("id", id)
          .is("revoked_at", null)
          .select(columns)
          .single(),
      );
    },
    requirePasswordChange(id) {
      return returning(
        supabaseAdmin
          .from("choir_regents")
          .update({ password_change_required: true })
          .eq("id", id)
          .is("revoked_at", null)
          .select(columns)
          .single(),
      );
    },
  };
}

export function createSupabaseRegentAuthAdmin(): RegentAuthAdminPort {
  return {
    async findUserByEmail(email) {
      let page = 1;
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        checkError(error);
        const match = data.users.find(
          (user) => user.email?.trim().toLowerCase() === email.trim().toLowerCase(),
        );
        if (match) return { id: match.id };
        if (!("nextPage" in data) || !data.nextPage) return null;
        page = data.nextPage;
      }
    },
    async createUser({ email, password, emailConfirm }) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: emailConfirm,
      });
      checkError(error);
      if (!data.user) throw new Error("Auth user not created");
      return { id: data.user.id };
    },
    async deleteUser(userId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      checkError(error);
    },
    async updateUserById(userId, input) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, input);
      checkError(error);
      if (!data.user) throw new Error("Auth user not updated");
    },
  };
}

export function getRegentAdminService() {
  return createRegentAdminService({
    repository: createSupabaseRegentAdminRepository(),
    auth: createSupabaseRegentAuthAdmin(),
  });
}
