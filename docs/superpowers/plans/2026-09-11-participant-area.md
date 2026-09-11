# Participant Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure participant portal whose account is provisioned only after a confirmed InfinitePay payment, with identification and payment details, protected photo, downloadable PDF receipt, password change, administrative recovery, and the three approved placeholder sections.

**Architecture:** Extend the existing registration reconciliation with an idempotent participant-provisioning service backed by private Supabase tables. Authenticate in the browser with Supabase Auth, authorize every data read through a server middleware that resolves the active account from the bearer token, and keep all registration, Storage, Auth Admin, and audit access in server-only modules. Reuse the current admin and registration patterns, but do not couple participant authorization to user metadata.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Supabase Auth/Postgres/Storage, Zod, Vitest and Testing Library, Tailwind/Radix UI, `pdf-lib`.

**Spec:** `docs/superpowers/specs/2026-09-11-participant-area-design.md`

## Global Constraints

- Work only on `codex/area-participante` in an isolated worktree; preserve every uncommitted file in `codex/area-regente`.
- Do not force-push, rebase, amend, or squash history already visible to Lovable.
- Before implementation, compare `codex/area-participante`, `origin/main`, and the latest committed registration/photo work. The existing uncommitted photo changes are reference material, not files to stage from the dirty checkout.
- The participant implementation requires the registration-photo contract (`photo_path`, private `registration-photos` bucket, upload flow). If it has not been committed into the chosen base, stop at that prerequisite rather than creating a competing migration with the same column.
- Create every Supabase migration with `npx supabase migration new`; the plan denotes the generated file as `supabase/migrations/*_create_participant_portal.sql` because the CLI, not this document, assigns its timestamp.
- A schema correction to the approved design is required: `participant_accounts.user_id` is nullable while access is `pending` or `conflict`, and a CHECK constraint makes it mandatory for `active`. Without this, Auth outages and pre-existing-email conflicts cannot be represented honestly.
- Never expose the service-role key to client code. Never store passwords, raw CPF values, bearer tokens, provisioning claim IDs, or raw provider responses in `participant_access_events`.
- Do not make a real registration or charge, apply remote SQL, publish to GitHub/Lovable, or merge to `main` without separate authorization.
- Treat local tests, local database verification, Git publication, remote migration application, and served-site verification as separate proofs.

