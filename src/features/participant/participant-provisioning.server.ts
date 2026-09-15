import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  buildInitialParticipantPassword,
  participantAccessStatusSchema,
  type ParticipantAccessStatus,
} from "./participant.domain";

export type PaidRegistrationIdentity = {
  id: string;
  email: string;
  cpf: string;
  birthDate: string;
};

export type ParticipantAccountRow = {
  id: string;
  registrationId: string;
  userId: string | null;
  accessStatus: ParticipantAccessStatus;
  provisioningClaimId: string | null;
};

export type ParticipantProvisioningErrorCode =
  | "EMAIL_CONFLICT"
  | "AUTH_UNAVAILABLE"
  | "LINK_REJECTED"
  | "LINK_OUTCOME_UNKNOWN"
  | "AUTH_CLEANUP_FAILED";

export type ParticipantAccessEventInput = {
  registrationId: string;
  participantAccountId: string | null;
  eventType:
    | "provisioned"
    | "provisioning_pending"
    | "email_conflict"
    | "reprocess_requested"
    | "password_reset";
  adminUserId?: string;
  errorCode?: ParticipantProvisioningErrorCode;
};

type ParticipantClaimIdentity = {
  accountId: string;
  registrationId: string;
  claimId: string;
};

export type ParticipantProvisioningRepository = {
  findPaidRegistration(id: string): Promise<PaidRegistrationIdentity | null>;
  claim(id: string, claimId: string): Promise<ParticipantAccountRow>;
  activate(input: ParticipantClaimIdentity & { userId: string }): Promise<boolean>;
  fail(
    input: ParticipantClaimIdentity & {
      status: "pending" | "conflict";
      code: ParticipantProvisioningErrorCode;
    },
  ): Promise<void>;
  findByRegistration(id: string): Promise<ParticipantAccountRow | null>;
  appendEvent(event: ParticipantAccessEventInput): Promise<void>;
};

export type ParticipantAuthAdmin = {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: {
    email: string;
    password: string;
    emailConfirm: true;
  }): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  updatePassword(userId: string, password: string): Promise<void>;
};

export type ParticipantProvisioningResult = {
  status: ParticipantAccessStatus;
};

export class ParticipantLinkFailure extends Error {
  constructor(readonly outcome: "confirmed_rejection" | "unknown") {
    super("Participant link was not confirmed");
  }
}

