import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import { requirePortalAccess } from "@/features/regent/regent-auth.middleware";
import { regentIdSchema, regentMutationSchema } from "@/features/regent/regent.domain";
import {
  portalChoirSelectionSchema,
  resolveAuthorizedChoir,
  type PortalAccess,
  type RegentAccess,
} from "@/features/regent/regent.domain";
import type { PortalAccessProbe } from "@/features/regent/regent-auth.server";

export function toRegentAccessState(probe: PortalAccessProbe): RegentAccess {
  if (!probe.authenticated) return { status: "unauthenticated" };
  if (!probe.access) return { status: "forbidden" };
  if (probe.access.role === "admin") return { status: "authorized", role: "admin" };
  return {
    status: probe.access.passwordChangeRequired ? "password_change_required" : "authorized",
    role: "regent",
    choirId: probe.access.choirId,
  };
}

// Call only with access supplied by portal middleware, never request data.
export function resolvePortalChoirSelection(access: PortalAccess, input: unknown): string {
  if (access.role === "regent") return resolveAuthorizedChoir(access);
  return resolveAuthorizedChoir(access, portalChoirSelectionSchema.parse(input).choirId);
}

export const getRegentAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { getPortalRequestAccess } = await import("@/features/regent/regent-auth.server");
  return toRegentAccessState(await getPortalRequestAccess());
});

type RegentPortalAccess = Extract<PortalAccess, { role: "regent" }>;

export type RegentPasswordChangeRepository = {
  armRetryProof(access: RegentPortalAccess, hash: string): Promise<boolean>;
  clearRetryProof(access: RegentPortalAccess, hash: string): Promise<void>;
  completeWithProof(access: RegentPortalAccess, hash: string): Promise<boolean>;
  getPasswordOperation(
    access: RegentPortalAccess,
  ): Promise<{ kind: "admin" | "regent"; hash: string } | null>;
  isCompleted(access: RegentPortalAccess): Promise<boolean>;
};

type PasswordOperationProof = {
  kind: "regent";
  membership_id: string;
  operation_hash: string;
};

type RegentPasswordAuth = {
  inspectUser(userId: string): Promise<{ email: string; appMetadata: Record<string, unknown> }>;
  passwordMatches(email: string, password: string): Promise<"matches" | "different" | "unknown">;
  updateUserById(
    userId: string,
    attributes: { password: string; appMetadata: Record<string, unknown> },
  ): Promise<"updated" | "rejected" | "unknown">;
};

type RegentPasswordProofs = {
  hash(token: string): Promise<string>;
};

export type RegentPasswordChangeResult =
  | { status: "success" }
  | { status: "completion_required"; retryToken: string };

const passwordChangeError = "Não foi possível alterar a senha.";
const passwordCompletionError = "Não foi possível concluir a alteração de senha.";

function requireRegentAccess(access: PortalAccess, message: string): RegentPortalAccess {
  if (access.role !== "regent") throw new Error(message);
  return access;
}

function operationProof(access: RegentPortalAccess, hash: string): PasswordOperationProof {
  return { kind: "regent", membership_id: access.membershipId, operation_hash: hash };
}

function hasOperationProof(metadata: Record<string, unknown>, proof: PasswordOperationProof) {
  const value = metadata.regent_password_operation;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === proof.kind &&
    candidate.membership_id === proof.membership_id &&
    candidate.operation_hash === proof.operation_hash
  );
}