## File and Responsibility Map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/*_create_participant_portal.sql` | Private account/audit schema, constraints, indexes, claim RPC, grants and RLS |
| `src/integrations/supabase/types.ts` | Generated database types for the two participant tables and claim RPC |
| `src/features/participant/participant.domain.ts` | Password derivation, safe view models, masking, schemas and status types |
| `src/features/participant/participant.domain.test.ts` | Pure domain contract tests |
| `src/features/participant/participant-migration.test.ts` | Static migration security/invariant contract |
| `src/features/participant/participant-provisioning.server.ts` | Idempotent Auth provisioning, compensation, audit, reprocess and reset |
| `src/features/participant/participant-provisioning.server.test.ts` | Provisioning, race, conflict, compensation and admin-reset tests |
| `src/features/participant/participant-auth.server.ts` | Token probe, participant authorization and own-registration loading |
| `src/features/participant/participant-auth.server.test.ts` | Authorization and data-isolation tests |
| `src/features/participant/participant-auth.middleware.ts` | Authenticated participant middleware |
| `src/lib/participant.functions.ts` | Participant and admin server functions |
| `src/lib/participant.functions.test.ts` | Validator and authorization-composition tests |
| `src/features/participant/ParticipantLoginPage.tsx` | Email/password login and safe session rejection |
| `src/features/participant/ParticipantLoginPage.test.tsx` | Login states, errors and redirect behavior |
| `src/features/participant/ParticipantPortalPage.tsx` | Responsive shell and four portal sections |
| `src/features/participant/ParticipantPortalPage.test.tsx` | Protected loading, exact content and responsive semantics |
| `src/features/participant/ParticipantPasswordDialog.tsx` | Current-password reauthentication and voluntary password change |
| `src/features/participant/ParticipantPasswordDialog.test.tsx` | Reauthentication, validation, cleanup and errors |
| `src/features/participant/participant-receipt.ts` | In-browser PDF receipt generation from already-authorized view data |
| `src/features/participant/participant-receipt.test.ts` | PDF structure and safe field rendering |
| `src/routes/participante.login.tsx` | `/participante/login` route |
| `src/routes/participante.index.tsx` | `/participante` route |
| `src/features/registration/registration-payment.server.ts` | Invoke provisioning after a durable paid state |
| `src/features/registration/registration-payment.server.test.ts` | Payment/provisioning ordering and failure isolation |
| `src/features/registration/PaymentConfirmationPage.tsx` | Portal CTA and access-preparation message |
| `src/features/registration/PaymentConfirmationPage.test.tsx` | Confirmation UI for active/pending/conflict access |
| `src/features/admin/admin.domain.ts` | Participant-access status in admin rows |
| `src/features/admin/admin-registration.server.ts` | Join/resolve participant-access status |
| `src/lib/admin.functions.ts` | Reprocess and reset server functions protected by `requireAdmin` |
| `src/features/admin/AdminRegistrationsPage.tsx` | Status badge and guarded admin actions |
| Corresponding existing `*.test.*` files | Admin service/domain/UI regression coverage |
| `package.json` and the repository lockfile created by npm | Add `pdf-lib` |
| `src/routeTree.gen.ts` | Generated route tree; never edit by hand |

---

## Task 1: Establish a Clean, Reproducible Baseline

**Files:**

- Verify: `docs/superpowers/specs/2026-09-11-participant-area-design.md`
- Verify: committed registration/photo files selected as the implementation base
- Do not modify: the dirty `codex/area-regente` checkout

**Interfaces:** Consumes the approved spec and latest committed payment/photo implementation. Produces a clean isolated `codex/area-participante` worktree and a recorded baseline.

- [ ] Read `superpowers:using-git-worktrees` completely, then create/select an isolated worktree for `codex/area-participante`.
- [ ] Run `git fetch origin` and compare without merging:

  ```powershell
  git status --short --branch
  git log -5 --oneline --decorate
  git log --oneline --left-right --cherry-pick codex/area-participante...origin/main
  ```

- [ ] Verify that the selected base contains the CPF/date fields and the committed registration-photo contract. If photo work is still uncommitted in the other checkout, report that exact prerequisite and do not copy its untracked migration into this branch.
- [ ] Run the baseline suite from the isolated worktree:

  ```powershell
  npx vitest run --exclude "**/.worktrees/**"
  npx tsc --noEmit
  npm run build
  ```

- [ ] Record any pre-existing failures verbatim in the execution notes. Do not broaden this feature to repair unrelated failures.

## Task 2: Define the Participant Domain Contract

**Files:**

- Create: `src/features/participant/participant.domain.ts`
- Create: `src/features/participant/participant.domain.test.ts`

**Interfaces:** Consumes normalized registration CPF/date/payment values. Produces `ParticipantAccessStatus`, `ParticipantRegistrationView`, `buildInitialParticipantPassword`, `maskCpf`, and admin input schemas.

- [ ] Write failing tests for normalized password generation, leap-day/date formatting, invalid CPF/date rejection, CPF masking, omission-ready nullable fields, and UUID-only admin inputs.

  ```ts
  expect(buildInitialParticipantPassword("529.982.247-25", "1990-01-15"))
    .toBe("5299822472515011990")
  expect(maskCpf("52998224725")).toBe("***.***.***-25")
  expect(() => buildInitialParticipantPassword("11111111111", "1990-01-15")).toThrow()
  ```

