# Regent Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure shared portal where one active regent per choir and administrators can see that choir's participants and pay each promotional registration's complement in independently confirmed partial installments.

**Architecture:** Keep Supabase Auth as the identity provider and store authorization in a private `choir_regents` table queried on every server operation. Store every complement checkout in a private payment ledger, calculate balances from immutable registration price snapshots plus confirmed ledger rows, and expose only authorized server-function DTOs to the React pages. Extend the existing registration and InfinitePay services rather than creating a second payment integration.

**Tech Stack:** TanStack Start/Router, React 19, TypeScript, Zod, Supabase Auth/Postgres/Storage, InfinitePay Checkout API, Vitest, Testing Library, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-10-regent-area-design.md`

## Global Constraints

- Work only on branch `codex/area-regente`; do not push, deploy Lovable, apply remote SQL, or create a real InfinitePay charge.
- Preserve every pre-existing modified and untracked file. In overlapping registration files, stage only the hunks produced by this plan and inspect `git diff --cached` before each commit.
- Preserve all existing registrations. In particular, remove the current destructive `delete from public.registrations` from the uncommitted CPF migration.
- One active regent belongs to exactly one choir, and one choir has at most one active regent.
- The administrator creates a confirmed e-mail/password Auth user with a temporary password; no e-mail is sent, and a password change is required on first access.
- A regent is authorized only for the `choir_id` in the active database association. Administrators may select any choir and use the same portal actions.
- A participant has at most one registration per normalized 11-digit CPF. Resume requires matching CPF and birth date and never returns personal fields.
- Complement total is `standard_price_cents - registration_price_cents`; shirt value is excluded. Only a paid promotional registration is eligible.
- Only InfinitePay-confirmed complement rows reduce balance. At most one `creating` or `pending` complement checkout may exist per registration.
- Keep `service_role` in `.server.ts` files. Enable RLS and revoke direct `anon`/`authenticated` access on every new public table.
- Never use `user_metadata` for authorization. Never log temporary passwords, full CPF, birth date, or participant search text.
- Private participant photos are exposed only through authorized, five-minute signed URLs.
- Use integer cents for all money and confirm `order_nsu`, original `amount`, and paid state with InfinitePay before crediting a payment.
- Follow TDD: observe each focused test fail for the expected missing behavior before adding production code.

## Execution Preflight

Before Task 1, run:

```powershell
git branch --show-current
git status --short
npm run test:run -- --no-file-parallelism --maxWorkers=1 --exclude "**/.worktrees/**"
```

Expected branch: `codex/area-regente`. Record any baseline failure and stop for review if it is unrelated to the current dirty registration/photo work. Do not stash, reset, clean, or commit the pre-existing changes as a preparatory step.

---

### Task 1: Non-destructive CPF uniqueness and resume identity domain

**Files:**
- Modify: `supabase/migrations/20260910185725_add_registration_cpf.sql`
- Modify: `src/features/registration/registration-cpf-migration.test.ts`
- Modify: `src/features/registration/registration.domain.ts`
- Modify: `src/features/registration/registration.domain.test.ts`

**Interfaces:**
- Produces: exported `cpfSchema`, `birthDateSchema`, `registrationResumeSchema`, and `RegistrationResumeInput`.
- Produces: a partial unique index named `registrations_cpf_uidx` over non-null CPF values.
- Preserves: historical rows with `cpf is null`; new registrations remain enforced by `registrationSchema`.

- [ ] **Step 1: Write the failing migration and domain tests**

Add assertions equivalent to:

```ts
expect(sql).not.toMatch(/delete\s+from\s+public\.registrations/i);
expect(sql).toContain("create unique index registrations_cpf_uidx");
expect(sql).toContain("where cpf is not null");

expect(
  registrationResumeSchema.parse({ cpf: "529.982.247-25", birthDate: "1990-05-12" }),
).toEqual({ cpf: "52998224725", birthDate: "1990-05-12" });
expect(() =>
  registrationResumeSchema.parse({ cpf: "111.111.111-11", birthDate: "1990-05-12" }),
).toThrow("Informe um CPF válido.");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm run test:run -- src/features/registration/registration-cpf-migration.test.ts src/features/registration/registration.domain.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the migration still deletes registrations, has no unique index, and `registrationResumeSchema` is absent.

- [ ] **Step 3: Implement the CPF contract**

Export the existing schemas and add:

```ts
export const registrationResumeSchema = z
  .object({
    cpf: cpfSchema,
    birthDate: birthDateSchema,
  })
  .strict();

export type RegistrationResumeInput = z.infer<typeof registrationResumeSchema>;
```

Replace the destructive first line of the migration with the existing `alter table`, then append:

