# Choir Event Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated choir CRUD and global standard/promotional event pricing that automatically quotes and snapshots the correct registration price.

**Architecture:** A private singleton settings table stores the two global prices, while a private choir table stores availability and promotional eligibility. Server functions expose a minimal resolved public list and separately authorize all administrative reads and mutations; checkout re-resolves the selected choir and compares the displayed quote before persisting immutable pricing snapshots.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Zod, Supabase/Postgres with RLS, Vitest, Testing Library, Tailwind/shadcn UI.

**Spec:** `docs/superpowers/specs/2026-09-09-choir-registration-pricing-design.md`

## Global Constraints

- No choir or monetary value is seeded; the administrator configures everything.
- The participant selects only a choir/diocese; promotional pricing is automatic and cannot be overridden in the browser.
- A promotional choir is public only when both standard and promotional prices are configured; a standard choir requires the standard price.
- Existing registrations and their payment history must remain intact and must not receive invented pricing data.
- All administrative operations call `requireAdmin`; `anon` and `authenticated` receive no direct table grants.
- Prices are positive integer cents, and a configured promotional price is lower than the configured standard price.
- Remote SQL, Git push, and Lovable publication are outside this implementation.
- Use `npx supabase` with explicit `--local`/`--linked` targeting; never run a remote mutation in this plan.

---

### Task 1: Pricing and choir domain

**Files:**
- Create: `src/features/choirs/choir-pricing.domain.ts`
- Test: `src/features/choirs/choir-pricing.domain.test.ts`

**Interfaces:**
- Produces: `pricingSettingsSchema`, `choirMutationSchema`, `choirIdSchema`, `displayedQuoteSchema`.
- Produces: `PricingSettings`, `AdminChoir`, `PublicChoirOption`, `DisplayedQuote`, `ResolvedChoirPrice`.
- Produces: `parseCurrencyToCents(value: string): number | null`, `formatCentsForInput(value: number | null): string`, and `resolveChoirPrice(choir, settings): ResolvedChoirPrice | null`.

- [ ] **Step 1: Write failing domain tests**

Cover exact BRL parsing (`"300,00" -> 30000`, blank -> `null`), rejection of zero/negative/more than two decimals, promotional price lower than standard when both exist, trimmed unique-ready names, and resolution rules:

```ts
expect(resolveChoirPrice(promotionalChoir, { standardPriceCents: 30000, promotionalPriceCents: 10000 })).toEqual({
  pricingType: "promotional",
  standardPriceCents: 30000,
  registrationPriceCents: 10000,
});
expect(resolveChoirPrice(promotionalChoir, { standardPriceCents: 30000, promotionalPriceCents: null })).toBeNull();
expect(resolveChoirPrice(standardChoir, { standardPriceCents: 30000, promotionalPriceCents: null })?.registrationPriceCents).toBe(30000);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:run -- src/features/choirs/choir-pricing.domain.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the domain module does not exist.

- [ ] **Step 3: Implement the minimal domain**

Use strict Zod objects. Keep database cents as integers and form currency as strings. `PublicChoirOption` must contain only `id`, `name`, `pricingType`, `standardPriceCents`, and `registrationPriceCents`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2 and require a clean pass.

- [ ] **Step 5: Commit the domain**

```powershell
git add -- src/features/choirs/choir-pricing.domain.ts src/features/choirs/choir-pricing.domain.test.ts
git commit -m "feat: add choir pricing domain"
```

### Task 2: Local database migration and generated types

**Files:**
- Create through CLI: the path printed by `npx supabase migration new create_choir_event_pricing`, ending in `_create_choir_event_pricing.sql`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/features/choirs/choir-pricing-migration.test.ts`

**Interfaces:**
- Produces: private tables `public.event_registration_settings` and `public.choirs`.
- Produces: registration columns `choir_id`, `choir_name`, `pricing_type`, `standard_price_cents`, and `registration_price_cents`.
- Preserves: existing registration rows with renamed `diocese` text and nullable new snapshots.

- [ ] **Step 1: Write the failing migration contract test**

Read the single migration matching `_create_choir_event_pricing.sql` and assert that it:

```ts
expect(sql).toContain("create table public.event_registration_settings");
expect(sql).toContain("create table public.choirs");
expect(sql).toContain("alter table public.choirs enable row level security");
expect(sql).toContain("revoke all on public.choirs from anon, authenticated");
expect(sql).toContain("rename column diocese to choir_name");
expect(sql).not.toMatch(/insert\s+into\s+public\.choirs/i);
```

Also assert the singleton-row check, case-insensitive unique index, positive-price checks, promotion-below-standard check, `ON DELETE RESTRICT`, and all-or-none snapshot consistency for new registrations.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `npm run test:run -- src/features/choirs/choir-pricing-migration.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because no matching migration exists.

- [ ] **Step 3: Discover and create the migration with the CLI**

```powershell
npx supabase --version
npx supabase migration new create_choir_event_pricing
```

Use the CLI-generated filename. Write SQL that creates the singleton settings row with null prices, creates no choir rows, enables RLS, revokes `anon`/`authenticated`, grants only required operations to `service_role`, renames `registrations.diocese`, drops the old fixed-diocese constraint, and adds nullable historical snapshot columns plus consistency checks.

- [ ] **Step 4: Update generated TypeScript table shapes**

Represent both new tables and renamed/added registration fields in `Database["public"]["Tables"]`; do not connect to the linked project merely to regenerate types.

- [ ] **Step 5: Verify migration contract and local migration chain**

```powershell
npm run test:run -- src/features/choirs/choir-pricing-migration.test.ts --no-file-parallelism --maxWorkers=1
npx supabase migration list --local
```

If the local database runtime is available, also run `npx supabase db reset --local`; if unavailable, record the exact environmental blocker and retain the static contract test.

- [ ] **Step 6: Commit schema work**

```powershell
git add -- supabase/migrations src/integrations/supabase/types.ts src/features/choirs/choir-pricing-migration.test.ts
git commit -m "feat: add choir pricing schema"
```

### Task 3: Server repositories and functions

**Files:**
- Create: `src/features/choirs/choir-pricing.server.ts`
- Test: `src/features/choirs/choir-pricing.server.test.ts`
- Create: `src/lib/choir-pricing.functions.ts`
- Test: `src/lib/choir-pricing.functions.test.ts`

**Interfaces:**
- Produces: `ChoirPricingRepository` with `getSettings`, `saveSettings`, `listAdminChoirs`, `createChoir`, `updateChoir`, and `setChoirActive`.
- Produces: `ChoirPricingService` with `listPublicOptions` and the administrative methods.
- Produces public server function `listPublicChoirOptions` without auth middleware.
- Produces protected functions `getAdminChoirPricing`, `saveAdminPricingSettings`, `createAdminChoir`, `updateAdminChoir`, and `setAdminChoirActive`, each using `requireAdmin`.

- [ ] **Step 1: Write failing repository/service tests**

Test that public options omit inactive and unresolved rows and contain only the public fields. Test safe error mapping, lowercased-name duplicate conflicts, price-setting validation, and persistence mappings.

- [ ] **Step 2: Verify repository/service tests fail**

Run: `npm run test:run -- src/features/choirs/choir-pricing.server.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the server module does not exist.

- [ ] **Step 3: Implement repository and service**

Query settings and choirs server-side through `supabaseAdmin`. Return safe Portuguese errors. Resolve options with `resolveChoirPrice`; sort them by name using `pt-BR` locale semantics.

- [ ] **Step 4: Verify repository/service tests pass**

Run the command from Step 2 and require GREEN.

- [ ] **Step 5: Write failing server-function handler tests**

Test pure exported handlers with invalid payloads and assert the declared protected functions use `requireAdmin` while `listPublicChoirOptions` exposes only the public service method.

- [ ] **Step 6: Implement the server functions**

Create the five server functions with the middleware and validators declared in the interfaces block.

- [ ] **Step 7: Verify server-function tests are GREEN**

Run: `npm run test:run -- src/lib/choir-pricing.functions.test.ts --no-file-parallelism --maxWorkers=1`

- [ ] **Step 8: Commit server boundary**