- [ ] Run `npx vitest run src/features/participant/participant.domain.test.ts --exclude "**/.worktrees/**"` and confirm failure because the module does not exist.
- [ ] Implement the minimum pure contract. Reuse `cpfSchema` and `birthDateSchema` rather than duplicating CPF validation.

  ```ts
  export const participantAccessStatusSchema = z.enum(["active", "pending", "conflict"])
  export const participantRegistrationIdSchema = z.object({
    registrationId: z.string().uuid(),
  }).strict()

  export function buildInitialParticipantPassword(cpf: string, birthDate: string) {
    const digits = cpfSchema.parse(cpf)
    const normalizedDate = birthDateSchema.parse(birthDate)
    const [year, month, day] = normalizedDate.split("-")
    return `${digits}${day}${month}${year}`
  }

  export function maskCpf(cpf: string) {
    const digits = cpfSchema.parse(cpf)
    return `***.***.***-${digits.slice(-2)}`
  }
  ```

- [ ] Define `ParticipantRegistrationView` with `identity`, `registration`, and `payment` objects; return only masked CPF, never the raw value.
- [ ] Run the focused test until green.
- [ ] Commit only these files: `git commit -m "feat: define participant portal domain"`.

## Task 3: Add the Private Participant Schema

**Files:**

- Create with CLI: `supabase/migrations/*_create_participant_portal.sql`
- Create: `src/features/participant/participant-migration.test.ts`
- Modify by regeneration: `src/integrations/supabase/types.ts`

**Interfaces:** Consumes `auth.users` and `public.registrations`. Produces private `participant_accounts`, append-only `participant_access_events`, and service-role-only `claim_participant_provisioning`.

- [ ] Write the failing migration contract first. It must assert exactly one matching migration, RLS on both tables, no anon/authenticated grants, append-only event grants, unique registration/user indexes, paid-registration eligibility, claim expiry, and the active-user CHECK constraint.
- [ ] Run `npx vitest run src/features/participant/participant-migration.test.ts --exclude "**/.worktrees/**"` and confirm it fails because the migration is absent.
- [ ] Create the migration only through the CLI:

  ```powershell
  npx supabase migration new create_participant_portal
  $participantMigration = Get-ChildItem supabase/migrations/*_create_participant_portal.sql | Select-Object -ExpandProperty FullName
  $participantMigration
  ```

- [ ] Implement `participant_accounts` with these invariants:

  ```sql
  create table public.participant_accounts (
    id uuid primary key default gen_random_uuid(),
    registration_id uuid not null references public.registrations(id) on delete restrict,
    user_id uuid references auth.users(id) on delete restrict,
    access_status text not null default 'pending'
      check (access_status in ('active', 'pending', 'conflict')),
    provisioned_at timestamptz,
    last_error_code text,
    provisioning_claim_id uuid,
    provisioning_started_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint participant_accounts_active_state_check check (
      (access_status = 'active' and user_id is not null and provisioned_at is not null
        and last_error_code is null and provisioning_claim_id is null
        and provisioning_started_at is null)
      or (access_status <> 'active' and user_id is null and provisioned_at is null)
    )
  );
  create unique index participant_accounts_registration_uidx
    on public.participant_accounts (registration_id);
  create unique index participant_accounts_user_uidx
    on public.participant_accounts (user_id) where user_id is not null;
  create index participant_accounts_attention_idx
    on public.participant_accounts (access_status, updated_at)
    where access_status in ('pending', 'conflict');
  ```

