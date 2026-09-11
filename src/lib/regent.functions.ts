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
  armRetryProof(access: RegentPortalAccess, hash: string): Promise<void>;
  clearRetryProof(access: RegentPortalAccess, hash: string): Promise<void>;
  completeWithProof(access: RegentPortalAccess, hash: string): Promise<boolean>;
  isCompleted(access: RegentPortalAccess): Promise<boolean>;
};

type RegentPasswordAuth = {
  updateUserById(userId: string, attributes: { password: string }): Promise<void>;
};

type RegentPasswordProofs = {
  create(): Promise<{ token: string; hash: string }>;
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

  return {
    async change(accessInput: PortalAccess, password: string): Promise<RegentPasswordChangeResult> {
      const access = requireRegentAccess(accessInput, passwordChangeError);
      let proof: { token: string; hash: string };
      try {
        proof = await proofs.create();
        await repository.armRetryProof(access, proof.hash);
      } catch {
        throw new Error(passwordChangeError);
      }

      try {
        await auth.updateUserById(access.userId, { password });
      } catch {
        try {
          await repository.clearRetryProof(access, proof.hash);
        } catch {
          // The raw proof is never returned when Auth fails, so an orphaned hash is unusable.
        }
        throw new Error(passwordChangeError);
      }

      try {
        if (await repository.completeWithProof(access, proof.hash)) return { status: "success" };
      } catch {
        // Reconcile below because the update response may have been lost after commit.
      }
      if (await isCompleted(access)) return { status: "success" };
      return { status: "completion_required", retryToken: proof.token };
    },

    async complete(accessInput: PortalAccess, retryToken: string) {
      const access = requireRegentAccess(accessInput, passwordCompletionError);
      let hash: string;
      try {
        hash = await proofs.hash(retryToken);
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
  async create() {
    const token = bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    return { token, hash: await hashRetryToken(token) };
  },
  hash: hashRetryToken,
};

export function createSupabaseRegentPasswordChangeRepository(): RegentPasswordChangeRepository {
  return {
    async armRetryProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .update({ password_change_retry_token_hash: hash })
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .eq("password_change_required", true)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Password proof could not be armed");
    },
    async clearRetryProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("choir_regents")
        .update({ password_change_retry_token_hash: null })
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .eq("password_change_required", true)
        .eq("password_change_retry_token_hash", hash)
        .is("revoked_at", null);
      if (error) throw new Error("Password proof could not be cleared");
    },
    async completeWithProof(access, hash) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("choir_regents")
        .update({
          password_change_required: false,
          password_change_retry_token_hash: null,
        })
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .eq("password_change_required", true)
        .eq("password_change_retry_token_hash", hash)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw new Error("Password completion failed");
      return data !== null;
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

function createSupabaseRegentPasswordAuth(): RegentPasswordAuth {
  return {
    async updateUserById(userId, attributes) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, attributes);
      if (error) throw new Error("Password Auth update failed");
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
  .validator(z.object({ password: newPasswordSchema }).strict())
  .handler(({ data, context }) =>
    getRegentPasswordChangeService().change(context.portalAccess, data.password),
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
