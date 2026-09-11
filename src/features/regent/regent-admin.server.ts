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
  findByUserAndChoir(userId: string, choirId: string): Promise<AdminRegentRow | null>;
  grant(input: RegentGrant): Promise<AdminRegentRow>;
  replace(input: RegentGrant): Promise<AdminRegentRow>;
  revoke(id: string, actorId: string): Promise<AdminRegentRow>;
  claimPasswordOperation(id: string, userId: string, kind: "admin", hash: string): Promise<boolean>;
  getPasswordOperation(
    id: string,
    userId: string,
  ): Promise<{ kind: "admin" | "regent"; hash: string } | null>;
  finishPasswordOperation(
    id: string,
    userId: string,
    kind: "admin",
    hash: string,
  ): Promise<AdminRegentRow>;
  finishRegentPasswordOperation(id: string, userId: string, hash: string): Promise<void>;
  releasePasswordOperation(id: string, userId: string, kind: "admin", hash: string): Promise<void>;
};
export type RegentAuthAdminPort = {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: {
    email: string;
    password: string;
    emailConfirm: true;
  }): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  inspectUser(userId: string): Promise<{ appMetadata: Record<string, unknown> }>;
  updateUserById(
    userId: string,
    input: { password: string; appMetadata: Record<string, unknown> },
  ): Promise<"updated" | "rejected" | "unknown">;
};