export class ParticipantAuthFailure extends Error {
  constructor(readonly outcome: "email_conflict" | "unknown") {
    super("Participant Auth operation failed");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function statusOf(account: ParticipantAccountRow): ParticipantProvisioningResult {
  return { status: account.accessStatus };
}

export function createParticipantProvisioningService({
  repository,
  auth,
  createClaimId = () => crypto.randomUUID(),
}: {
  repository: ParticipantProvisioningRepository;
  auth: ParticipantAuthAdmin;
  createClaimId?: () => string;
}) {
  async function appendOutcomeEvent(event: ParticipantAccessEventInput): Promise<void> {
    try {
      await repository.appendEvent(event);
    } catch {
      // Access/payment state is already durable. An audit outage must not make a
      // successfully activated participant appear pending to the caller.
    }
  }

  async function markFailed(
    account: ParticipantAccountRow,
    claimId: string,
    status: "pending" | "conflict",
    code: ParticipantProvisioningErrorCode,
    eventType: "provisioning_pending" | "email_conflict",
  ): Promise<ParticipantProvisioningResult> {
    try {
      await repository.fail({
        accountId: account.id,
        registrationId: account.registrationId,
        claimId,
        status,
        code,
      });
    } catch {
      const reconciled = await repository
        .findByRegistration(account.registrationId)
        .catch(() => null);
      if (reconciled?.accessStatus === "active") return { status: "active" };
      if (!reconciled) return { status: "pending" };
      if (reconciled.accessStatus !== status) return statusOf(reconciled);
    }
    await appendOutcomeEvent({
      registrationId: account.registrationId,
      participantAccountId: account.id,
      eventType,
      errorCode: code,
    });
    return { status };
  }

  async function reconcileActivation(
    account: ParticipantAccountRow,
    claimId: string,
    createdUserId: string,
    outcome: "confirmed_rejection" | "unknown",
  ): Promise<ParticipantProvisioningResult> {
    let reconciled: ParticipantAccountRow | null;
    try {
      reconciled = await repository.findByRegistration(account.registrationId);
    } catch {
      // Without a trustworthy read, absence is not proven and compensation is unsafe.
      return { status: "pending" };
    }

    if (reconciled?.accessStatus === "active") {
      if (reconciled.userId === createdUserId) {
        await appendOutcomeEvent({
          registrationId: account.registrationId,
          participantAccountId: reconciled.id,
          eventType: "provisioned",
        });
      } else if (outcome === "confirmed_rejection") {
        // The completed rejection plus an authoritative link to another user
        // proves this attempt's newly created identity is not referenced.
        try {
          await auth.deleteUser(createdUserId);
        } catch {
          await appendOutcomeEvent({
            registrationId: account.registrationId,
            participantAccountId: reconciled.id,
            eventType: "provisioning_pending",
            errorCode: "AUTH_CLEANUP_FAILED",
          });
        }
      }
      return { status: "active" };
    }

    if (outcome === "unknown") {
      // The original statement can still commit after this snapshot. Never delete
      // the Auth identity or issue a competing finalization in this state.
      await appendOutcomeEvent({
        registrationId: account.registrationId,
        participantAccountId: account.id,
        eventType: "provisioning_pending",
        errorCode: "LINK_OUTCOME_UNKNOWN",
      });
      return { status: "pending" };
    }

    try {
      await auth.deleteUser(createdUserId);
    } catch {
      return markFailed(account, claimId, "pending", "AUTH_CLEANUP_FAILED", "provisioning_pending");
    }
    return markFailed(account, claimId, "pending", "LINK_REJECTED", "provisioning_pending");
  }

  async function provision(registrationId: string): Promise<ParticipantProvisioningResult> {
    const registration = await repository.findPaidRegistration(registrationId);
    if (!registration) return { status: "pending" };

    const claimId = createClaimId();
    const account = await repository.claim(registration.id, claimId);
    if (account.accessStatus === "active") return { status: "active" };
    if (account.provisioningClaimId !== claimId) return statusOf(account);

    const email = normalizeEmail(registration.email);
    try {
      const existing = await auth.findUserByEmail(email);
      if (existing) {
        return markFailed(account, claimId, "conflict", "EMAIL_CONFLICT", "email_conflict");
      }
    } catch {
      return markFailed(account, claimId, "pending", "AUTH_UNAVAILABLE", "provisioning_pending");
    }

    let createdUserId: string;
    try {
      const password = buildInitialParticipantPassword(registration.cpf, registration.birthDate);
      const created = await auth.createUser({ email, password, emailConfirm: true });
      createdUserId = created.id;
    } catch (error) {
      if (error instanceof ParticipantAuthFailure && error.outcome === "email_conflict") {
        return markFailed(account, claimId, "conflict", "EMAIL_CONFLICT", "email_conflict");
      }
      return markFailed(account, claimId, "pending", "AUTH_UNAVAILABLE", "provisioning_pending");
    }

    try {
      const activated = await repository.activate({
        accountId: account.id,
        registrationId: account.registrationId,
        claimId,
        userId: createdUserId,
      });
      if (!activated) {
        return reconcileActivation(account, claimId, createdUserId, "confirmed_rejection");
      }
    } catch (error) {
      const outcome =
        error instanceof ParticipantLinkFailure ? error.outcome : ("unknown" as const);
      return reconcileActivation(account, claimId, createdUserId, outcome);
    }

    await appendOutcomeEvent({
      registrationId: account.registrationId,
      participantAccountId: account.id,
      eventType: "provisioned",
    });
    return { status: "active" };
  }

  return {
    provision,
    async reprocess(
      registrationId: string,
      adminUserId: string,
    ): Promise<ParticipantProvisioningResult> {
      const account = await repository.findByRegistration(registrationId);
      await repository.appendEvent({
        registrationId,
        participantAccountId: account?.id ?? null,
        eventType: "reprocess_requested",
        adminUserId,
      });
      return provision(registrationId);
    },
    async resetInitialPassword(registrationId: string, adminUserId: string) {
      const registration = await repository.findPaidRegistration(registrationId);
      const account = await repository.findByRegistration(registrationId);
      if (!registration || !account || account.accessStatus !== "active" || !account.userId) {
        throw new Error("Participant password reset unavailable");
      }

      const password = buildInitialParticipantPassword(registration.cpf, registration.birthDate);
      await auth.updatePassword(account.userId, password);
      await repository.appendEvent({
        registrationId,
        participantAccountId: account.id,
        eventType: "password_reset",
        adminUserId,
      });
      return { status: "success" as const, sessionsRevoked: false as const };
    },
  };
}

type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];
type AccountDatabaseRow = Database["public"]["Tables"]["participant_accounts"]["Row"];

const accountColumns = "id,registration_id,user_id,access_status,provisioning_claim_id" as const;

function mapAccount(
  row: Pick<
    AccountDatabaseRow,
    "id" | "registration_id" | "user_id" | "access_status" | "provisioning_claim_id"
  >,
): ParticipantAccountRow {
  return {
    id: row.id,
    registrationId: row.registration_id,
    userId: row.user_id,
    accessStatus: participantAccessStatusSchema.parse(row.access_status),
    provisioningClaimId: row.provisioning_claim_id,
  };
}

function checkError(error: { code?: string } | null): void {
  if (error) throw new Error("Participant operation failed");
}

const confirmedDatabaseRejections = new Set([
  "23502",
  "23503",
  "23505",
  "23514",
  "42501",
  "P0001",
  "40001",
  "40P01",
  "57014",
]);
const duplicateEmailAuthCodes = new Set(["email_exists", "user_already_exists"]);

export function createSupabaseParticipantProvisioningRepository(): ParticipantProvisioningRepository {
  async function findAccountByRegistration(id: string): Promise<ParticipantAccountRow | null> {
    const { data, error } = await supabaseAdmin
      .from("participant_accounts")
      .select(accountColumns)
      .eq("registration_id", id)
      .maybeSingle();
    checkError(error);
    return data ? mapAccount(data) : null;
  }

  return {
    async findPaidRegistration(id) {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .select("id,email,cpf,birth_date")
        .eq("id", id)
        .eq("payment_status", "paid")
        .maybeSingle();
      checkError(error);
      const row: Pick<RegistrationRow, "id" | "email" | "cpf" | "birth_date"> | null = data;
      if (!row?.email || !row.cpf) return null;
      return {
        id: row.id,
        email: row.email,
        cpf: row.cpf,
        birthDate: row.birth_date,
      };
    },
    async claim(id, claimId) {
      const { error } = await supabaseAdmin.rpc("claim_participant_provisioning", {
        p_registration_id: id,
        p_claim_id: claimId,
      });
      checkError(error);
      const account = await findAccountByRegistration(id);
      if (!account) throw new Error("Participant account was not claimed");
      return account;
    },
    async activate(input) {
      let response: {
        data: Pick<AccountDatabaseRow, "id"> | null;
        error: { code?: string } | null;
      };
      try {
        response = await supabaseAdmin
          .from("participant_accounts")
          .update({
            access_status: "active",
            user_id: input.userId,
            provisioned_at: new Date().toISOString(),
            last_error_code: null,
            provisioning_claim_id: null,
            provisioning_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.accountId)
          .eq("registration_id", input.registrationId)
          .eq("provisioning_claim_id", input.claimId)
          .select("id")
          .maybeSingle();
      } catch {
        throw new ParticipantLinkFailure("unknown");
      }
      if (response.error) {
        throw new ParticipantLinkFailure(
          confirmedDatabaseRejections.has(response.error.code ?? "")
            ? "confirmed_rejection"
            : "unknown",
        );
      }
      return response.data !== null;
    },
    async fail(input) {
      const { data, error } = await supabaseAdmin
        .from("participant_accounts")
        .update({
          access_status: input.status,
          user_id: null,
          provisioned_at: null,
          last_error_code: input.code,
          provisioning_claim_id: null,
          provisioning_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.accountId)
        .eq("registration_id", input.registrationId)
        .eq("provisioning_claim_id", input.claimId)
        .select("id")
        .maybeSingle();
      checkError(error);
      if (!data) throw new Error("Participant claim is no longer owned");
    },
    findByRegistration: findAccountByRegistration,
    async appendEvent(event) {
      const { error } = await supabaseAdmin.from("participant_access_events").insert({
        registration_id: event.registrationId,
        participant_account_id: event.participantAccountId,
        event_type: event.eventType,
        admin_user_id: event.adminUserId ?? null,
        error_code: event.errorCode ?? null,
      });
      checkError(error);
    },
  };
}

export function createSupabaseParticipantAuthAdmin(): ParticipantAuthAdmin {
  return {
    async findUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      let page = 1;
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        checkError(error);
        const match = data.users.find(
          (user) => user.email && normalizeEmail(user.email) === normalizedEmail,
        );
        if (match) return { id: match.id };
        if (!("nextPage" in data) || !data.nextPage) return null;
        page = data.nextPage;
      }
    },
    async createUser({ email, password, emailConfirm }) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizeEmail(email),
        password,
        email_confirm: emailConfirm,
      });
      if (error) {
        throw new ParticipantAuthFailure(
          duplicateEmailAuthCodes.has(error.code ?? "") ? "email_conflict" : "unknown",
        );
      }
      if (!data.user) throw new Error("Participant Auth user was not created");
      return { id: data.user.id };
    },
    async deleteUser(userId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      checkError(error);
    },
    async updatePassword(userId, password) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      checkError(error);
      if (!data.user) throw new Error("Participant Auth user was not updated");
    },
  };
}

export function getParticipantProvisioningService() {
  return createParticipantProvisioningService({
    repository: createSupabaseParticipantProvisioningRepository(),
    auth: createSupabaseParticipantAuthAdmin(),
  });
}
