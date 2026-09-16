# Valores do Programa de Rifas e saldo de quitação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Fazer o Programa de Rifas usar o saldo configurado (R$ 250,00) no resumo, no estado financeiro e no checkout complementar, em vez da diferença fixa de R$ 200,00.

**Architecture:** Reutilizar o campo já existente `promotional_remaining_price_cents` nas configurações e `remaining_price_cents` nos snapshots. O domínio aceita esse saldo independentemente da diferença entre valor normal e entrada; quando o snapshot não existir, mantém o fallback legado para preservar registros antigos.

**Tech Stack:** React, TypeScript, Zod, Vitest, Supabase SQL migrations, InfinitePay server boundaries.

**Spec:** `docs/superpowers/specs/2026-09-15-raffle-settlement-price-design.md`

## Global Constraints

- Inscrição normal: R$ 300,00 pagos no checkout inicial.
- Programa de rifas: R$ 100,00 agora + R$ 250,00 até 30/10, total R$ 350,00.
- O navegador não informa o valor do complemento; o servidor recalcula a cobrança.
- Inscrições históricas não serão reescritas; Git/Lovable/Supabase remoto permanecem etapas separadas.
- Não alterar arquivos fora do escopo nem a cópia principal suja.

### Task 1: Demonstrar o saldo configurado no domínio e no formulário

**Files:**
- Modify: `src/features/registration/RegistrationSection.test.tsx`
- Modify: `src/features/registration/RegistrationSection.tsx:124-170`
- Modify: `src/features/registration/registration-financial-state.domain.test.ts`
- Modify: `src/features/registration/registration-financial-state.domain.ts:48-66`

**Interfaces:**
- Consumes `DisplayedQuote.remainingPriceCents` from the existing pricing service.
- Produces a summary and financial state where a promotional snapshot of 10000 + 25000 yields total 35000 and pending 25000.

- [ ] **Step 1: Write the failing tests**

Add a RegistrationSection fixture choir with `remainingPriceCents: 25000`, select the raffle option, and assert both the option copy and the summary contain `R$ 250,00`. Add a financial-domain case:

```ts
it("uses the configured promotional balance instead of the discount difference", () => {
  expect(deriveRegistrationFinancialState({
    ...promotionalRegistration,
    remainingPriceCents: 25_000,
    confirmedComplementCents: 0,
  })).toEqual({
    status: "partially_paid",
    pendingCents: 25_000,
    confirmedPrincipalCents: 10_000,
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run src/features/registration/RegistrationSection.test.tsx src/features/registration/registration-financial-state.domain.test.ts --no-file-parallelism --maxWorkers=1`

Expected: failure showing the summary/state still uses R$ 200,00 or returns `legacy` because of the upper-bound check.

- [ ] **Step 3: Implement the minimal change**