export function createRegentPasswordChangeService({
  repository,
  auth,
  proofs,
}: {
  repository: RegentPasswordChangeRepository;
  auth: RegentPasswordAuth;
  proofs: RegentPasswordProofs;
}) {
  async function isCompleted(access: RegentPortalAccess) {
    try {
      return await repository.isCompleted(access);
    } catch {
      return false;
    }
  }

  async function releaseOwnedClaim(access: RegentPortalAccess, hash: string, owned: boolean) {
    if (!owned) return;
    try {
      await repository.clearRetryProof(access, hash);
    } catch {
      // Fail closed. Only this exact operation was targeted and a surviving claim
      // keeps later administrator/regent password writes serialized.
    }
  }

  return {
    async change(
      accessInput: PortalAccess,
      password: string,
      operationToken: string,
    ): Promise<RegentPasswordChangeResult> {
      const access = requireRegentAccess(accessInput, passwordChangeError);
      let hash: string;
      try {
        hash = await proofs.hash(operationToken);
      } catch {
        throw new Error(passwordChangeError);
      }

      let claimedByThisCall = false;
      try {
        claimedByThisCall = await repository.armRetryProof(access, hash);
      } catch {
        // A transport failure can follow a committed claim; reconcile below.
      }
      if (!claimedByThisCall) {
        let currentOperation: Awaited<
          ReturnType<RegentPasswordChangeRepository["getPasswordOperation"]>
        >;
        try {
          currentOperation = await repository.getPasswordOperation(access);
        } catch {
          throw new Error(passwordChangeError);
        }
        if (currentOperation?.kind !== "regent" || currentOperation.hash !== hash) {
          throw new Error(passwordChangeError);
        }
      }

      const proof = operationProof(access, hash);
      let authUser: Awaited<ReturnType<RegentPasswordAuth["inspectUser"]>>;
      try {
        authUser = await auth.inspectUser(access.userId);
      } catch {
        await releaseOwnedClaim(access, hash, claimedByThisCall);
        throw new Error(passwordChangeError);
      }

      if (!hasOperationProof(authUser.appMetadata, proof)) {
        const match = await auth.passwordMatches(authUser.email, password);
        if (match !== "different") {
          await releaseOwnedClaim(access, hash, claimedByThisCall);
          throw new Error(passwordChangeError);
        }

        const updateOutcome = await auth.updateUserById(access.userId, {
          password,
          appMetadata: {
            ...authUser.appMetadata,
            regent_password_operation: proof,
          },
        });
        if (updateOutcome !== "updated") {
          try {
            authUser = await auth.inspectUser(access.userId);
          } catch {
            authUser = { email: authUser.email, appMetadata: {} };
          }
          if (!hasOperationProof(authUser.appMetadata, proof)) {
            // A confirmed rejection cannot have applied either the password or
            // the metadata proof. Unknown outcomes stay locked because the Auth
            // write may still commit after this response.
            if (updateOutcome === "rejected") {
              await releaseOwnedClaim(access, hash, claimedByThisCall);
            }
            throw new Error(passwordChangeError);
          }
        }
      }

      try {
        if (await repository.completeWithProof(access, hash)) return { status: "success" };
      } catch {
        // Reconcile below because the update response may have been lost after commit.
      }
      if (await isCompleted(access)) return { status: "success" };
      return { status: "completion_required", retryToken: operationToken };
    },

    async complete(accessInput: PortalAccess, retryToken: string) {
      const access = requireRegentAccess(accessInput, passwordCompletionError);
      let hash: string;
      try {
        hash = await proofs.hash(retryToken);
        const authUser = await auth.inspectUser(access.userId);
        if (!hasOperationProof(authUser.appMetadata, operationProof(access, hash))) {
          throw new Error("Auth proof does not match");
        }
        if (await repository.completeWithProof(access, hash)) return { status: "success" as const };
      } catch {
        // Reconcile below because the update response may have been lost after commit.
      }
      if (await isCompleted(access)) return { status: "success" as const };
      throw new Error(passwordCompletionError);
    },
  };
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashRetryToken(token: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

const passwordProofs: RegentPasswordProofs = {
  hash: hashRetryToken,
};

export function createSupabaseRegentPasswordChangeRepository(): RegentPasswordChangeRepository {
  return {
    async armRetryProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("claim_choir_regent_password_operation", {
        p_membership_id: access.membershipId,
        p_user_id: access.userId,
        p_operation_kind: "regent",
        p_operation_hash: hash,
      });
      if (error) throw new Error("Password proof could not be armed");
      return data;
    },
    async clearRetryProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("release_choir_regent_password_operation", {
        p_membership_id: access.membershipId,
        p_user_id: access.userId,
        p_operation_kind: "regent",
        p_operation_hash: hash,
      });
      if (error) throw new Error("Password proof could not be cleared");
    },
    async completeWithProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("finish_choir_regent_password_operation", {
        p_membership_id: access.membershipId,
        p_user_id: access.userId,
        p_operation_kind: "regent",
        p_operation_hash: hash,
      });
      if (error) throw new Error("Password completion failed");
      return data;
    },
    async getPasswordOperation(access) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select("password_change_operation_kind,password_change_retry_token_hash")
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw new Error("Password operation could not be reconciled");
      const kind = data?.password_change_operation_kind;
      const hash = data?.password_change_retry_token_hash;
      if ((kind !== "admin" && kind !== "regent") || !hash) return null;
      return { kind, hash };
    },
    async isCompleted(access) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .select("id,password_change_required")
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .is("revoked_at", null)
        .maybeSingle();
      if (error || !data) throw new Error("Password completion could not be reconciled");
      return data.password_change_required === false;
    },
  };
}