```powershell
git add -- src/features/choirs/choir-pricing.server.ts src/features/choirs/choir-pricing.server.test.ts src/lib/choir-pricing.functions.ts src/lib/choir-pricing.functions.test.ts
git commit -m "feat: add protected choir pricing services"
```

### Task 4: Administrative page and navigation

**Files:**
- Create: `src/features/admin/AdminNavigation.tsx`
- Create: `src/features/admin/AdminChoirsPage.tsx`
- Test: `src/features/admin/AdminChoirsPage.test.tsx`
- Create: `src/routes/admin.coros.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.test.tsx`
- Modify generated route metadata: `src/routeTree.gen.ts` through the existing TanStack generator only

**Interfaces:**
- Consumes the protected functions from Task 3.
- Produces `/admin/coros` with settings form, choir create/edit dialog, inactivate confirmation, reactivate action, retry states, and preserved form drafts on errors.
- Produces shared links **Inscrições** and **Coros e valores**.

- [ ] **Step 1: Write failing UI tests**

Assert that an authorized page renders both currency inputs, `Não configurado`, an empty choir state, and create/edit/inactivate/reactivate flows. Verify a promotional choir without configured promotional pricing shows the warning that it remains hidden publicly. Verify save errors keep entered values.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm run test:run -- src/features/admin/AdminChoirsPage.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement shared navigation and admin page**

Reuse existing shadcn `Card`, `Input`, `Button`, `Switch`, `Dialog`, `AlertDialog`, `Table`, `Badge`, and `Skeleton`. Keep mobile cards and desktop table. Use explicit save buttons and `aria-live` status text.

- [ ] **Step 4: Add route and registration-page navigation**

Create the route wrapper with login redirects matching `/admin/inscricoes`. Add `AdminNavigation` to both pages and let the existing TanStack generator update `src/routeTree.gen.ts`; do not hand-edit generated route declarations.

- [ ] **Step 5: Verify focused admin tests**

```powershell
npm run test:run -- src/features/admin/AdminChoirsPage.test.tsx src/features/admin/AdminRegistrationsPage.test.tsx --no-file-parallelism --maxWorkers=1
```

- [ ] **Step 6: Commit admin UI**

```powershell
git add -- src/features/admin/AdminNavigation.tsx src/features/admin/AdminChoirsPage.tsx src/features/admin/AdminChoirsPage.test.tsx src/features/admin/AdminRegistrationsPage.tsx src/features/admin/AdminRegistrationsPage.test.tsx src/routes/admin.coros.tsx src/routeTree.gen.ts
git commit -m "feat: add choir pricing administration"
```

### Task 5: Public form and checkout price resolution

**Files:**
- Modify: `src/features/registration/registration.domain.ts`
- Modify: `src/features/registration/registration.domain.test.ts`
- Modify: `src/features/registration/registration-payment.server.ts`
- Modify: `src/features/registration/registration-payment.server.test.ts`
- Modify: `src/features/registration/RegistrationSection.tsx`
- Modify: `src/features/registration/RegistrationSection.test.tsx`
- Modify: `src/lib/registration.functions.ts`
- Modify: `src/lib/admin.functions.test.ts`

**Interfaces:**
- Consumes `PublicChoirOption`, `DisplayedQuote`, and server-side pricing service from Tasks 1 and 3.
- Changes `RegistrationInput` from fixed `diocese` to `choirId` plus displayed quote fields used only for stale-quote comparison.
- Changes checkout builders to accept a trusted `ResolvedChoirPrice`.
- Persists `choir_id`, `choir_name`, `pricing_type`, `standard_price_cents`, `registration_price_cents`, and the trusted total.

- [ ] **Step 1: Write failing registration-domain tests**

Remove assertions for the fixed diocese enum. Assert UUID choir validation, checkout items built from a trusted 30000/10000 quote, shirt addition, and no client-controlled pricing path.

- [ ] **Step 2: Run the registration-domain test and verify RED**

```powershell
npm run test:run -- src/features/registration/registration.domain.test.ts --no-file-parallelism --maxWorkers=1
```

- [ ] **Step 3: Implement the registration-domain changes**

Replace the fixed diocese enum with UUID choir selection and make checkout builders require a trusted resolved price argument.