- [ ] Add `participant_access_events` with `registration_id`, nullable `participant_account_id`, event type, nullable admin actor, sanitized `error_code`, and `created_at`; grant only `select, insert` to `service_role` so ordinary application paths cannot update or delete history.
- [ ] Add a `security invoker`, empty-search-path claim RPC that locks the paid registration, creates the pending account row if absent, and grants a 10-minute compare-and-set lease only when the row is not active and its previous lease is empty or expired. Revoke execution from `public`, `anon`, and `authenticated`; grant it only to `service_role`.
- [ ] Enable RLS and revoke all direct table access from `public`, `anon`, and `authenticated`. Grant the minimum `service_role` operations: account `select, insert, update`; event `select, insert`.
- [ ] Start/reset the local Supabase stack, apply all migrations, and exercise the claim RPC twice to prove only one current claim wins. If Docker is unavailable, keep the contract test evidence separate and report local PostgreSQL verification as not run.
- [ ] Regenerate `src/integrations/supabase/types.ts` from the local schema; do not hand-maintain table/RPC shapes.
- [ ] Run the migration contract and `npx tsc --noEmit`.
- [ ] Commit: `git commit -m "feat: add participant access schema"`.

## Task 4: Implement Idempotent Paid-Account Provisioning

**Files:**

- Create: `src/features/participant/participant-provisioning.server.ts`
- Create: `src/features/participant/participant-provisioning.server.test.ts`

**Interfaces:** Consumes a paid `registrationId`. Produces `{ status: "active" | "pending" | "conflict" }`, an Auth user only for an unoccupied email, a private link, and sanitized audit events.

- [ ] Define repository and Auth ports in the server module so domain tests never call Supabase:

  ```ts
  export type ParticipantProvisioningRepository = {
    findPaidRegistration(id: string): Promise<PaidRegistrationIdentity | null>
    claim(id: string, claimId: string): Promise<ParticipantAccountRow>
    activate(input: { accountId: string; claimId: string; userId: string }): Promise<boolean>
    fail(input: { accountId: string; claimId: string; status: "pending" | "conflict"; code: string }): Promise<void>
    findByRegistration(id: string): Promise<ParticipantAccountRow | null>
    appendEvent(event: ParticipantAccessEventInput): Promise<void>
  }
  export type ParticipantAuthAdmin = {
    findUserByEmail(email: string): Promise<{ id: string } | null>
    createUser(input: { email: string; password: string; emailConfirm: true }): Promise<{ id: string }>
    deleteUser(userId: string): Promise<void>
    updatePassword(userId: string, password: string): Promise<void>
  }
  ```

- [ ] Write failing tests proving: unpaid/missing registrations do not create accounts; duplicate calls return active; only the claim holder calls Auth; an occupied email becomes conflict without update/delete; successful creation activates and audits; confirmed link rejection compensates only the just-created user; unknown link outcome reconciles before cleanup; Auth failure leaves paid registration pending; event payloads contain neither password nor full CPF.
- [ ] Run the focused tests and confirm red.
- [ ] Implement `createParticipantProvisioningService` with the order `load paid registration -> claim -> check existing email -> create confirmed Auth user -> activate link -> append sanitized event`.
- [ ] Reuse the conservative unknown-outcome pattern from `regent-admin.server.ts`: never delete a newly created Auth user unless a database rejection is authoritative and reconciliation proves there is no committed link.
- [ ] Implement `createSupabaseParticipantProvisioningRepository` and `createSupabaseParticipantAuthAdmin` in this `.server.ts` file. Normalize email before lookup and paginate `listUsers` as the regent implementation does.
- [ ] Make `reprocess(registrationId, adminUserId)` append `reprocess_requested`, then use the same provisioning path; do not create a second algorithm.
- [ ] Implement `resetInitialPassword(registrationId, adminUserId)` only for an active linked paid registration. Derive the password server-side, call `updateUserById`, append `password_reset`, and return `{ status: "success", sessionsRevoked: false }` so the admin UI states the session limitation honestly.
- [ ] Run focused tests and `npx tsc --noEmit`.
- [ ] Commit: `git commit -m "feat: provision paid participant accounts"`.

## Task 5: Wire Provisioning into Payment Reconciliation

**Files:**

- Modify: `src/features/registration/registration-payment.server.ts`
- Modify: `src/features/registration/registration-payment.server.test.ts`
- Modify: `src/features/registration/webhook.server.test.ts`

