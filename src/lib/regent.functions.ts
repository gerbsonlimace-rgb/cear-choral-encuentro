import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/admin-auth.middleware";
import {
  requirePortalAccess,
  requirePortalReadyAccess,
} from "@/features/regent/regent-auth.middleware";
import { regentIdSchema, regentMutationSchema } from "@/features/regent/regent.domain";
import {
  portalChoirSelectionSchema,
  resolveAuthorizedChoir,
  type PortalAccess,
  type RegentAccess,
} from "@/features/regent/regent.domain";
import type { PortalAccessProbe } from "@/features/regent/regent-auth.server";
import type { PortalSummary } from "@/features/regent/regent-payments.domain";
import type { PortalParticipantPage } from "@/features/regent/regent-portal.server";

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

const portalQuerySchema = z
  .object({
    choirId: z.string().uuid().optional(),
    search: z.string().trim().max(100),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(50),
  })
  .strict();
const portalSummarySchema = z.object({ choirId: z.string().uuid().optional() }).strict();

type PortalQueryInput = z.infer<typeof portalQuerySchema>;
type PortalSummaryInput = z.infer<typeof portalSummarySchema>;
type PortalService = {
  list(
    authorizedChoirId: string,
    query: { search: string; page: number; pageSize: number },
  ): Promise<PortalParticipantPage>;
  summary(authorizedChoirId: string): Promise<PortalSummary>;
};

export function createRegentPortalHandlers(service: PortalService) {
  return {
    async list(access: PortalAccess, input: unknown) {
      const parsed = portalQuerySchema.parse(input);
      const choirId = resolvePortalChoirSelection(access, { choirId: parsed.choirId });
      return service.list(choirId, {
        search: parsed.search,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });
    },
    async summary(access: PortalAccess, input: unknown) {
      const parsed = portalSummarySchema.parse(input);
      const choirId = resolvePortalChoirSelection(access, { choirId: parsed.choirId });
      return service.summary(choirId);
    },
  };
}

async function loadRegentPortalHandlers() {
  const { getRegentPortalService } = await import("@/features/regent/regent-portal.server");
  return createRegentPortalHandlers(getRegentPortalService());
}

export const listRegentPortalParticipants = createServerFn({ method: "POST" })
  .middleware([requirePortalReadyAccess])
  .validator(portalQuerySchema)
  .handler(
    ({ data, context }: { data: PortalQueryInput; context: { portalAccess: PortalAccess } }) =>
      loadRegentPortalHandlers().then((handlers) => handlers.list(context.portalAccess, data)),
  );

export const getRegentPortalSummary = createServerFn({ method: "POST" })
  .middleware([requirePortalReadyAccess])
  .validator(portalSummarySchema)
  .handler(
    ({ data, context }: { data: PortalSummaryInput; context: { portalAccess: PortalAccess } }) =>
      loadRegentPortalHandlers().then((handlers) => handlers.summary(context.portalAccess, data)),
  );

type RegentPortalAccess = Extract<PortalAccess, { role: "regent" }>;

export type RegentPasswordChangeRepository = {
  armRetryProof(
    access: RegentPortalAccess,
    hash: string,
    candidateFingerprint: string,
  ): Promise<boolean>;
  verifyCandidate(
    access: RegentPortalAccess,
    hash: string,
    candidateFingerprint: string,
  ): Promise<boolean>;
  makeRetryable(
    access: RegentPortalAccess,
    hash: string,
    candidateFingerprint: string,
  ): Promise<boolean>;
  clearRetryProof(
    access: RegentPortalAccess,
    hash: string,
    expectedStage: "claimed" | "candidate_verified",
  ): Promise<boolean>;
  completeWithProof(access: RegentPortalAccess, hash: string): Promise<boolean>;
  getPasswordOperation(access: RegentPortalAccess): Promise<{
    kind: "admin" | "regent";
    hash: string;
    stage: "claimed" | "candidate_verified" | "retryable" | "legacy";
    candidateFingerprint: string | null;
  } | null>;
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
  updateAppMetadata(
    userId: string,
    appMetadata: Record<string, unknown>,
  ): Promise<"updated" | "rejected" | "unknown">;
};