```sql
create unique index registrations_cpf_uidx
  on public.registrations (cpf)
  where cpf is not null;
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS with no warnings from these files.

- [ ] **Step 5: Commit only the CPF contract hunks**

Stage the four Task 1 files, inspect the cached diff to ensure unrelated registration redesign hunks are absent, and commit:

```powershell
git diff --cached --check
git commit -m "feat: enforce unique registration cpf"
```

---

### Task 2: Resume an existing registration without exposing participant data

**Files:**
- Modify: `src/features/registration/registration-payment.server.ts`
- Modify: `src/features/registration/registration-payment.server.test.ts`
- Modify: `src/lib/registration.functions.ts`
- Modify: `src/lib/registration.functions.test.ts`
- Create: `src/features/registration/RegistrationResumeCard.tsx`
- Create: `src/features/registration/RegistrationResumeCard.test.tsx`
- Modify: `src/features/registration/RegistrationSection.tsx`
- Modify: `src/features/registration/RegistrationSection.test.tsx`

**Interfaces:**
- Consumes: `RegistrationResumeInput` and `registrationResumeSchema` from Task 1.
- Produces: `RegistrationIdentityRecord`, `RegistrationResumeResult`, `RegistrationRepository.findByCpf(cpf)`, and `RegistrationPaymentService.resumeCheckout(input)`.
- Produces: server function `resumeRegistrationCheckout({ data })` returning `{ status: "pending", checkoutUrl }` or `{ status: "paid" }`.

- [ ] **Step 1: Write failing service, function, and component tests**

Cover all four outcomes:

```ts
await expect(service.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual({
  status: "pending",
  checkoutUrl: "https://checkout.infinitepay.com.br/existing",
});
await expect(service.resumeCheckout({ cpf, birthDate: "1991-01-01" })).rejects.toThrow(
  "Não foi possível localizar uma inscrição com os dados informados.",
);
await expect(paidService.resumeCheckout({ cpf, birthDate: "1990-05-12" })).resolves.toEqual({
  status: "paid",
});
await expect(noUrlService.resumeCheckout({ cpf, birthDate: "1990-05-12" })).rejects.toThrow(
  "Procure a organização para continuar o pagamento.",
);
```

In the UI test, submit only CPF and birth date, assert navigation to the existing checkout for `pending`, and assert “Sua inscrição já está confirmada.” for `paid`. Add a `RegistrationSection` assertion that a known CPF conflict points the user to **Retomar pagamento** instead of clearing the form.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm run test:run -- src/features/registration/registration-payment.server.test.ts src/lib/registration.functions.test.ts src/features/registration/RegistrationResumeCard.test.tsx src/features/registration/RegistrationSection.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the repository lookup, server function, and resume card do not exist.

- [ ] **Step 3: Implement the server resume flow and small UI unit**

Add these contracts:

```ts
export type RegistrationIdentityRecord = {
  birthDate: string;
  paymentStatus: "pending" | "paid" | "legacy";
  checkoutUrl: string | null;
};

export type RegistrationResumeResult =
  | { status: "pending"; checkoutUrl: string }
  | { status: "paid" };
```

`findByCpf` must select only `birth_date,payment_status,checkout_url`. `resumeCheckout` compares the normalized input with that server-only row and returns the minimal union above. `resumeRegistrationCheckout` validates with `registrationResumeSchema` before invoking the service.

Before uploading a photo or creating a pending row, `startCheckout` must call the same `findByCpf` lookup. Any existing row produces the stable CPF-conflict response; the unique index still resolves concurrent submissions that pass the early check.

Build `RegistrationResumeCard` as a compact disclosure/card with CPF and birth-date fields, stable error copy, a disabled loading state, and dependency-injected `resume`/`navigateToCheckout` functions for tests. Mount it below the primary registration form without moving or rewriting the existing photo/CPF UI.

Map Postgres unique violation code `23505` for `registrations_cpf_uidx` to a stable public error telling the user to use the resume card; all other repository details remain hidden.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the resume flow**

Stage new files normally. For the already-dirty registration files, stage only Task 2 hunks, verify `git diff --cached --check`, then commit:

```powershell
git commit -m "feat: resume pending registration by cpf"
```

---

### Task 3: Regent and complement-payment database foundation

**Files:**
- Create through `npx supabase migration new create_regent_portal`: the path printed by the CLI under `supabase/migrations/`, ending in `_create_regent_portal.sql`
- Create: `src/features/regent/regent-migration.test.ts`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces: private tables `public.choir_regents` and `public.registration_complement_payments`.
- Produces: partial unique indexes `choir_regents_active_choir_uidx`, `choir_regents_active_user_uidx`, and `registration_complement_payments_open_uidx`.
- Produces: service-role-only, security-invoker RPC `replace_active_choir_regent` for an atomic revoke-and-grant replacement.
- Produces: generated static row/insert/update types for both tables.

- [ ] **Step 1: Generate the empty migration and write a failing migration test**

Discover the CLI and create the file:

```powershell
npx supabase --help
npx supabase migration new create_regent_portal
```

In the test, locate exactly one file ending `_create_regent_portal.sql` and assert:

```ts
expect(sql).toContain("create table public.choir_regents");
expect(sql).toContain("create table public.registration_complement_payments");
expect(sql).toContain("create unique index choir_regents_active_choir_uidx");
expect(sql).toContain("create unique index registration_complement_payments_open_uidx");
expect(sql).toContain("create or replace function public.replace_active_choir_regent");
expect(sql).toContain("security invoker");
expect(sql).toContain("alter table public.choir_regents enable row level security");
expect(sql).toContain("revoke all on public.choir_regents from anon, authenticated");
expect(sql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
```

- [ ] **Step 2: Run the migration test and verify RED**

Run:

```powershell
npm run test:run -- src/features/regent/regent-migration.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the generated migration is empty.

- [ ] **Step 3: Implement tables, constraints, indexes, and trigger validation**

Create `choir_regents` with UUID primary key, `user_id references auth.users(id) on delete restrict`, `choir_id references public.choirs(id) on delete restrict`, normalized e-mail snapshot, trimmed name, password-change flag, grant/revoke timestamps and actors. Add partial unique indexes where `revoked_at is null` for choir and user. Add `replace_active_choir_regent` as a `security invoker` function with `set search_path = ''`; it revokes the current row and inserts the replacement in one transaction. Revoke its execution from `PUBLIC`, `anon`, and `authenticated`, and grant execution only to `service_role`.

Create `registration_complement_payments` with UUID primary key, registration/choir references using `on delete restrict`, positive integer `amount_cents`, constrained status, unique `order_nsu`, safe checkout/InfinitePay columns, initiator UUID/name/profile snapshots, and timestamps. Add a partial unique index on `registration_id` where status is `creating` or `pending`.

Add a non-`SECURITY DEFINER` trigger function with `set search_path = ''` that rejects insert/update when the registration belongs to another choir, is not paid/promotional, has incomplete snapshots, or the amount exceeds the snapshot complement less already-paid rows. It must also reject changes to registration, choir, order, amount, or initiator after insertion and enforce the transitions `creating -> pending|failed`, `pending -> paid|failed|expired`, with `paid`, `failed`, and `expired` terminal. Revoke function execution from `PUBLIC`, `anon`, and `authenticated`.

Enable RLS; revoke `anon` and `authenticated`; explicitly grant only required operations to `service_role`. Update `src/integrations/supabase/types.ts` manually to match the migration because the remote schema is not being changed.

- [ ] **Step 4: Verify the migration contract**

Run:

```powershell
npm run test:run -- src/features/regent/regent-migration.test.ts --no-file-parallelism --maxWorkers=1
npx supabase migration list --local
```

Expected: migration test PASS; the new local migration appears in the local list. If the CLI reports that no local database is running, record that separately without applying anything remotely.

- [ ] **Step 5: Commit the database foundation**

```powershell
git add -- supabase/migrations src/features/regent/regent-migration.test.ts
# Stage only the Task 3 table/type hunks from the already-modified types file.
git add -p -- src/integrations/supabase/types.ts
git diff --cached --check
git commit -m "feat: add regent payment ledger schema"
```

---

### Task 4: Regent access domain and server authorization

**Files:**
- Create: `src/features/regent/regent.domain.ts`
- Create: `src/features/regent/regent.domain.test.ts`
- Create: `src/features/regent/regent-auth.server.ts`
- Create: `src/features/regent/regent-auth.server.test.ts`
- Create: `src/features/regent/regent-auth.middleware.ts`
- Create: `src/lib/regent.functions.ts`
- Create: `src/lib/regent.functions.test.ts`

**Interfaces:**
- Produces: `RegentAccess`, `PortalAccess`, `regentMutationSchema`, `regentIdSchema`, and `portalChoirSelectionSchema`.
- Produces: `createPortalAuthorizer(repository)`, `getPortalAuthorizer()`, `requirePortalAccess`, and `requirePortalReadyAccess`.
- Produces: `getRegentAccess()` returning `unauthenticated`, `forbidden`, `password_change_required`, or `authorized` with role and allowed choir.

- [ ] **Step 1: Write failing domain and authorization tests**

Use exact access unions:

```ts
type PortalAccess =
  | { role: "admin"; userId: string; email: string | null }
  | {
      role: "regent";
      userId: string;
      membershipId: string;
      choirId: string;
      name: string;
      email: string;
      passwordChangeRequired: boolean;
    };
```

Assert admin precedence, active regent lookup, rejection of a revoked/missing association, and rejection by `requirePortalReadyAccess` when `passwordChangeRequired` is true. Parse an admin choir selection only from a UUID; ensure a regent-supplied different UUID is ignored/rejected by the handler.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent.domain.test.ts src/features/regent/regent-auth.server.test.ts src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the feature files do not exist.

- [ ] **Step 3: Implement server-side access lookup**

`createPortalAuthorizer` receives two lookups: existing `getAdminAuthorizer().findActive(userId)` and a repository query selecting the active `choir_regents` row. It returns admin access first, otherwise regent access, otherwise throws “Acesso não autorizado.” The middleware copies the verified Auth e-mail into admin access and uses the regent table's e-mail snapshot for regent access so payment history has a stable actor label.

`requirePortalAccess` composes `requireSupabaseAuth`; `requirePortalReadyAccess` additionally blocks only regents with a pending password change. Add a pure resolver:

```ts
export function resolveAuthorizedChoir(access: PortalAccess, requestedChoirId?: string): string {
  if (access.role === "regent") return access.choirId;
  return z.string().uuid("Selecione um coro válido.").parse(requestedChoirId);
}
```

Keep all Supabase queries in `regent-auth.server.ts`, and return only minimal access state from `getRegentAccess`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the authorization boundary**

```powershell
git add -- src/features/regent/regent.domain.ts src/features/regent/regent.domain.test.ts src/features/regent/regent-auth.server.ts src/features/regent/regent-auth.server.test.ts src/features/regent/regent-auth.middleware.ts src/lib/regent.functions.ts src/lib/regent.functions.test.ts
git diff --cached --check
git commit -m "feat: authorize regent portal access"
```

---

### Task 5: Administrative regent lifecycle

**Files:**
- Create: `src/features/regent/regent-admin.server.ts`
- Create: `src/features/regent/regent-admin.server.test.ts`
- Modify: `src/lib/regent.functions.ts`
- Modify: `src/lib/regent.functions.test.ts`
- Create: `src/features/admin/AdminRegentsPanel.tsx`
- Create: `src/features/admin/AdminRegentsPanel.test.tsx`
- Modify: `src/features/admin/AdminChoirsPage.tsx`
- Modify: `src/features/admin/AdminChoirsPage.test.tsx`
- Modify: `src/features/admin/AdminNavigation.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `regentMutationSchema`, and the Task 3 tables.
- Produces: `AdminRegentRow`, `RegentAdminRepository`, `RegentAuthAdminPort`, and `createRegentAdminService(deps)`.
- Produces: protected functions `listAdminRegents`, `createAdminRegent`, `replaceAdminRegent`, `revokeAdminRegent`, and `resetAdminRegentPassword`.

- [ ] **Step 1: Write failing service and UI tests**

Test create-user attributes and rollback:

```ts
expect(auth.createUser).toHaveBeenCalledWith({
  email: "regente@example.com",
  password: "SenhaTemp123",
  emailConfirm: true,
});
expect(repository.grant).toHaveBeenCalledWith(
  expect.objectContaining({ choirId, userId: createdUserId, passwordChangeRequired: true }),
);
```

Also assert: existing email conflict does not mutate a user; failed grant deletes only the just-created Auth user; replace calls the atomic replacement RPC so a failed grant leaves the old regent active; reset calls `updateUserById(userId, { password })` and sets the flag; every server function uses `requireAdmin`.

In `AdminRegentsPanel`, assert fields **Nome**, **E-mail**, **Coro**, **Senha temporária**, the no-email warning, and actions **Cadastrar regente**, **Substituir**, **Inativar**, and **Redefinir senha**.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-admin.server.test.ts src/lib/regent.functions.test.ts src/features/admin/AdminRegentsPanel.test.tsx src/features/admin/AdminChoirsPage.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the service and panel do not exist.

- [ ] **Step 3: Implement the lifecycle and panel**

Use server-only wrappers around the documented APIs:

```ts
supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
supabaseAdmin.auth.admin.updateUserById(userId, { password });
supabaseAdmin.auth.admin.deleteUser(userId);
```

Never place the password in the repository object or audit row. Return mapped conflict/success states rather than Supabase error text. Create the link only after the Auth user exists; on a link failure, delete only that newly created user.

Render `AdminRegentsPanel` inside `/admin/coros`, using existing choir rows as options. Keep values after recoverable errors and require confirmation before inactivation/replacement. Extend `AdminNavigation` with **Área dos regentes** linking to `/regente` without treating it as an admin-only route.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the administrative lifecycle**

Stage only Task 5 hunks in already-dirty admin files, inspect the cached diff, then commit:

```powershell
git diff --cached --check
git commit -m "feat: manage choir regents"
```

---

### Task 6: Regent login and mandatory password change

**Files:**
- Create: `src/features/regent/RegentLoginPage.tsx`
- Create: `src/features/regent/RegentLoginPage.test.tsx`
- Create: `src/features/regent/RegentPasswordChangePage.tsx`
- Create: `src/features/regent/RegentPasswordChangePage.test.tsx`
- Create: `src/routes/regente.login.tsx`
- Create: `src/routes/regente.alterar-senha.tsx`
- Modify: `src/lib/regent.functions.ts`
- Modify: `src/lib/regent.functions.test.ts`
- Modify generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `getRegentAccess` and `requirePortalAccess` from Task 4.
- Produces: `completeRegentPasswordChange()` and two route components.

- [ ] **Step 1: Write failing login, password-change, and handler tests**

Assert that login uses:

```ts
signIn({ email: "regente@example.com", password: "SenhaTemp123" });
```

Then assert routing to `/regente/alterar-senha` for `password_change_required`, `/regente` for an authorized regent/admin, and a generic error plus sign-out for forbidden access.

For password change, assert two equal passwords of at least eight characters, call `supabase.auth.updateUser({ password })`, then call `completeRegentPasswordChange`. If the second call fails, show a retry action without asking the user to re-enter or log the password.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/RegentLoginPage.test.tsx src/features/regent/RegentPasswordChangePage.test.tsx src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the pages and completion function do not exist.

- [ ] **Step 3: Implement pages, routes, and completion**

Follow the existing `AdminLoginPage` injection pattern. The completion server function updates only the caller's active `choir_regents.password_change_required` from true to false. It is protected by `requirePortalAccess`, not a user-supplied ID.

Both routes add `noindex,nofollow` metadata. After creating route files, run `npm run build` once to generate the route-tree entries, then inspect that only the two new routes were added to `src/routeTree.gen.ts`.

- [ ] **Step 4: Verify focused tests and route generation**

```powershell
npm run test:run -- src/features/regent/RegentLoginPage.test.tsx src/features/regent/RegentPasswordChangePage.test.tsx src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1
npm run build
```

Expected: tests PASS and build succeeds.

- [ ] **Step 5: Commit the authentication UI**

```powershell
git add -- src/features/regent/RegentLoginPage.tsx src/features/regent/RegentLoginPage.test.tsx src/features/regent/RegentPasswordChangePage.tsx src/features/regent/RegentPasswordChangePage.test.tsx src/routes/regente.login.tsx src/routes/regente.alterar-senha.tsx src/lib/regent.functions.ts src/lib/regent.functions.test.ts src/routeTree.gen.ts
git diff --cached --check
git commit -m "feat: add regent password login"
```

---

### Task 7: Complement balance and presentation domain

**Files:**
- Create: `src/features/regent/regent-payments.domain.ts`
- Create: `src/features/regent/regent-payments.domain.test.ts`

**Interfaces:**
- Produces: `ComplementEligibility`, `ComplementPaymentRow`, `PortalParticipant`, `PortalSummary`, `complementCheckoutSchema`, `calculateComplementState`, and `buildBrazilWhatsAppUrl`.

- [ ] **Step 1: Write failing financial and WhatsApp tests**

Use these representative assertions:

```ts
expect(
  calculateComplementState({
    paymentStatus: "paid",
    pricingType: "promotional",
    standardPriceCents: 30000,
    registrationPriceCents: 10000,
    confirmedComplementCents: 5000,
    openPayment: null,
  }),
).toEqual({ eligible: true, totalCents: 20000, paidCents: 5000, balanceCents: 15000 });

expect(calculateComplementState(normalRegistration).eligible).toBe(false);
expect(calculateComplementState(unpaidPromotionalRegistration)).toEqual({
  eligible: false,
  reason: "awaiting_participant_payment",
});
expect(buildBrazilWhatsAppUrl("(88) 99999-1234")).toBe("https://wa.me/5588999991234");
```

Validate payment inputs as UUID registration ID plus integer cents greater than zero.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-payments.domain.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the domain module does not exist.

- [ ] **Step 3: Implement pure financial mapping**

Calculate solely from registration snapshots and confirmed ledger rows. Return explicit ineligible reasons: `standard_price`, `awaiting_participant_payment`, `missing_snapshot`, and `settled`. Treat negative or inconsistent snapshots as `missing_snapshot`, never as credit.

Build `wa.me` only for 10/11 Brazilian digits, prefixing `55`; otherwise return `null` so the UI renders non-clickable phone text.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the domain**

```powershell
git add -- src/features/regent/regent-payments.domain.ts src/features/regent/regent-payments.domain.test.ts
git diff --cached --check
git commit -m "feat: calculate choir complement balances"
```

---

### Task 8: Authorized portal queries and private photos

**Files:**
- Create: `src/features/regent/regent-portal.server.ts`
- Create: `src/features/regent/regent-portal.server.test.ts`
- Modify: `src/lib/regent.functions.ts`
- Modify: `src/lib/regent.functions.test.ts`

**Interfaces:**
- Consumes: `resolveAuthorizedChoir`, `calculateComplementState`, the ledger types, and Storage bucket `registration-photos`.
- Produces: `PortalParticipantQuery`, `PortalParticipantPage`, `RegentPortalRepository`, `createRegentPortalService`, `listRegentPortalParticipants`, and `getRegentPortalSummary`.

- [ ] **Step 1: Write failing repository, service, and function tests**

Assert the repository query always includes `.eq("choir_id", authorizedChoirId)` before search/range, never uses a choir ID directly from regent input, and selects only required fields. Assert photo signing receives only page-row paths and expiry `300`.

Test mapping of one paid promotional participant with two paid installments and one pending installment. The summary must count only confirmed amounts; the row must expose the pending checkout as an action without subtracting it from `balanceCents`.

Test admin selection and regent isolation through the real handler factory.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-portal.server.test.ts src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the portal service and functions do not exist.

- [ ] **Step 3: Implement paginated server queries and DTO mapping**

Use a strict query schema with `search` max 100, page at least 1, and page size at most 50. Escape `%`, `_`, backslashes, and quotes before the PostgREST `or` filter for name/CPF. Do not put search in route search parameters.

Fetch registrations by authorized choir, fetch their complement rows, group by registration ID, and map through `calculateComplementState`. Generate five-minute signed URLs with the server-only Storage client. A signing failure yields `photoUrl: null` for that row rather than failing the entire page.

Compute the all-choir summary separately from the current page, still filtered by the authorized choir. Return integer cents and public display fields only.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the portal data layer**

```powershell
git add -- src/features/regent/regent-portal.server.ts src/features/regent/regent-portal.server.test.ts src/lib/regent.functions.ts src/lib/regent.functions.test.ts
git diff --cached --check
git commit -m "feat: serve authorized regent participants"
```

---

### Task 9: Create partial complement checkouts

**Files:**
- Modify: `src/features/registration/infinitepay.server.ts`
- Modify: `src/features/registration/infinitepay.server.test.ts`
- Create: `src/features/regent/regent-payment.server.ts`
- Create: `src/features/regent/regent-payment.server.test.ts`
- Modify: `src/lib/regent.functions.ts`
- Modify: `src/lib/regent.functions.test.ts`

**Interfaces:**
- Consumes: `InfinitePayClient`, `complementCheckoutSchema`, ready portal access, and Task 3 ledger.
- Produces: optional checkout `customer` and configurable `redirectPath` in `InfinitePayClient.createCheckout`.
- Produces: `RegentPaymentRepository`, `createRegentPaymentService`, and protected `startComplementCheckout`.

- [ ] **Step 1: Write failing client and payment-service tests**

Assert the InfinitePay payload can omit customer data and uses `/regente/pagamento` as redirect while retaining the existing webhook URL. For the service, assert:

```ts
await expect(service.startCheckout({ registrationId, amountCents: 5000 }, access)).resolves.toEqual({
  checkoutUrl: "https://checkout.infinitepay.com.br/complement",
  orderNsu,
});
expect(repository.reserve).toHaveBeenCalledWith(
  expect.objectContaining({ registrationId, choirId, amountCents: 5000, status: "creating" }),
);
```

Also assert rejection of a different choir, unpaid/normal registration, amount above balance, existing open payment, and password-change-required access. Provider failure marks the reserved row `failed`; success saves URL and moves it to `pending`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/registration/infinitepay.server.test.ts src/features/regent/regent-payment.server.test.ts src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the client input and complement service are absent.

- [ ] **Step 3: Implement checkout reservation and provider call**

Extend the client input without changing existing registration payloads:

```ts
createCheckout(input: {
  orderNsu: string;
  items: CheckoutItem[];
  customer?: { name: string; email: string; phoneNumber?: string };
  redirectPath?: "/pagamento" | "/regente/pagamento";
}): Promise<{ url: string }>;
```

For complements, send one item with quantity 1, the chosen amount, and description `Complemento de inscrição — II Encontro de Coros`. Do not include participant PII in the provider description or customer object.

Re-read the registration and paid ledger rows immediately before `reserve`. Resolve the authorized choir on the server. Convert unique-index/trigger failures into stable balance/open-checkout messages. Save initiator ID, name, and profile snapshot, never a password.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS, including unchanged original registration checkout tests.

- [ ] **Step 5: Commit complement checkout creation**

```powershell
git add -- src/features/registration/infinitepay.server.ts src/features/registration/infinitepay.server.test.ts src/features/regent/regent-payment.server.ts src/features/regent/regent-payment.server.test.ts src/lib/regent.functions.ts src/lib/regent.functions.test.ts
git diff --cached --check
git commit -m "feat: create partial complement checkouts"
```

---

### Task 10: Confirm complement payments through return and webhook

**Files:**
- Modify: `src/features/regent/regent-payment.server.ts`
- Modify: `src/features/regent/regent-payment.server.test.ts`
- Create: `src/features/regent/ComplementPaymentConfirmationPage.tsx`
- Create: `src/features/regent/ComplementPaymentConfirmationPage.test.tsx`
- Create: `src/routes/regente.pagamento.tsx`
- Create: `src/features/registration/payment-dispatch.server.ts`
- Create: `src/features/registration/payment-dispatch.server.test.ts`
- Modify: `src/routes/api/infinitepay-webhook.ts`
- Modify: `src/features/registration/webhook.server.test.ts`
- Modify generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: existing `PaymentLookup`, `InfinitePayClient.checkPayment`, and registration reconciliation.
- Produces: `RegentPaymentService.reconcilePayment`, `getComplementPaymentStatus`, and `dispatchPaymentReconciliation`.

- [ ] **Step 1: Write failing reconciliation, dispatcher, and page tests**

Assert a paid provider response is accepted only when `checked.amountCents === ledger.amountCents` and `checked.paidAmountCents >= ledger.amountCents`. Assert repeat confirmation with the same transaction returns paid, while a different transaction, order, or original amount is rejected.

Test dispatcher behavior: complement `order_nsu` routes to complement service; otherwise it routes to existing registration service. Test the protected return page states **Confirmado**, **Processando**, **Não confirmado**, and retry.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-payment.server.test.ts src/features/regent/ComplementPaymentConfirmationPage.test.tsx src/features/registration/payment-dispatch.server.test.ts src/features/registration/webhook.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because reconciliation, dispatcher, and page are absent.

- [ ] **Step 3: Implement idempotent confirmation and routing**

Use the same payment-check contract as original registrations. Store invoice slug, transaction NSU, capture method, installments, paid amount, sanitized receipt URL, and paid timestamp. Update from `pending` to `paid` with a returned-row check; if no row changes, load the existing row and accept only the same transaction.

The webhook remains a notification and calls `dispatchPaymentReconciliation`; it never trusts webhook amount/status alone. The `/regente/pagamento` route parses the same search keys as `/pagamento`, requires ready portal access, and returns to `/regente` after success.

Run `npm run build` to regenerate only the expected new route entry.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
npm run test:run -- src/features/regent/regent-payment.server.test.ts src/features/regent/ComplementPaymentConfirmationPage.test.tsx src/features/registration/payment-dispatch.server.test.ts src/features/registration/webhook.server.test.ts --no-file-parallelism --maxWorkers=1
npm run build
```

Expected: tests PASS and build succeeds.

- [ ] **Step 5: Commit payment confirmation**

```powershell
git add -- src/features/regent src/features/registration/payment-dispatch.server.ts src/features/registration/payment-dispatch.server.test.ts src/routes/regente.pagamento.tsx src/routes/api/infinitepay-webhook.ts src/features/registration/webhook.server.test.ts src/routeTree.gen.ts
git diff --cached --check
git commit -m "feat: confirm complement payments"
```

---

### Task 11: Shared responsive regent/admin portal UI

**Files:**
- Create: `src/features/regent/RegentPortalPage.tsx`
- Create: `src/features/regent/RegentPortalPage.test.tsx`
- Create: `src/features/regent/RegentParticipantList.tsx`
- Create: `src/features/regent/RegentParticipantList.test.tsx`
- Create: `src/features/regent/ComplementPaymentDialog.tsx`
- Create: `src/features/regent/ComplementPaymentDialog.test.tsx`
- Create: `src/routes/regente.tsx`
- Modify generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: portal list/summary functions, `startComplementCheckout`, and `getRegentAccess`.
- Produces: the `/regente` route and shared page used by regents and administrators.

- [ ] **Step 1: Write failing page, list, and dialog tests**

Cover:

```ts
expect(screen.getByText("Total de participantes")).toBeInTheDocument();
expect(screen.getByText("Complemento total")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute(
  "href",
  "https://wa.me/5588999991234",
);
expect(screen.getByRole("button", { name: "Pagar complemento" })).toBeEnabled();
```

Also assert admin choir selector presence, its absence for regents, photo fallback, CPF formatting, paid/pending badges, **Aguardando pagamento do participante**, **Continuar pagamento**, expandable installment history, search not written to URL, pagination, amount above balance blocked, and double-submit protection.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/RegentPortalPage.test.tsx src/features/regent/RegentParticipantList.test.tsx src/features/regent/ComplementPaymentDialog.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the UI files do not exist.

- [ ] **Step 3: Implement compact desktop/mobile presentation**

Render four summary cards, an in-memory search draft submitted to the server function, a semantic table at desktop breakpoints, and compact participant cards on mobile. Reuse existing `Card`, `Table`, `Dialog`, `Input`, `Button`, `Badge`, and `Avatar` components.

The payment dialog accepts a Brazilian currency string, converts it to exact cents using the existing choir-pricing money parser, displays the maximum balance, and calls `startComplementCheckout` once. Navigate only to the safe URL returned by the server.

The route resolves access on load: unauthenticated/forbidden users go to `/regente/login`; password-change-required regents go to `/regente/alterar-senha`; authorized users render the portal. Administrators can select a choir, but every subsequent function still resolves authorization server-side.

- [ ] **Step 4: Verify focused UI and route generation**

```powershell
npm run test:run -- src/features/regent/RegentPortalPage.test.tsx src/features/regent/RegentParticipantList.test.tsx src/features/regent/ComplementPaymentDialog.test.tsx --no-file-parallelism --maxWorkers=1
npm run build
```

Expected: tests PASS, build succeeds, and `src/routeTree.gen.ts` contains `/regente` without unrelated generated churn.

- [ ] **Step 5: Commit the portal UI**

```powershell
git add -- src/features/regent/RegentPortalPage.tsx src/features/regent/RegentPortalPage.test.tsx src/features/regent/RegentParticipantList.tsx src/features/regent/RegentParticipantList.test.tsx src/features/regent/ComplementPaymentDialog.tsx src/features/regent/ComplementPaymentDialog.test.tsx src/routes/regente.tsx src/routeTree.gen.ts
git diff --cached --check
git commit -m "feat: add shared regent portal"
```

---

### Task 12: Security, migration, and full-project verification

**Files:**
- Modify only if verification exposes a scoped defect: files already changed in Tasks 1–11
- Review: `docs/superpowers/specs/2026-09-10-regent-area-design.md`
- Review: the migration ending `_create_regent_portal.sql`

**Interfaces:**
- Verifies all interfaces and global constraints; produces no new feature contract.

- [ ] **Step 1: Run focused feature suites**

```powershell
npm run test:run -- src/features/regent src/features/registration/registration-cpf-migration.test.ts src/features/registration/registration-payment.server.test.ts src/features/registration/payment-dispatch.server.test.ts src/lib/regent.functions.test.ts --no-file-parallelism --maxWorkers=1 --exclude "**/.worktrees/**"
```

Expected: all focused tests PASS with zero unhandled errors.

- [ ] **Step 2: Run static and migration checks**

```powershell
npx tsc --noEmit
npx eslint src/features/regent src/features/registration/registration.domain.ts src/features/registration/registration-payment.server.ts src/features/registration/infinitepay.server.ts src/features/registration/payment-dispatch.server.ts src/lib/regent.functions.ts src/routes/regente.tsx src/routes/regente.login.tsx src/routes/regente.alterar-senha.tsx src/routes/regente.pagamento.tsx src/routes/api/infinitepay-webhook.ts
npx supabase --version
npx supabase migration list --local
```

Expected: TypeScript and ESLint exit 0. Report local Supabase/Docker unavailability separately; do not substitute a remote apply.

- [ ] **Step 3: Run the full serial suite and production build**

```powershell
npm run test:run -- --no-file-parallelism --maxWorkers=1 --exclude "**/.worktrees/**"
npm run build
```

Expected: full suite PASS and production build exits 0.

- [ ] **Step 4: Perform explicit security and scope review**

Verify with searches and diffs:

```powershell
rg -n "service_role|SUPABASE_SERVICE|password|user_metadata|delete from public\.registrations" src supabase/migrations
git diff --check
git status --short
git log --oneline --decorate main..HEAD
```

Confirm: no client-side secret; no authorization based on `user_metadata`; no logged/stored temporary password; no destructive registration deletion; every new table has RLS plus revoked public grants; every portal query filters the server-resolved choir; only approved files are committed.

- [ ] **Step 5: Review the branch without pushing or deploying**

Use the `superpowers:requesting-code-review` skill against the complete branch diff. Address only verified in-scope findings with a failing regression test first. Re-run the affected focused suite plus Steps 2–4, then report local branch SHA, test counts, and the still-separate remote migration/push/Lovable/payment-validation steps.

## Current official references

- Supabase admin user creation: `https://supabase.com/docs/reference/javascript/auth-admin-createuser`
- Supabase admin password reset: `https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid`
- Supabase password sign-in and authenticated password update: `https://supabase.com/docs/reference/javascript/auth-signinwithpassword` and `https://supabase.com/docs/reference/javascript/auth-updateuser`
- Supabase RLS/grants guidance: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase private Storage signed URLs: `https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl`
- InfinitePay Checkout, webhook, and `payment_check`: `https://www.infinitepay.io/checkout-documentacao`