**Interfaces:** Consumes the durable paid registration returned by `markPaid`. Produces `PublicPaymentStatus` with `participantAccessStatus` while preserving payment success if provisioning is delayed.

- [ ] Add failing tests for these cases:

  ```ts
  expect(vi.mocked(markPaid).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(provisionParticipant).mock.invocationCallOrder[0],
  )
  await expect(service.reconcilePayment(lookup)).resolves.toMatchObject({
    status: "paid",
    participantAccessStatus: "pending",
  })
  ```

  Cover both a newly paid record and an already-paid idempotent retry. Prove a provisioning exception never reverts or reports the payment as failed.

- [ ] Change `PublicPaymentStatus` paid shape to include `participantAccessStatus: "active" | "pending" | "conflict"`.
- [ ] Add a `provisionParticipant(registrationId)` dependency to `createRegistrationPaymentService`. Call it after `markPaid`, and also on the already-paid replay path. Convert unexpected provisioning failure to `pending` after the provisioning service has attempted its own audit.
- [ ] In `getRegistrationPaymentService`, inject `getParticipantProvisioningService().provision` through a dynamic server import if needed to avoid a module cycle.
- [ ] Keep webhook behavior payment-centric: once the payment is confirmed, access preparation may be pending without returning HTTP 400.
- [ ] Run:

  ```powershell
  npx vitest run src/features/registration/registration-payment.server.test.ts src/features/registration/webhook.server.test.ts --exclude "**/.worktrees/**"
  ```

- [ ] Commit: `git commit -m "feat: provision participant access after payment"`.

## Task 6: Authorize and Load Only the Signed-In Participant

**Files:**

- Create: `src/features/participant/participant-auth.server.ts`
- Create: `src/features/participant/participant-auth.server.test.ts`
- Create: `src/features/participant/participant-auth.middleware.ts`
- Create: `src/lib/participant.functions.ts`
- Create: `src/lib/participant.functions.test.ts`

**Interfaces:** Consumes the bearer token attached by `attachSupabaseAuth`. Produces `ParticipantAccess` and `ParticipantRegistrationView` for the token owner's active, paid registration only.

- [ ] Write failing authorization tests for unauthenticated, authenticated-without-link, pending, conflict, active-but-unpaid, and active-paid states. Attempt to pass a different registration ID and prove no public function accepts it.
- [ ] Define the access union:

  ```ts
  export type ParticipantAccess =
    | { status: "unauthenticated" }
    | { status: "unavailable" }
    | { status: "authorized"; accountId: string; registrationId: string; userId: string }
  ```

- [ ] Implement an unauthenticated probe for login routing with `supabaseAdmin.auth.getUser(token)`, then resolve by `user_id`, `access_status = active`, and a joined/second checked registration with `payment_status = paid`.
- [ ] Implement `requireParticipantAccess` by composing `requireSupabaseAuth` and looking up only `context.userId`; never accept `registrationId` from request data.
- [ ] Implement `getParticipantAccess` and protected `getParticipantRegistration`. The loader selects every persisted registration response and payment snapshot, maps CPF to the masked form, omits absent optional fields, and creates a 60-second signed URL for `photo_path`.
- [ ] Return a neutral `photoUrl: null` when signing fails; do not expose the object path or make the bucket public.
- [ ] Run the three focused test files until green.
- [ ] Commit: `git commit -m "feat: authorize participant registration access"`.

## Task 7: Build the Participant Login

**Files:**

- Create: `src/features/participant/ParticipantLoginPage.tsx`
- Create: `src/features/participant/ParticipantLoginPage.test.tsx`
- Create: `src/routes/participante.login.tsx`

**Interfaces:** Consumes email/password and `getParticipantAccess`. Produces navigation to `/participante` only for an authorized participant and closes all other new sessions.