export function createSupabaseRegentPasswordAuth(): RegentPasswordAuth {
  return {
    async inspectUser(userId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = data.user?.email;
      if (error || !email) throw new Error("Password Auth user unavailable");
      return { email, appMetadata: data.user.app_metadata ?? {} };
    },
    async passwordMatches(email, password) {
      const { createSupabaseAdminClient } = await import("@/integrations/supabase/client.server");
      const probe = createSupabaseAdminClient();
      try {
        const { data, error } = await probe.auth.signInWithPassword({ email, password });
        if (data.session) {
          try {
            await probe.auth.signOut({ scope: "local" });
          } catch {
            // The isolated server client has no persistent storage. A cleanup
            // failure does not change the verified credential result.
          }
          return "matches";
        }
        return error?.code === "invalid_credentials" ? "different" : "unknown";
      } catch {
        return "unknown";
      }
    },
    async updateUserById(userId, attributes) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: attributes.password,
          app_metadata: attributes.appMetadata,
        });
        if (!error && data.user) return "updated";
        return error?.status && error.status < 500 ? "rejected" : "unknown";
      } catch {
        return "unknown";
      }
    },
  };
}

let passwordChangeService: ReturnType<typeof createRegentPasswordChangeService> | undefined;

function getRegentPasswordChangeService() {
  if (!passwordChangeService) {
    passwordChangeService = createRegentPasswordChangeService({
      repository: createSupabaseRegentPasswordChangeRepository(),
      auth: createSupabaseRegentPasswordAuth(),
      proofs: passwordProofs,
    });
  }
  return passwordChangeService;
}

const newPasswordSchema = z.string().min(8).max(128);
const retryTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const changeRegentPassword = createServerFn({ method: "POST" })
  .middleware([requirePortalAccess])
  .validator(z.object({ password: newPasswordSchema, operationToken: retryTokenSchema }).strict())
  .handler(({ data, context }) =>
    getRegentPasswordChangeService().change(
      context.portalAccess,
      data.password,
      data.operationToken,
    ),
  );

export const completeRegentPasswordChange = createServerFn({ method: "POST" })
  .middleware([requirePortalAccess])
  .validator(z.object({ retryToken: retryTokenSchema }).strict())
  .handler(({ data, context }) =>
    getRegentPasswordChangeService().complete(context.portalAccess, data.retryToken),
  );

const temporaryPasswordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres na senha temporária.")
  .max(128);
const createRegentSchema = regentMutationSchema
  .extend({ password: temporaryPasswordSchema })
  .strict();
const membershipSchema = z.object({ id: regentIdSchema }).strict();
const resetRegentSchema = membershipSchema.extend({ password: temporaryPasswordSchema }).strict();

async function loadAdminService() {
  const { getRegentAdminService } = await import("@/features/regent/regent-admin.server");
  return getRegentAdminService();
}

export const listAdminRegents = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => (await loadAdminService()).list());

export const createAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createRegentSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).create(data, context.adminUserId),
  );

export const replaceAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createRegentSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).replace(data, context.adminUserId),
  );

export const revokeAdminRegent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(membershipSchema)
  .handler(async ({ data, context }) =>
    (await loadAdminService()).revoke(data.id, context.adminUserId),
  );

export const resetAdminRegentPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(resetRegentSchema)
  .handler(async ({ data }) => (await loadAdminService()).resetPassword(data.id, data.password));