In `RegistrationPriceSummary`, select `appliedQuote.remainingPriceCents` when present and only fall back to `standardPriceCents - registrationPriceCents` when absent. In `deriveRegistrationFinancialState`, keep the configured value as the complement due and remove only the `complementDueCents <= derivedComplementDueCents` requirement; retain integer, non-negative, positive-promotional, and overpayment checks.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the same command. Expected: all tests in both files pass with no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/RegistrationSection.tsx src/features/registration/RegistrationSection.test.tsx src/features/registration/registration-financial-state.domain.ts src/features/registration/registration-financial-state.domain.test.ts
git commit -m "fix: use configured raffle settlement balance"
```

### Task 2: Permitir e cobrar o saldo configurado na área de regentes

**Files:**
- Modify: `src/features/regent/regent-payments.domain.ts:95-132`
- Modify: `src/features/regent/regent-payments.domain.test.ts`
- Modify: `src/features/regent/regent-payment.server.test.ts`
- Inspect: `src/features/regent/regent-payment.server.ts:240-285`

**Interfaces:**
- Consumes `RegentPaymentRegistration.remainingPriceCents` and confirmed complement ledger rows.
- Produces `BalancePaymentTarget.balanceCents` equal to the configured remaining snapshot minus confirmed complements; `startComplementCheckout` sends that amount to InfinitePay.

- [ ] **Step 1: Write the failing tests**

Extend the existing complement test with `remainingPriceCents: 25_000` and assert `totalCents: 25_000`, `balanceCents: 25_000`. Add a server checkout case whose registration snapshot is 10000/25000 and assert the InfinitePay item price and reservation amount are 25000.

```ts
expect(calculateComplementState({
  ...paidPromotionalRegistration,
  remainingPriceCents: 25_000,
  confirmedComplementCents: 0,
})).toMatchObject({ totalCents: 25_000, balanceCents: 25_000 });
```

- [ ] **Step 2: Run tests and verify the failure**

Run: `npm test -- --run src/features/regent/regent-payments.domain.test.ts src/features/regent/regent-payment.server.test.ts --no-file-parallelism --maxWorkers=1`

Expected: the domain test returns `legacy` because the configured total is rejected as larger than the derived difference.

- [ ] **Step 3: Implement the minimal change**

Remove the upper-bound comparison against `derivedTotalCents` in `calculateComplementState`. Keep fallback to the derived difference only when `remainingPriceCents` is null/undefined. Do not add an amount parameter to the public checkout schema; the existing server path already recalculates and reserves `balanceCents`.

- [ ] **Step 4: Run tests and verify they pass**

Run the same command. Expected: all domain and server tests pass, including duplicate/open-checkout and overpayment protections.

- [ ] **Step 5: Commit**

```bash
git add src/features/regent/regent-payments.domain.ts src/features/regent/regent-payments.domain.test.ts src/features/regent/regent-payment.server.test.ts
git commit -m "fix: allow configured raffle balance checkout"
```

### Task 3: Provar contrato de configuração, snapshot e migrações

**Files:**
- Modify: `src/features/choirs/choir-pricing.domain.test.ts`
- Modify: `src/features/admin/AdminChoirsPage.test.tsx`
- Modify: `src/features/regent/regent-migration.test.ts`
- Inspect: `supabase/migrations/20260915120000_add_promotional_remaining_price.sql`
- Inspect: `supabase/migrations/20260915150000_allow_configured_promotional_remaining_price.sql`

**Interfaces:**
- Consumes the existing admin field `promotionalRemainingPriceCents` and migration sequence.
- Produces regression proof that R$ 250,00 is accepted, exposed in the public quote, persisted in registration snapshots, and allowed by the SQL trigger.

- [ ] **Step 1: Add failing contract assertions**

Add a domain/server assertion that `resolveChoirPrice(..., { standardPriceCents: 30000, promotionalPriceCents: 10000, promotionalRemainingPriceCents: 25000 })` returns `remainingPriceCents: 25000`. Update admin test input to `250,00`. Add migration assertions that the later migration removes the upper-bound phrase and validates only promotional non-negative remaining values.

- [ ] **Step 2: Run focused contract tests and verify failures**

Run: `npm test -- --run src/features/choirs/choir-pricing.domain.test.ts src/features/choirs/choir-pricing.server.test.ts src/features/admin/AdminChoirsPage.test.tsx src/features/regent/regent-migration.test.ts --no-file-parallelism --maxWorkers=1`

Expected: any assertion still expecting the old 15000 value or the old SQL bound fails.

- [ ] **Step 3: Update only stale fixtures/assertions**

Keep the already-versioned two-step migration intact; do not rewrite published SQL. Ensure generated Supabase types and server column selections retain both new columns. No new migration is required because `20260915150000_allow_configured_promotional_remaining_price.sql` already drops the restrictive check.

- [ ] **Step 4: Run contract tests and verify they pass**

Run the same command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/choirs/choir-pricing.domain.test.ts src/features/choirs/choir-pricing.server.test.ts src/features/admin/AdminChoirsPage.test.tsx src/features/regent/regent-migration.test.ts
git commit -m "test: cover configured raffle settlement price"
```

### Task 4: Full scoped verification and handoff

**Files:**
- Inspect: `git diff origin/main...HEAD`
- Inspect: all files changed by Tasks 1–3

- [ ] **Step 1: Run the complete focused registration/regent suite**

Run: `npm test -- --run src/features/choirs src/features/registration src/features/regent src/features/admin/AdminChoirsPage.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: zero failures; report any pre-existing unrelated failures separately.

- [ ] **Step 2: Run typecheck, lint, and production build**

Run: `npx tsc --noEmit`; `npm run lint -- --no-warn-ignored`; `npm run build`.

Expected: each command exits 0.

- [ ] **Step 3: Inspect the final diff and status**

Run: `git diff --check`; `git status --short`; `git diff --stat origin/main...HEAD`.

Expected: only the spec/plan and scoped implementation/test files are present; no generated or unrelated files are included.

- [ ] **Step 4: Report evidence and operational boundaries**

Report branch/commit SHAs, test/build/lint results, and explicitly state that remote SQL application, Git push, Lovable deployment, and real InfinitePay checkout were not performed.