- [ ] Write failing UI tests for successful login, invalid credentials, an Auth user with no participant link, access-probe failure after sign-in, double submission, show/hide password, cleared password after every failure, and the exact initial-password guidance.
- [ ] Implement login by adapting the safe lifecycle in `RegentLoginPage`, with generic copy:

  ```ts
  const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (result.error) throw result.error
  const access = await getParticipantAccess()
  if (access.status === "authorized") onAuthorized()
  else await supabase.auth.signOut()
  ```

- [ ] Render the event identity, accessible labels, `autocomplete` attributes, a password visibility toggle, and guidance that the initial password is CPF digits plus birth date in `DDMMAAAA`. Do not add email recovery.
- [ ] Add `/participante/login` with `noindex, nofollow` metadata and navigation to `/participante`.
- [ ] Run the component test and route-generation build. Inspect the generated `src/routeTree.gen.ts` diff, but do not edit it manually.
- [ ] Commit: `git commit -m "feat: add participant login"`.

## Task 8: Build the Responsive Portal and Four Sections

**Files:**

- Create: `src/features/participant/ParticipantPortalPage.tsx`
- Create: `src/features/participant/ParticipantPortalPage.test.tsx`
- Create: `src/routes/participante.index.tsx`

**Interfaces:** Consumes `getParticipantRegistration` and participant session actions. Produces the protected desktop/mobile portal with Identification, Playlist, Scores and Manuals, and Certificate.

- [ ] Write failing tests for protected initial load, retryable load failure, sign-out, all persisted non-null fields, omission of null fields, masked CPF, photo/fallback avatar, payment method/installments/date/order, and the three exact placeholder sentences.
- [ ] Model navigation as four semantic tabs/links with these exact labels: `Identificação`, `Playlist`, `Partituras e Manuais`, `Certificado`.
- [ ] Implement a desktop sidebar at `md` and above and a horizontally scrollable compact navigation below `md`, sharing one selected-section state and preserving keyboard focus.
- [ ] In `Identificação`, render definition lists for identity, registration, and payment. Never render the strings `null` or `undefined`.
- [ ] Render the exact placeholders:

  ```text
  A playlist do encontro será disponibilizada em breve.
  As partituras e os materiais de orientação serão disponibilizados em breve.
  Seu certificado estará disponível após o evento.
  ```

- [ ] Add header actions `Alterar senha` and `Sair`; wire password action to the dialog placeholder implemented in Task 9 and sign-out to `/participante/login`.
- [ ] Add `/participante` with `noindex, nofollow`; redirect missing/unavailable access to login without rendering personal data.
- [ ] Run focused tests and the production build; review only generated route additions.
- [ ] Commit: `git commit -m "feat: add participant portal sections"`.

## Task 9: Add Voluntary Password Change with Current-Password Proof

**Files:**

- Create: `src/features/participant/ParticipantPasswordDialog.tsx`
- Create: `src/features/participant/ParticipantPasswordDialog.test.tsx`
- Modify: `src/features/participant/ParticipantPortalPage.tsx`
- Modify: `src/features/participant/ParticipantPortalPage.test.tsx`

**Interfaces:** Consumes current password, new password, confirmation, and the signed-in email. Produces a Supabase Auth password update without persisting either password in application data.

- [ ] Write failing tests for wrong current password, minimum eight characters, unequal confirmation, successful reauthentication before update, failed update, duplicate submit prevention, and clearing all password fields on close/success.
- [ ] Inject small Auth functions for testability. Reauthenticate first, then update:

  ```ts
  const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (reauth.error) throw new CurrentPasswordError()
  const changed = await supabase.auth.updateUser({ password: newPassword })
  if (changed.error) throw changed.error
  ```

- [ ] Keep all three password values only in component state, never in a URL, server function, audit payload, analytics call, or log.
- [ ] Use specific local validation messages but a generic remote failure message. On success, clear fields, close the dialog, and show a confirmation toast.
- [ ] Run both focused component suites.
- [ ] Commit: `git commit -m "feat: allow participants to change password"`.