type RegentPasswordProofs = {
  createOperation(
    access: RegentPortalAccess,
    password: string,
  ): Promise<{ operationHash: string; candidateFingerprint: string }>;
};

export type RegentPasswordChangeResult =
  | { status: "success" }
  | { status: "rejected" }
  | { status: "recovery_required" };

export type RegentPasswordCompletionResult = { status: "success" } | { status: "not_ready" };

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

  async function releaseSafeClaim(
    access: RegentPortalAccess,
    hash: string,
    expectedStage: "claimed" | "candidate_verified",
  ) {
    try {
      return await repository.clearRetryProof(access, hash, expectedStage);
    } catch {
      return false;
    }
  }

  async function readOperation(access: RegentPortalAccess) {
    try {
      return await repository.getPasswordOperation(access);
    } catch {
      return null;
    }
  }

  async function finishProvenOperation(access: RegentPortalAccess, hash: string) {
    try {
      if (await repository.completeWithProof(access, hash)) return { status: "success" } as const;
    } catch {
      // Reconcile below because the update response may have been lost after commit.
    }
    if (await isCompleted(access)) return { status: "success" } as const;
    return { status: "recovery_required" } as const;
  }

  return {
    async change(accessInput: PortalAccess, password: string): Promise<RegentPasswordChangeResult> {
      const access = requireRegentAccess(accessInput, passwordChangeError);
      let newOperation: Awaited<ReturnType<RegentPasswordProofs["createOperation"]>>;
      try {
        newOperation = await proofs.createOperation(access, password);
      } catch {
        return { status: "rejected" };
      }

      let hash = newOperation.operationHash;
      const candidateFingerprint = newOperation.candidateFingerprint;
      let claimedByThisCall = false;
      let claimResponseUnknown = false;
      try {
        claimedByThisCall = await repository.armRetryProof(access, hash, candidateFingerprint);
      } catch {
        claimResponseUnknown = true;
      }

      let operation = claimedByThisCall
        ? ({
            kind: "regent",
            hash,
            stage: "claimed",
            candidateFingerprint,
          } as const)
        : await readOperation(access);

      if (!claimedByThisCall) {
        if (!operation) return { status: "rejected" };
        const exactLostClaim =
          claimResponseUnknown &&
          operation?.kind === "regent" &&
          operation.hash === hash &&
          operation.candidateFingerprint === candidateFingerprint;
        const sameRetryableCandidate =
          operation?.kind === "regent" &&
          operation.candidateFingerprint === candidateFingerprint &&
          operation.stage !== "legacy";
        if (!exactLostClaim && !sameRetryableCandidate) {
          return { status: "rejected" };
        }
        claimedByThisCall = exactLostClaim;
        hash = operation.hash;
      }

      const proof = operationProof(access, hash);
      let authUser: Awaited<ReturnType<RegentPasswordAuth["inspectUser"]>>;
      try {
        authUser = await auth.inspectUser(access.userId);
      } catch {
        if (claimedByThisCall && operation?.stage === "claimed") {
          await releaseSafeClaim(access, hash, "claimed");
        }
        return { status: "rejected" };
      }

      if (hasOperationProof(authUser.appMetadata, proof)) {
        return finishProvenOperation(access, hash);
      }

      let stage = operation?.stage;
      let verifiedByThisCall = false;
      if (stage === "claimed") {
        let match: Awaited<ReturnType<RegentPasswordAuth["passwordMatches"]>> = "unknown";
        try {
          match = await auth.passwordMatches(authUser.email, password);
        } catch {
          match = "unknown";
        }
        if (match !== "different") {
          const released = await releaseSafeClaim(access, hash, "claimed");
          if (released) return { status: "rejected" };
          operation = await readOperation(access);
          if (
            operation?.kind !== "regent" ||
            operation.hash !== hash ||
            operation.candidateFingerprint !== candidateFingerprint
          ) {
            return { status: "rejected" };
          }
          stage = operation.stage;
          if (stage === "claimed" || stage === "legacy") return { status: "rejected" };
        } else {
          let verified = false;
          try {
            verified = await repository.verifyCandidate(access, hash, candidateFingerprint);
          } catch {
            operation = await readOperation(access);
            verified =
              operation?.kind === "regent" &&
              operation.hash === hash &&
              operation.candidateFingerprint === candidateFingerprint &&
              operation.stage === "candidate_verified";
          }
          if (!verified) return { status: "rejected" };
          stage = "candidate_verified";
          verifiedByThisCall = true;
        }
      }

      if (stage === "legacy" || !stage) return { status: "rejected" };

      if (stage === "candidate_verified" && !verifiedByThisCall) {
        let retryable = false;
        try {
          retryable = await repository.makeRetryable(access, hash, candidateFingerprint);
        } catch {
          operation = await readOperation(access);
          retryable =
            operation?.kind === "regent" &&
            operation.hash === hash &&
            operation.candidateFingerprint === candidateFingerprint &&
            operation.stage === "retryable";
        }
        if (!retryable) return { status: "recovery_required" };
        stage = "retryable";
      }

      if (stage === "retryable") {
        let match: Awaited<ReturnType<RegentPasswordAuth["passwordMatches"]>> = "unknown";
        try {
          match = await auth.passwordMatches(authUser.email, password);
        } catch {
          match = "unknown";
        }
        if (match === "unknown") return { status: "recovery_required" };
        if (match === "matches") {
          let metadataOutcome: Awaited<ReturnType<RegentPasswordAuth["updateAppMetadata"]>> =
            "unknown";
          try {
            metadataOutcome = await auth.updateAppMetadata(access.userId, {
              ...authUser.appMetadata,
              regent_password_operation: proof,
            });
          } catch {
            metadataOutcome = "unknown";
          }
          if (metadataOutcome !== "updated") {
            try {
              authUser = await auth.inspectUser(access.userId);
            } catch {
              return { status: "recovery_required" };
            }
            if (!hasOperationProof(authUser.appMetadata, proof)) {
              return { status: "recovery_required" };
            }
          }
          return finishProvenOperation(access, hash);
        }
      }

      if (stage === "candidate_verified" || stage === "retryable") {
        let updateOutcome: Awaited<ReturnType<RegentPasswordAuth["updateUserById"]>> = "unknown";
        try {
          updateOutcome = await auth.updateUserById(access.userId, {
            password,
            appMetadata: {
              ...authUser.appMetadata,
              regent_password_operation: proof,
            },
          });
        } catch {
          updateOutcome = "unknown";
        }
        if (updateOutcome !== "updated") {
          try {
            authUser = await auth.inspectUser(access.userId);
          } catch {
            authUser = { email: authUser.email, appMetadata: {} };
          }
          if (!hasOperationProof(authUser.appMetadata, proof)) {
            if (updateOutcome === "rejected" && stage === "candidate_verified") {
              const released = await releaseSafeClaim(access, hash, "candidate_verified");
              return { status: released ? "rejected" : "recovery_required" };
            }
            try {
              await repository.makeRetryable(access, hash, candidateFingerprint);
            } catch {
              // The candidate remains bound. A later same-candidate request may
              // reconcile the exact proof or atomically promote the operation.
            }
            return { status: "recovery_required" };
          }
        }
      }

      return finishProvenOperation(access, hash);
    },

    async complete(accessInput: PortalAccess): Promise<RegentPasswordCompletionResult> {
      const access = requireRegentAccess(accessInput, passwordCompletionError);
      if (await isCompleted(access)) return { status: "success" };

      let operation: Awaited<ReturnType<RegentPasswordChangeRepository["getPasswordOperation"]>>;
      try {
        operation = await repository.getPasswordOperation(access);
      } catch {
        return { status: "not_ready" };
      }
      if (!operation || operation.kind !== "regent") return { status: "not_ready" };

      try {
        const authUser = await auth.inspectUser(access.userId);
        if (!hasOperationProof(authUser.appMetadata, operationProof(access, operation.hash))) {
          return { status: "not_ready" };
        }
        if (await repository.completeWithProof(access, operation.hash))
          return { status: "success" };
      } catch {
        // Reconcile below because the update response may have been lost after commit.
      }
      if (await isCompleted(access)) return { status: "success" };
      return { status: "not_ready" };
    },
  };
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