- [ ] **Step 4: Re-run the registration-domain test and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Write failing payment-service tests**

Assert that `startCheckout` resolves the choir on the server, rejects inactive/unpriced/stale quotes before `createPending`, automatically applies promotion, and persists all snapshots. Assert `amount_cents` equals trusted registration price plus shirt.

- [ ] **Step 6: Run the payment-service test and verify RED**

Run: `npm run test:run -- src/features/registration/registration-payment.server.test.ts --no-file-parallelism --maxWorkers=1`

- [ ] **Step 7: Implement server checkout integration**

Inject the choir pricing resolver into the payment service, compare the displayed quote, and persist the trusted snapshots before creating the InfinitePay checkout.

- [ ] **Step 8: Re-run the payment-service test and verify GREEN**

Run: `npm run test:run -- src/features/registration/registration-payment.server.test.ts --no-file-parallelism --maxWorkers=1`

- [ ] **Step 9: Write failing public-form tests**

Assert loading/retry/empty states, the label **Coro/Diocese**, automatic standard price, automatic promotional price, no price-choice control, dynamic raffle notice, total with shirt, and form preservation after stale quote.

- [ ] **Step 10: Run the public-form test and verify RED**

Run: `npm run test:run -- src/features/registration/RegistrationSection.test.tsx --no-file-parallelism --maxWorkers=1`

- [ ] **Step 11: Implement the public form**

Load public options, derive the displayed quote from the selected option, render the promotion notice, and preserve all non-choir fields on a stale-quote response.

- [ ] **Step 12: Re-run the public-form test and verify GREEN**

Run: `npm run test:run -- src/features/registration/RegistrationSection.test.tsx --no-file-parallelism --maxWorkers=1`

- [ ] **Step 13: Commit public registration integration**

```powershell
git add -- src/features/registration src/lib/registration.functions.ts src/lib/admin.functions.test.ts
git commit -m "feat: apply automatic choir pricing to checkout"
```

### Task 6: Administrative registration history and final verification

**Files:**
- Modify: `src/features/admin/admin.domain.ts`
- Modify: `src/features/admin/admin.domain.test.ts`
- Modify: `src/features/admin/admin-registration.server.ts`
- Modify: `src/features/admin/admin-registration.server.test.ts`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.test.tsx`

**Interfaces:**
- Renames administrative `diocese` presentation to `choirName` and `byDiocese` summary to `byChoir`.
- Exposes nullable `pricingType`, `standardPriceCents`, and `registrationPriceCents` without fabricating data for historical rows.
- Keeps payment totals/statuses and CSV escaping rules unchanged.

- [ ] **Step 1: Write failing history and summary tests**

Assert that new registrations show normal/promotional pricing snapshots, historical registrations show `Não informado`, summary grouping uses choir names, and CSV adds the choir/pricing columns without weakening formula neutralization.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.test.tsx --no-file-parallelism --maxWorkers=1
```

- [ ] **Step 3: Implement mappings, queries, summary, CSV, and UI labels**

Update the explicit Supabase select column list and all pure mappings. Preserve nulls for legacy rows. Show the base event price and applied registration price separately from `amountCents`/`paidAmountCents`.

- [ ] **Step 4: Re-run focused admin tests and verify GREEN**

Run the command from Step 2.

- [ ] **Step 5: Run complete verification**

```powershell
npm run test:run -- --no-file-parallelism --maxWorkers=1
.\node_modules\.bin\tsc.exe --noEmit
npx eslint src/features/choirs src/features/admin src/features/registration src/lib/choir-pricing.functions.ts src/lib/registration.functions.ts src/integrations/supabase/types.ts src/routes/admin.coros.tsx
npx supabase migration list --local
npm run build
git diff --check
git status --short
```

If Docker is available, include `npx supabase db reset --local` and `npx supabase test db` before the build. Do not substitute a linked or remote database.

- [ ] **Step 6: Commit final administrative/history integration**

```powershell
git add -- src/features/admin
git commit -m "feat: show choir pricing history in admin"
```

- [ ] **Step 7: Review the branch diff**

Compare against the branch base, confirm no secrets or unrelated files are present, and report local verification separately from unperformed remote migration, push, and Lovable deployment.