const failure = (): RegentAdminResult => ({
  status: "error",
  message: "Não foi possível concluir a operação. Tente novamente.",
});
const success = (regent: AdminRegentRow): RegentAdminResult => ({ status: "success", regent });
const reviewRequired = (): RegentAdminResult => ({
  status: "error",
  message:
    "O estado da conta criada precisa de revisão por um administrador. Atualize a lista e não repita o cadastro com outro e-mail.",
});
class RegentConflict extends Error {}
export class RegentGrantFailure extends Error {
  constructor(
    readonly outcome: "confirmed_rejection" | "unknown",
    readonly conflict = false,
  ) {
    super("Regent grant was not confirmed");
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashOperationToken(token: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

function createOperationToken() {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

function passwordOperationProof(id: string, kind: "admin" | "regent", hash: string) {
  return { kind, membership_id: id, operation_hash: hash } as const;
}

function hasPasswordOperationProof(
  metadata: Record<string, unknown>,
  proof: ReturnType<typeof passwordOperationProof>,
) {
  const value = metadata.regent_password_operation;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === proof.kind &&
    candidate.membership_id === proof.membership_id &&
    candidate.operation_hash === proof.operation_hash
  );
}

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
          // A transport error may follow a committed grant/replacement. Reconcile
          // against the database before considering deletion of its Auth identity.
          const membership = await repository.findByUserAndChoir(createdUserId, input.choirId);
          if (membership) {
            return membership.revokedAt === null &&
              membership.userId === createdUserId &&
              membership.choirId === input.choirId
              ? success(membership)
              : reviewRequired();
          }
          // An empty read cannot prove an in-flight write rolled back. Only a
          // completed, authoritative database rejection permits compensation.
          if (!(error instanceof RegentGrantFailure) || error.outcome !== "confirmed_rejection") {
            return reviewRequired();
          }
          await auth.deleteUser(createdUserId);
        } catch {
          return reviewRequired();
        }
      }
      return error instanceof RegentConflict ||
        (error instanceof RegentGrantFailure && error.conflict)
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
      let claimedByThisCall = false;
      let authProven = false;
      let regent: AdminRegentRow | null = null;
      let hash = "";
      try {
        regent = await repository.findById(id);
        if (!regent || regent.revokedAt)
          return { status: "error", message: "O regente não está ativo. Atualize a lista." };

        hash = await hashOperationToken(createOperationToken());
        let claimResponseUnknown = false;
        try {
          claimedByThisCall = await repository.claimPasswordOperation(
            id,
            regent.userId,
            "admin",
            hash,
          );
        } catch {
          claimResponseUnknown = true;
        }

        if (!claimedByThisCall) {
          const current = await repository.getPasswordOperation(id, regent.userId);
          if (!current) return failure();
          if (claimResponseUnknown && current.kind === "admin" && current.hash === hash) {
            claimedByThisCall = true;
          } else {
            const authUser = await auth.inspectUser(regent.userId);
            const proof = passwordOperationProof(id, current.kind, current.hash);
            if (!hasPasswordOperationProof(authUser.appMetadata, proof)) return failure();
            try {
              if (current.kind === "admin") {
                await repository.finishPasswordOperation(id, regent.userId, "admin", current.hash);
              } else {
                await repository.finishRegentPasswordOperation(id, regent.userId, current.hash);
              }
            } catch {
              const remaining = await repository.getPasswordOperation(id, regent.userId);
              if (remaining?.kind === current.kind && remaining.hash === current.hash) {
                return failure();
              }
            }

            claimResponseUnknown = false;
            try {
              claimedByThisCall = await repository.claimPasswordOperation(
                id,
                regent.userId,
                "admin",
                hash,
              );
            } catch {
              claimResponseUnknown = true;
            }
            if (!claimedByThisCall) {
              const retried = await repository.getPasswordOperation(id, regent.userId);
              if (!claimResponseUnknown || retried?.kind !== "admin" || retried.hash !== hash) {
                return failure();
              }
              claimedByThisCall = true;
            }
          }
        }

        let authUser = await auth.inspectUser(regent.userId);
        const proof = passwordOperationProof(id, "admin", hash);
        authProven = hasPasswordOperationProof(authUser.appMetadata, proof);

        if (!authProven) {
          const updateOutcome = await auth.updateUserById(regent.userId, {
            password,
            appMetadata: {
              ...authUser.appMetadata,
              regent_password_operation: proof,
            },
          });
          if (updateOutcome === "updated") {
            authProven = true;
          } else {
            try {
              authUser = await auth.inspectUser(regent.userId);
              authProven = hasPasswordOperationProof(authUser.appMetadata, proof);
            } catch {
              authProven = false;
            }
            if (!authProven) {
              if (updateOutcome === "rejected" && claimedByThisCall) {
                await repository.releasePasswordOperation(id, regent.userId, "admin", hash);
                claimedByThisCall = false;
              }
              return failure();
            }
          }
        }

        return success(await repository.finishPasswordOperation(id, regent.userId, "admin", hash));
      } catch {
        if (claimedByThisCall && !authProven && regent && hash) {
          try {
            await repository.releasePasswordOperation(id, regent.userId, "admin", hash);
          } catch {
            // Fail closed. An exact in-flight operation is never replaced by another caller.
          }
        }
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
  type QueryResult = { data: unknown; error: { code?: string } | null };
  async function returning(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>) {
    const { data, error } = await query;
    checkError(error);
    if (!data) throw new Error("Regent not found");
    return mapRow(data as RegentRow);
  }
  async function returningGrant(query: PromiseLike<QueryResult>) {
    let response: QueryResult;
    try {
      response = await query;
    } catch {
      // Thrown errors do not establish whether the statement has completed.
      throw new RegentGrantFailure("unknown");
    }
    if (response.error) {
      // These SQLSTATEs confirm statement rejection/rollback. Transport errors,
      // PostgREST response-shaping errors and unknown-completion SQLSTATEs do not.
      const confirmed = [
        "23502",
        "23503",
        "23505",
        "23514",
        "42501",
        "P0001",
        "40001",
        "40P01",
        "57014",
      ].includes(response.error.code ?? "");
      throw new RegentGrantFailure(
        confirmed ? "confirmed_rejection" : "unknown",
        confirmed && response.error.code === "23505",
      );
    }
    if (!response.data) throw new RegentGrantFailure("unknown");
    return mapRow(response.data as RegentRow);
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
    async findByUserAndChoir(userId, choirId) {
      // Include revoked history: an existing association must never be mistaken
      // for a failed grant just because another operation revoked it meanwhile.
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select(columns)
        .eq("user_id", userId)
        .eq("choir_id", choirId)
        .maybeSingle();
      checkError(error);
      return data ? mapRow(data) : null;
    },
    grant(input) {
      return returningGrant(
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
      return returningGrant(
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
    async claimPasswordOperation(id, userId, kind, hash) {
      const { data, error } = await supabaseAdmin.rpc("claim_choir_regent_password_operation", {
        p_membership_id: id,
        p_user_id: userId,
        p_operation_kind: kind,
        p_operation_hash: hash,
      });
      checkError(error);
      return data === true;
    },
    async getPasswordOperation(id, userId) {
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select("password_change_operation_kind,password_change_retry_token_hash")
        .eq("id", id)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .maybeSingle();
      checkError(error);
      const kind = data?.password_change_operation_kind;
      const hash = data?.password_change_retry_token_hash;
      if ((kind !== "admin" && kind !== "regent") || !hash) return null;
      return { kind, hash };
    },
    async finishPasswordOperation(id, userId, kind, hash) {
      const { data, error } = await supabaseAdmin.rpc("finish_choir_regent_password_operation", {
        p_membership_id: id,
        p_user_id: userId,
        p_operation_kind: kind,
        p_operation_hash: hash,
      });
      checkError(error);
      if (!data) throw new Error("Password operation could not be finished");
      const updated = await this.findById(id);
      if (!updated || updated.revokedAt || !updated.passwordChangeRequired) {
        throw new Error("Password operation final state unavailable");
      }
      return updated;
    },
    async finishRegentPasswordOperation(id, userId, hash) {
      const { data, error } = await supabaseAdmin.rpc("finish_choir_regent_password_operation", {
        p_membership_id: id,
        p_user_id: userId,
        p_operation_kind: "regent",
        p_operation_hash: hash,
      });
      checkError(error);
      if (!data) throw new Error("Regent password operation could not be finished");
    },
    async releasePasswordOperation(id, userId, kind, hash) {
      const { error } = await supabaseAdmin.rpc("release_choir_regent_password_operation", {
        p_membership_id: id,
        p_user_id: userId,
        p_operation_kind: kind,
        p_operation_hash: hash,
      });
      checkError(error);
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
    async inspectUser(userId) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !data.user) throw new Error("Regent Auth user unavailable");
      return { appMetadata: data.user.app_metadata ?? {} };
    },
    async updateUserById(userId, input) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: input.password,
          app_metadata: input.appMetadata,
        });
        if (!error && data.user) return "updated";
        return error?.status && error.status < 500 ? "rejected" : "unknown";
      } catch {
        return "unknown";
      }
    },
  };
}

export function getRegentAdminService() {
  return createRegentAdminService({
    repository: createSupabaseRegentAdminRepository(),
    auth: createSupabaseRegentAuthAdmin(),
  });
}