const passwordProofs: RegentPasswordProofs = {
  async createOperation(access, password) {
    const { createRegentPasswordCandidateFingerprint } =
      await import("@/features/regent/regent-password-candidate.server");
    return {
      operationHash: bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32))),
      candidateFingerprint: await createRegentPasswordCandidateFingerprint({
        membershipId: access.membershipId,
        userId: access.userId,
        password,
      }),
    };
  },
};

export function createSupabaseRegentPasswordChangeRepository(): RegentPasswordChangeRepository {
  return {
    async armRetryProof(access, hash, candidateFingerprint) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc(
        "claim_choir_regent_password_candidate_operation",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_membership_id: access.membershipId,
          p_user_id: access.userId,
          p_operation_hash: hash,
        },
      );
      if (error) throw new Error("Password proof could not be armed");
      return data;
    },
    async verifyCandidate(access, hash, candidateFingerprint) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc(
        "verify_choir_regent_password_operation_candidate",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_membership_id: access.membershipId,
          p_user_id: access.userId,
          p_operation_hash: hash,
        },
      );
      if (error) throw new Error("Password candidate could not be verified");
      return data;
    },
    async makeRetryable(access, hash, candidateFingerprint) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc(
        "mark_choir_regent_password_operation_retryable",
        {
          p_candidate_fingerprint: candidateFingerprint,
          p_membership_id: access.membershipId,
          p_user_id: access.userId,
          p_operation_hash: hash,
        },
      );
      if (error) throw new Error("Password operation could not be made retryable");
      return data;
    },
    async clearRetryProof(access, hash, expectedStage) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc(
        "release_choir_regent_password_candidate_operation",
        {
          p_expected_stage: expectedStage,
          p_membership_id: access.membershipId,
          p_user_id: access.userId,
          p_operation_hash: hash,
        },
      );
      if (error) throw new Error("Password proof could not be cleared");
      return data;
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
        .select(
          "password_change_operation_kind,password_change_retry_token_hash,password_change_operation_stage,password_change_candidate_fingerprint",
        )
        .eq("id", access.membershipId)
        .eq("user_id", access.userId)
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw new Error("Password operation could not be reconciled");
      const kind = data?.password_change_operation_kind;
      const hash = data?.password_change_retry_token_hash;
      const stage = data?.password_change_operation_stage;
      const candidateFingerprint = data?.password_change_candidate_fingerprint ?? null;
      if (
        (kind !== "admin" && kind !== "regent") ||
        !hash ||
        (stage !== "claimed" &&
          stage !== "candidate_verified" &&
          stage !== "retryable" &&
          stage !== "legacy")
      ) {
        return null;
      }
      return { kind, hash, stage, candidateFingerprint };
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
            const { error: signOutError } = await probe.auth.signOut({ scope: "local" });
            if (signOutError) return "unknown";
          } catch {
            return "unknown";
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
    async updateAppMetadata(userId, appMetadata) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: appMetadata,
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

export const changeRegentPassword = createServerFn({ method: "POST" })
  .middleware([requirePortalAccess])
  .validator(z.object({ password: newPasswordSchema }).strict())
  .handler(({ data, context }) =>
    getRegentPasswordChangeService().change(context.portalAccess, data.password),
  );

export const completeRegentPasswordChange = createServerFn({ method: "POST" })
  .middleware([requirePortalAccess])
  .validator(z.undefined())
  .handler(({ context }) => getRegentPasswordChangeService().complete(context.portalAccess));

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