## Task 10: Generate the Downloadable PDF Receipt

**Files:**

- Modify: `package.json`
- Modify/Create: npm lockfile
- Create: `src/features/participant/participant-receipt.ts`
- Create: `src/features/participant/participant-receipt.test.ts`
- Modify: `src/features/participant/ParticipantPortalPage.tsx`
- Modify: `src/features/participant/ParticipantPortalPage.test.tsx`

**Interfaces:** Consumes the already-authorized participant view and bundled event logo. Produces a local PDF named from a sanitized order code, such as `comprovante-inscricao-1234.pdf`; it does not fetch registration data by ID.

- [ ] Install the explicit dependency with `npm install pdf-lib` and inspect that no unrelated dependency was changed.
- [ ] Write a failing test that generates bytes, loads them with `PDFDocument.load`, asserts one A4 page, title/author metadata, filename sanitization, and absence of raw CPF and receipt URL in the bytes.
- [ ] Implement a pure builder that receives `ParticipantRegistrationView` plus logo bytes and lays out event title, participant name, masked CPF, payment status/method/installments, paid amount/date, and order code. Use `src/assets/logo-coros-preto.png`; do not download remote artwork.
- [ ] Add `downloadParticipantReceipt(view)` that creates a Blob, clicks a temporary object URL, and always revokes it in `finally`.
- [ ] Add `Baixar comprovante em PDF` only when the paid snapshot contains the required order, amount, and date. Show a recoverable inline error if logo/PDF generation fails.
- [ ] Run receipt and portal tests.
- [ ] Commit: `git commit -m "feat: download participant payment receipt"`.

## Task 11: Show Access State and Add Safe Admin Recovery

**Files:**

- Modify: `src/features/admin/admin.domain.ts`
- Modify: `src/features/admin/admin.domain.test.ts`
- Modify: `src/features/admin/admin-registration.server.ts`
- Modify: `src/features/admin/admin-registration.server.test.ts`
- Modify: `src/lib/admin.functions.ts`
- Modify: `src/lib/admin.functions.test.ts`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.test.tsx`

**Interfaces:** Consumes paid registration and participant-account status. Produces `Ativo`, `Aguardando criação`, or `Conflito de e-mail`, plus admin-only reprocess/reset actions.

- [ ] Add failing domain/repository tests for this mapping:

  | Payment/account state | Admin label/action state |
  | --- | --- |
  | not paid | no participant access badge/actions |
  | paid, no account or pending | `Aguardando criação`; reprocess enabled |
  | paid, conflict | `Conflito de e-mail`; reprocess enabled, reset hidden |
  | paid, active | `Ativo`; reset enabled, reprocess hidden |

- [ ] Extend the admin query to resolve one participant account per registration without returning internal claim IDs or full error details to the browser.
- [ ] Add `reprocessParticipantAccess` and `resetParticipantInitialPassword` server functions in `src/lib/admin.functions.ts`, both with `.middleware([requireAdmin])` and the strict UUID schema from the participant domain.
- [ ] Add function tests proving validation happens before service invocation and unauthorized requests cannot reach the service.
- [ ] Render compact badges/actions in desktop rows and mobile cards. Use `AlertDialog` confirmation before reset and prevent duplicate action submission.
- [ ] After reset success, display: `Senha redefinida. Sessões que já estavam abertas não foram encerradas.` because v1 cannot revoke unknown refresh-token sessions reliably.
- [ ] Refresh the affected row after each action, preserve filters/page, and show generic recoverable errors without exposing server codes.
- [ ] Run all focused admin tests.
- [ ] Commit: `git commit -m "feat: manage participant access from admin"`.

## Task 12: Complete the Payment Confirmation Handoff

**Files:**

- Modify: `src/features/registration/PaymentConfirmationPage.tsx`
- Modify: `src/features/registration/PaymentConfirmationPage.test.tsx`

**Interfaces:** Consumes `participantAccessStatus` from verified payment reconciliation. Produces an immediate portal CTA only for active access and honest preparation/conflict messaging otherwise.

- [ ] Write failing tests for active, pending, and conflict access results. Keep the existing paid confirmation and external receipt behavior intact.
- [ ] For `active`, render `Acessar área do participante` linking to `/participante/login`.
- [ ] For `pending`, render `Seu pagamento foi confirmado. Estamos preparando seu acesso à área do participante.` without suggesting another payment.
- [ ] For `conflict`, keep payment confirmed and render `Seu acesso precisa de atendimento da organização.` without revealing that the email exists in Auth.
- [ ] Run the payment confirmation and reconciliation suites together.
- [ ] Commit: `git commit -m "feat: link paid confirmation to participant area"`.

## Task 13: Security, Regression and Visual Verification

**Files:**

- Modify only files required by failures attributable to this feature
- Verify: all participant, registration, admin, routing and generated-type files

**Interfaces:** Consumes the completed local branch. Produces evidence for local correctness and a clean feature diff; it does not publish or mutate production.

- [ ] Run the full focused set:

  ```powershell
  npx vitest run src/features/participant src/features/registration src/features/admin src/lib/participant.functions.test.ts src/lib/admin.functions.test.ts --exclude "**/.worktrees/**"
  ```

- [ ] Run the full project suite and static checks:

  ```powershell
  npx vitest run --exclude "**/.worktrees/**"
  npx tsc --noEmit
  npx eslint src/features/participant src/features/registration/registration-payment.server.ts src/features/registration/PaymentConfirmationPage.tsx src/features/admin src/lib/participant.functions.ts src/lib/admin.functions.ts src/routes/participante.login.tsx src/routes/participante.index.tsx
  npm run build
  ```

- [ ] If local Supabase is available, reset it from migrations and verify: pending registration cannot claim; paid registration can claim once; active account requires Auth user; event rows cannot update/delete through the granted role; participant queries never read another registration.
- [ ] Start the local app on an unused port, verify the owning Vite process, and inspect `/participante/login` plus mocked/authenticated portal states at desktop and mobile widths. Do not use a real production participant or make a real charge.
- [ ] Inspect accessibility: labels, focus order, dialog focus trap, horizontal navigation scrolling, keyboard activation, contrast, loading announcements, and no clipped content at 320px width.
- [ ] Inspect the final Git diff for secrets, raw CPFs, passwords, generated artifacts, unrelated dirty work, accidental public Storage policies, and manual edits to generated route files.
- [ ] Run `git status --short --branch` and `git log --oneline --decorate origin/main..HEAD`; report local commits separately from any future push/deploy/migration.
- [ ] If verification required fixes, commit each coherent fix with `git commit -m "fix: harden participant portal"`; otherwise leave no verification-only commit.
- [ ] Stop before remote SQL, Git push, Lovable publication, or production smoke tests and request the specific authorization appropriate to each action.

## Completion Criteria

- Payment must be durably `paid` before the provisioning service can claim work.
- Repeated browser returns/webhooks do not create duplicate Auth users or links.
- Existing Auth emails are never modified or automatically linked.
- Only an active linked participant can retrieve the paid registration associated with the bearer token.
- Initial password is exactly normalized CPF plus `DDMMAAAA`, remains usable until voluntarily changed, and is never persisted outside Supabase Auth.
- Admin reprocess/reset paths are protected by `requireAdmin` and audited without secrets.
- Identification includes all persisted non-null responses, protected photo, masked CPF, payment details, and a real downloadable PDF.
- Playlist, Partituras e Manuais, and Certificado show the approved exact placeholders and no fake controls.
- Focused tests, full suite, TypeScript, lint, build, local migration checks when available, and desktop/mobile inspection have explicit evidence.
- The branch contains only scoped participant-area work and remains unpublished until separately authorized.
