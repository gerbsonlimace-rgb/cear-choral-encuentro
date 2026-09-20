# Registration Checkout Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace an outdated pending InfinitePay checkout whenever its provider-facing data or financial snapshots change, while retaining safe reconciliation for a superseded link that is paid later.

**Architecture:** Keep the currently active initial checkout on `registrations` for compatibility and archive only replaced attempts in a private `registration_superseded_checkouts` ledger. A locked database function archives the old attempt and reserves the new order atomically; the server compares trusted checkout contracts before choosing reuse or replacement. Reconciliation checks the active order first and the archived ledger second, recording a late payment as `paid_requires_review` without marking the registration paid.

**Tech Stack:** TypeScript, React 19, TanStack Start, Zod, Supabase/Postgres, Vitest, Testing Library, InfinitePay Checkout API.

**Spec:** `docs/superpowers/specs/2026-09-19-registration-checkout-replacement-design.md`

## Global Constraints

- “Cancel” means local supersession; do not claim the undocumented ability to cancel or expire an InfinitePay checkout remotely.
- Trusted choir configuration and server-side pricing remain authoritative; never accept the browser's displayed amount as payment truth.
- A superseded checkout payment is verified with `payment_check`, recorded, and sent to administrative review; it must not automatically change `registrations.payment_status`.
- Do not duplicate old participant PII in `registration_superseded_checkouts`; retain only order, URL, financial snapshots, reconciliation data, and timestamps.
- Keep the new table private: RLS enabled, no `anon` or `authenticated` grants, and server-only access.
- Do not apply a migration to production project `mtkjsrbywymwixwscosf`, push, publish to Lovable, or create a real charge as part of implementation.
- Preserve unrelated files and Windows line endings; stage only files named by the current task.

## Review Focus

- Equivalent phone formats such as `(85) 99999-9999` and `+5585999999999` must reuse the same checkout; Task 1 and Task 4 pin provider-normalized comparison.
- Editing only badge/profile/voice data must persist those edits without creating a second checkout; Task 4 pins the reuse-and-update path.
- Two concurrent submissions must converge on one current order and one URL; Task 4 pins claim waiting and conditional-write recovery.
- Unsafe URLs and stale internal claims must never be archived as real provider checkouts or returned to the participant; Task 2 and Task 4 pin both cases.
- A duplicate or conflicting late transaction must be idempotent or rejected without changing the active registration; Task 5 pins both replay classes.

---

### Task 1: Canonical checkout contract comparison

**Files:**
- Create: `src/features/registration/registration-checkout-contract.ts`
- Create: `src/features/registration/registration-checkout-contract.test.ts`
- Modify: `src/features/registration/infinitepay.server.ts:98-104`
- Modify: `src/features/registration/infinitepay.server.test.ts:98-123`

**Interfaces:**
- Consumes: `RegistrationInput`, `DisplayedQuote`, `CheckoutItem[]`, and `normalizeInfinitePayPhoneNumber(value)`.
- Produces: `RegistrationCheckoutContract`, `buildRegistrationCheckoutContract(input, appliedQuote, trustedQuote)`, and `registrationCheckoutContractsMatch(left, right)` for Task 4.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildRegistrationCheckoutContract,
  registrationCheckoutContractsMatch,
} from "./registration-checkout-contract";

it("compares the phone exactly as InfinitePay receives it", () => {
  const formatted = buildRegistrationCheckoutContract(
    { ...baseInput, phone: "(85) 99999-9999" },
    standardQuote,
    standardQuote,
  );
  const international = buildRegistrationCheckoutContract(
    { ...baseInput, phone: "+55 85 99999-9999" },
    standardQuote,
    standardQuote,
  );
  expect(formatted.customer.phoneNumber).toBe("+5585999999999");
  expect(registrationCheckoutContractsMatch(formatted, international)).toBe(true);
});

it.each([
  ["name", { name: "Outro Nome" }],
  ["email", { email: "outra@example.com" }],
  ["phone", { phone: "(85) 98888-7777" }],
])("detects a changed provider %s", (_label, change) => {
  const current = buildRegistrationCheckoutContract(baseInput, promotionalQuote, promotionalQuote);
  const next = buildRegistrationCheckoutContract(
    { ...baseInput, ...change },
    promotionalQuote,
    promotionalQuote,
  );
  expect(registrationCheckoutContractsMatch(current, next)).toBe(false);
});

it("detects a changed amount or pricing snapshot even when customer data is unchanged", () => {
  const promotional = buildRegistrationCheckoutContract(
    baseInput,
    promotionalQuote,
    promotionalQuote,
  );
  const standard = buildRegistrationCheckoutContract(
    { ...baseInput, raffleChoice: "full_price" },
    standardQuote,
    standardQuote,
  );
  expect(registrationCheckoutContractsMatch(promotional, standard)).toBe(false);
});
```

- [ ] **Step 2: Run the new tests and confirm the missing-module failure**

Run: `npm test -- src/features/registration/registration-checkout-contract.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `registration-checkout-contract.ts` does not exist.

- [ ] **Step 3: Export the exact phone normalizer already used by the provider client**

```ts
export function normalizeInfinitePayPhoneNumber(value: string | undefined) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return undefined;
}
```

Retain the existing call inside `createInfinitePayClient`; only change the export boundary.

- [ ] **Step 4: Implement the pure contract builder and comparator**

```ts
export type RegistrationCheckoutContract = {
  customer: { name: string; email: string; phoneNumber?: string };
  items: CheckoutItem[];
  amountCents: number;
  pricingType: "standard" | "promotional";
  standardPriceCents: number;
  registrationPriceCents: number;
  remainingPriceCents: number | null;
};

export function buildRegistrationCheckoutContract(
  input: RegistrationInput,
  appliedQuote: DisplayedQuote,
  trustedQuote: DisplayedQuote,
): RegistrationCheckoutContract {
  const items = buildCheckoutItems(input, appliedQuote);
  return {
    customer: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      ...(normalizeInfinitePayPhoneNumber(input.phone)
        ? { phoneNumber: normalizeInfinitePayPhoneNumber(input.phone) }
        : {}),
    },
    items,
    amountCents: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    pricingType: appliedQuote.pricingType,
    standardPriceCents: trustedQuote.standardPriceCents,
    registrationPriceCents: appliedQuote.registrationPriceCents,
    remainingPriceCents: trustedQuote.remainingPriceCents ?? null,
  };
}

export function registrationCheckoutContractsMatch(
  left: RegistrationCheckoutContract,
  right: RegistrationCheckoutContract,
): boolean {
  return (
    left.customer.name === right.customer.name &&
    left.customer.email === right.customer.email &&
    left.customer.phoneNumber === right.customer.phoneNumber &&
    left.amountCents === right.amountCents &&
    left.pricingType === right.pricingType &&
    left.standardPriceCents === right.standardPriceCents &&
    left.registrationPriceCents === right.registrationPriceCents &&
    left.remainingPriceCents === right.remainingPriceCents &&
    JSON.stringify(left.items) === JSON.stringify(right.items)
  );
}
```

- [ ] **Step 5: Run the contract and provider tests**

Run: `npm test -- src/features/registration/registration-checkout-contract.test.ts src/features/registration/infinitepay.server.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 6: Commit the pure contract boundary**

```powershell
git add -- src/features/registration/registration-checkout-contract.ts src/features/registration/registration-checkout-contract.test.ts src/features/registration/infinitepay.server.ts src/features/registration/infinitepay.server.test.ts
git commit -m "refactor: define registration checkout contract"
```

### Task 2: Private superseded-checkout ledger and atomic replacement

**Files:**
- Create: one Supabase CLI-generated migration ending in `add_registration_superseded_checkouts.sql`
- Create: `src/features/registration/registration-checkout-replacement-migration.test.ts`
- Modify: `src/integrations/supabase/types.ts:523-786,787-950`

**Interfaces:**
- Consumes: the current `registrations` columns and service-role-only database pattern.
- Produces: table `registration_superseded_checkouts` and RPC `replace_pending_registration_checkout(...) returns boolean` for Task 3.

- [ ] **Step 1: Write the failing migration contract test**

```ts
const files = readdirSync(migrations).filter((name) =>
  name.endsWith("_add_registration_superseded_checkouts.sql"),
);

it("creates one private immutable superseded-checkout ledger", () => {
  expect(files).toHaveLength(1);
  expect(normalized).toContain("create table public.registration_superseded_checkouts");
  expect(normalized).toContain("status in ('superseded', 'paid_requires_review')");
  expect(normalized).toContain("alter table public.registration_superseded_checkouts enable row level security");
  expect(normalized).toContain("revoke all on public.registration_superseded_checkouts from public, anon, authenticated");
  expect(normalized).toContain("grant select, insert, update on public.registration_superseded_checkouts to service_role");
  expect(normalized).not.toContain("security definer");
});

it("archives and rotates one pending registration under a row lock", () => {
  expect(normalized).toContain("create or replace function public.replace_pending_registration_checkout");
  expect(normalized).toMatch(/from public\.registrations[\s\S]*for update/);
  expect(normalized).toMatch(/insert into public\.registration_superseded_checkouts[\s\S]*update public\.registrations/);
  expect(normalized).toContain("v_registration.order_nsu is distinct from p_expected_order_nsu");
  expect(normalized).toContain("v_registration.checkout_url is distinct from p_expected_checkout_url");
});
```

- [ ] **Step 2: Run the migration contract test and confirm it fails**

Run: `npm test -- src/features/registration/registration-checkout-replacement-migration.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: FAIL with zero matching migration files.

- [ ] **Step 3: Create the migration through the Supabase CLI**

Run:

```powershell
supabase --help
supabase migration new add_registration_superseded_checkouts
```

Expected: the CLI reports one newly created file under `supabase/migrations` with the required suffix. Use that returned path for the remaining SQL steps and commits.

- [ ] **Step 4: Define the private ledger, constraints, indexes, and immutable transition trigger**

The migration must create these exact durable states and transitions:

```sql
create table public.registration_superseded_checkouts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  order_nsu uuid not null unique,
  checkout_url text not null,
  amount_cents integer not null check (amount_cents > 0),
  pricing_type text not null check (pricing_type in ('standard', 'promotional')),
  standard_price_cents integer not null check (standard_price_cents > 0),
  registration_price_cents integer not null check (registration_price_cents > 0),
  remaining_price_cents integer check (remaining_price_cents >= 0),
  status text not null default 'superseded'
    check (status in ('superseded', 'paid_requires_review')),
  infinitepay_invoice_slug text,
  infinitepay_transaction_nsu text,
  payment_method text check (payment_method in ('pix', 'credit_card')),
  installments integer check (installments > 0),
  paid_amount_cents integer check (paid_amount_cents > 0),
  receipt_url text,
  superseded_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint registration_superseded_checkouts_checkout_url_check check (
    checkout_url ~ '^https://checkout\.infinitepay\.(io|com\.br)(/|$)'
  ),
  constraint registration_superseded_checkouts_paid_details_check check (
    (status = 'superseded' and infinitepay_invoice_slug is null
      and infinitepay_transaction_nsu is null and payment_method is null
      and installments is null and paid_amount_cents is null
      and receipt_url is null and paid_at is null)
    or
    (status = 'paid_requires_review' and infinitepay_invoice_slug is not null
      and infinitepay_transaction_nsu is not null and payment_method is not null
      and installments is not null and paid_amount_cents >= amount_cents
      and paid_at is not null)
  )
);

create unique index registration_superseded_checkouts_transaction_uidx
  on public.registration_superseded_checkouts (infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;
create index registration_superseded_checkouts_registration_id_idx
  on public.registration_superseded_checkouts (registration_id);
create index registration_superseded_checkouts_review_idx
  on public.registration_superseded_checkouts (registration_id, paid_at desc)
  where status = 'paid_requires_review';
```

Add a `security invoker` trigger function that rejects changes to identity and financial snapshot columns and permits only `superseded -> paid_requires_review`. Revoke table access from `public`, `anon`, and `authenticated`; grant `select, insert, update` only to `service_role`.

- [ ] **Step 5: Add the locked replacement RPC**

Use the exact function name and argument families below:

```sql
create or replace function public.replace_pending_registration_checkout(
  p_registration_id uuid,
  p_expected_order_nsu uuid,
  p_expected_checkout_url text,
  p_new_order_nsu uuid,
  p_checkout_claim text,
  p_name text,
  p_badge_name text,
  p_cpf text,
  p_photo_path text,
  p_musical_profile text,
  p_voice_part text,
  p_phone text,
  p_birth_date date,
  p_choir_id uuid,
  p_choir_name text,
  p_other_choir_name text,
  p_diocese text,
  p_email text,
  p_pricing_type text,
  p_standard_price_cents integer,
  p_registration_price_cents integer,
  p_remaining_price_cents integer,
  p_amount_cents integer
) returns boolean
language plpgsql
security invoker
set search_path = '';
```

Inside the function, select the registration `for update`, return `false` unless it is pending and both expected values match, archive the old row only when `checkout_url` matches the allowed InfinitePay checkout regex, allow an internal `https://pending.invalid/creating/` claim without archiving it, reject every other URL, update the registration with the new data/order/claim, and return `true`. Revoke execution from `public`, `anon`, and `authenticated`; grant it only to `service_role`.

- [ ] **Step 6: Add generated-style TypeScript types for the table and RPC**

Add `Row`, `Insert`, `Update`, and the `registration_id` relationship under `Tables.registration_superseded_checkouts`. Add this function contract under `Functions`:

```ts
replace_pending_registration_checkout: {
  Args: {
    p_amount_cents: number;
    p_badge_name: string;
    p_birth_date: string;
    p_checkout_claim: string;
    p_choir_id: string | null;
    p_choir_name: string;
    p_cpf: string;
    p_diocese: string;
    p_email: string;
    p_expected_checkout_url: string;
    p_expected_order_nsu: string;
    p_musical_profile: string;
    p_name: string;
    p_new_order_nsu: string;
    p_other_choir_name: string | null;
    p_phone: string;
    p_photo_path: string;
    p_pricing_type: string;
    p_registration_id: string;
    p_registration_price_cents: number;
    p_remaining_price_cents: number | null;
    p_standard_price_cents: number;
    p_voice_part: string | null;
  };
  Returns: boolean;
};
```

- [ ] **Step 7: Run static and local database verification**

Run:

```powershell
npm test -- src/features/registration/registration-checkout-replacement-migration.test.ts src/features/regent/regent-migration.test.ts --run --no-file-parallelism --maxWorkers=1
supabase db reset --local
supabase migration list --local
```

Expected: both Vitest files pass, local reset completes, and the new migration appears in the local migration ledger. Do not link or target the production project.

- [ ] **Step 8: Commit the ledger and migration contract**

```powershell
git add -- supabase/migrations src/features/registration/registration-checkout-replacement-migration.test.ts src/integrations/supabase/types.ts
git commit -m "feat: archive superseded registration checkouts"
```

### Task 3: Repository operations for reuse and atomic replacement

**Files:**
- Modify: `src/features/registration/registration-payment.server.ts:81-164,554-904`
- Modify: `src/features/registration/registration-payment.server.test.ts:148-310,1290-1505`

**Interfaces:**
- Consumes: `RegistrationCheckoutContract` from Task 1 and RPC `replace_pending_registration_checkout` from Task 2.
- Produces: enriched `RegistrationIdentityRecord.checkoutContract`, `updatePendingDetails(input): Promise<boolean>`, and `replacePendingCheckout(input): Promise<boolean>` for Task 4.

- [ ] **Step 1: Extend repository tests with the complete active checkout snapshot**

Update `identityColumns` in the test to include:

```ts
"id,payment_status,birth_date,order_nsu,checkout_url,photo_path,name,email,phone,amount_cents,pricing_type,standard_price_cents,registration_price_cents,remaining_price_cents"
```

Assert that `findByCpf()` maps these fields into:

```ts
checkoutContract: {
  customer: { name: "Maria", email: "maria@example.com", phoneNumber: "+5585999999999" },
  items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
  amountCents: 10000,
  pricingType: "promotional",
  standardPriceCents: 30000,
  registrationPriceCents: 10000,
  remainingPriceCents: 25000,
}
```

- [ ] **Step 2: Add failing tests for conditional detail update and RPC replacement**

```ts
await expect(repository.updatePendingDetails(detailsInput)).resolves.toBe(true);
expect(database.trace).toContainEqual(["eq", "order_nsu", previousOrderNsu]);
expect(database.trace).toContainEqual(["eq", "checkout_url", existingCheckoutUrl]);

await expect(repository.replacePendingCheckout(replacementInput)).resolves.toBe(true);
expect(supabaseAdminMock.rpc).toHaveBeenCalledWith(
  "replace_pending_registration_checkout",
  expect.objectContaining({
    p_registration_id: "registration-1",
    p_expected_order_nsu: previousOrderNsu,
    p_expected_checkout_url: existingCheckoutUrl,
    p_new_order_nsu: fixedOrderNsu,
    p_amount_cents: 30000,
  }),
);
```

- [ ] **Step 3: Run the repository tests and confirm missing interfaces**

Run: `npm test -- src/features/registration/registration-payment.server.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the identity snapshot and the two repository methods do not exist.

- [ ] **Step 4: Implement enriched identity mapping**

For pending rows with complete financial fields, build `checkoutContract` using normalized phone and the persisted one-item amount. Return `checkoutContract: null` for legacy or structurally incomplete records so the service replaces rather than trusts an unverifiable link.

- [ ] **Step 5: Implement `updatePendingDetails` without touching checkout identity**

The update must persist form/profile/photo fields and be conditioned by all of:

```ts
.eq("id", input.registrationId)
.eq("payment_status", "pending")
.eq("order_nsu", input.expectedOrderNsu)
.eq("checkout_url", input.expectedCheckoutUrl)
```

It must not update `order_nsu`, `checkout_url`, `amount_cents`, or pricing snapshot columns.

- [ ] **Step 6: Implement `replacePendingCheckout` through the typed RPC**

Map every RPC argument explicitly and return `data === true`; translate database errors to `Não foi possível atualizar a inscrição.` without logging PII.

- [ ] **Step 7: Run the focused repository tests**

Run: `npm test -- src/features/registration/registration-payment.server.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 8: Commit the repository boundary**

```powershell
git add -- src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts
git commit -m "feat: add atomic checkout replacement repository"
```

### Task 4: Replace stale provider contracts and persist safe reuse edits

**Files:**
- Modify: `src/features/registration/registration-payment.server.ts:259-390`
- Modify: `src/features/registration/registration-payment.server.test.ts:390-770`

**Interfaces:**
- Consumes: Task 1 contract functions and Task 3 repository methods.
- Produces: corrected `startCheckout(input): Promise<{ checkoutUrl: string; orderNsu: string }>` behavior; Task 5 relies on the archived order being preserved by Task 2.

- [ ] **Step 1: Write the exact regression test from the reported incident**

```ts
it("replaces a R$ 100 checkout after phone and full-price selection change", async () => {
  fixture.setIdentityRecord(pendingIdentity({
    orderNsu: previousOrderNsu,
    checkoutUrl: existingCheckoutUrl,
    phone: "(85) 99999-1111",
    amountCents: 10000,
    pricingType: "promotional",
    registrationPriceCents: 10000,
  }));

  await fixture.service.startCheckout({
    ...baseInput,
    phone: "(85) 98888-2222",
    raffleChoice: "full_price",
    displayedQuote: standardQuote,
  });

  expect(fixture.repository.replacePendingCheckout).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedOrderNsu: previousOrderNsu,
      expectedCheckoutUrl: existingCheckoutUrl,
      orderNsu: fixedOrderNsu,
      amountCents: 30000,
    }),
  );
  expect(fixture.infinitePay.createCheckout).toHaveBeenCalledWith(
    expect.objectContaining({
      orderNsu: fixedOrderNsu,
      items: [expect.objectContaining({ price: 30000 })],
      customer: expect.objectContaining({ phoneNumber: "(85) 98888-2222" }),
    }),
  );
});
```

- [ ] **Step 2: Add failing reuse, nonfinancial edit, normalized-phone, unsafe URL, and concurrency tests**

Pin these outcomes with separate tests:

```ts
expect(fixture.repository.updatePendingDetails).toHaveBeenCalledOnce();
expect(fixture.repository.replacePendingCheckout).not.toHaveBeenCalled();
expect(fixture.infinitePay.createCheckout).not.toHaveBeenCalled();
expect(result).toEqual({ checkoutUrl: existingCheckoutUrl, orderNsu: previousOrderNsu });
```

Use a changed `badgeName` to prove nonfinancial persistence, equivalent formatted/international phones to prove reuse, an `https://evil.example` URL to prove it is never returned, and a concurrent replacement mock that makes the second request observe the first request's claim and final URL.

Add two pre-mutation guards: a stale `displayedQuote` must fail before `updatePendingDetails` or `replacePendingCheckout`, and changing to an e-mail already owned by an Auth user must fail before the old checkout is archived.

- [ ] **Step 3: Run the service tests and observe the current old-link return**

Run: `npm test -- src/features/registration/registration-payment.server.test.ts --run --no-file-parallelism --maxWorkers=1`

Expected: the incident regression fails because `startCheckout` returns `existingCheckoutUrl` before validating or updating.

- [ ] **Step 4: Move quote resolution and contract comparison before reuse**

Compute `trustedQuote`, `appliedQuote`, quote-change validation, and `nextContract` before returning any provider URL. Treat only an allowed InfinitePay URL plus an equal persisted contract as reusable.

- [ ] **Step 5: Implement the reuse-and-update path**

For an equal contract:

1. upload the submitted photo under a fresh storage key so the existing order path is not overwritten;
2. call `updatePendingDetails` with expected order and URL;
3. remove the newly uploaded photo if the conditional update loses a race;
4. after success, remove the previous photo when paths differ;
5. return the existing checkout without calling InfinitePay.

If the conditional update loses a race, refetch and use the existing `waitForCheckoutUrl` behavior rather than creating a second checkout.

- [ ] **Step 6: Implement the replacement path**

For a different or unverifiable contract, generate one new order, create its checkout claim, upload the new photo, and call `replacePendingCheckout`. Only after the database returns `true` may the service call `createCheckout` with `nextContract.items` and current customer data. Keep `saveCheckoutUrl(orderNsu, url, checkoutClaim)` as the final conditional write.

For a stale internal claim, the same RPC replaces the order without archiving the claim. For an unsafe non-claim URL, fail with `Não foi possível preparar o pagamento desta inscrição.` and do not navigate to it.

- [ ] **Step 7: Run service, provider, and registration function tests**

Run:

```powershell
npm test -- src/features/registration/registration-payment.server.test.ts src/features/registration/infinitepay.server.test.ts src/lib/registration.functions.test.ts --run --no-file-parallelism --maxWorkers=1
```

Expected: PASS, including one checkout under the concurrency tests.

- [ ] **Step 8: Commit the corrected checkout flow**

```powershell
git add -- src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts
git commit -m "fix: refresh changed registration checkouts"
```

### Task 5: Reconcile superseded payments without confirming the registration

**Files:**
- Modify: `src/features/registration/registration-payment.server.ts:37-79,205-258,554-904`
- Modify: `src/features/registration/registration-payment.server.test.ts:770-1505`
- Modify: `src/features/registration/webhook.server.ts:20-70`
- Modify: `src/features/registration/webhook.server.test.ts:40-135`
- Modify: `src/features/registration/PaymentConfirmationPage.tsx:13-160`
- Modify: `src/features/registration/PaymentConfirmationPage.test.tsx:20-490`

**Interfaces:**
- Consumes: `registration_superseded_checkouts` from Task 2.
- Produces: `SupersededCheckoutPaymentRecord`, repository methods `findSupersededPayment` and `markSupersededPaid`, and public status `{ status: "paid_requires_review" }`.

- [ ] **Step 1: Write failing active-versus-superseded reconciliation tests**

```ts
it("records a verified superseded payment without marking the registration paid", async () => {
  fixture.setRecord(null);
  fixture.setSupersededRecord(supersededRecord({ amountCents: 10000 }));

  await expect(fixture.service.reconcilePayment(lookup)).resolves.toEqual({
    status: "paid_requires_review",
  });

  expect(fixture.infinitePay.checkPayment).toHaveBeenCalledWith(lookup);
  expect(fixture.repository.markSupersededPaid).toHaveBeenCalledOnce();
  expect(fixture.repository.markPaid).not.toHaveBeenCalled();
  expect(fixture.provisionParticipant).not.toHaveBeenCalled();
});

it("rejects a conflicting transaction after an idempotent late-payment replay", async () => {
  fixture.setSupersededRecord(paidReviewRecord({ transactionNsu: "original" }));
  await expect(
    fixture.service.reconcilePayment({ ...lookup, transactionNsu: "different" }),
  ).rejects.toThrow("Transação divergente");
});
```

Also assert rejection when `payment_check.amount` differs from the archived `amount_cents`.

- [ ] **Step 2: Write failing webhook and return-page tests**

```ts
const reconcile = vi.fn().mockResolvedValue({ status: "paid_requires_review" });
const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);
expect(response.status).toBe(200);
expect(consoleError).toHaveBeenCalledWith(
  "[InfinitePay webhook] superseded checkout paid",
  { orderNsu: validBody.order_nsu },
);
```

For `PaymentConfirmationPage`, return `{ status: "paid_requires_review" }` and assert the exact visible copy `Pagamento recebido e em análise. Não realize outro pagamento.` with no `Verificar novamente` button.

- [ ] **Step 3: Run all three test files and confirm missing status/repository failures**

Run:

```powershell
npm test -- src/features/registration/registration-payment.server.test.ts src/features/registration/webhook.server.test.ts src/features/registration/PaymentConfirmationPage.test.tsx --run --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because archived lookup and `paid_requires_review` do not exist.

- [ ] **Step 4: Implement archived payment persistence**

Select archived rows by `order_nsu`. `markSupersededPaid` must update only `status = 'superseded'`, store the sanitized receipt and confirmed provider fields, and return the row. If no row updates, refetch: return an idempotent match for the same transaction and throw for a different transaction.

- [ ] **Step 5: Extend reconciliation with active-first archived lookup**

Keep the active path unchanged. Only when `findPayment(orderNsu)` returns `null`, call `findSupersededPayment(orderNsu)`. Verify through `payment_check`, compare original and paid values, call `markSupersededPaid`, and return `{ status: "paid_requires_review" }` without provisioning access.

- [ ] **Step 6: Acknowledge and display the review state**

Extend `PublicPaymentStatus` and the webhook reconcile signature. The webhook returns 200 for both `paid` and `paid_requires_review`, but emits the technical `console.error` shown in Step 2 for the review state. Add a terminal `review` state to `PaymentConfirmationPage`; it stops retries and renders the approved copy without claiming the registration is confirmed.

- [ ] **Step 7: Run reconciliation, webhook, and return-page tests**

Run the command from Step 3.

Expected: PASS.

- [ ] **Step 8: Commit late-payment reconciliation**

```powershell
git add -- src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts src/features/registration/webhook.server.ts src/features/registration/webhook.server.test.ts src/features/registration/PaymentConfirmationPage.tsx src/features/registration/PaymentConfirmationPage.test.tsx
git commit -m "feat: flag superseded checkout payments for review"
```

### Task 6: Surface late payments in registration details

**Files:**
- Modify: `src/features/admin/admin.domain.ts:77-139,227-275`
- Modify: `src/features/admin/admin.domain.test.ts:430-550`
- Modify: `src/features/admin/admin-registration.server.ts:40-230,426-558`
- Modify: `src/features/admin/admin-registration.server.test.ts`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx:1-90,334-451`
- Modify: `src/features/admin/AdminRegistrationsPage.test.tsx:20-380`

**Interfaces:**
- Consumes: `registration_superseded_checkouts.status = 'paid_requires_review'` from Task 5.
- Produces: `AdminSupersededCheckoutReview`, `AdminRegistrationRow.supersededCheckoutReview`, and an accessible administrative warning.

- [ ] **Step 1: Write failing domain and repository enrichment tests**

```ts
const review: AdminSupersededCheckoutReview = {
  orderNsu: previousOrderNsu,
  amountCents: 10000,
  paidAmountCents: 10000,
  paymentMethod: "pix",
  installments: 1,
  paidAt: "2026-09-19T20:00:00Z",
  transactionNsu: "late-transaction",
  receiptUrl: "https://receipt.infinitepay.io/late",
};

expect(enrichAdminRegistrationRow(candidate, [], null, review))
  .toMatchObject({ supersededCheckoutReview: review });
```

Add a repository test that queries `registration_superseded_checkouts` for candidate registration IDs, filters `status = paid_requires_review`, orders newest first, validates every field, and returns at most the newest review per registration.

- [ ] **Step 2: Write the failing details-dialog test**

Render a row with `supersededCheckoutReview` and open its details. Assert:

```ts
expect(screen.getByRole("alert")).toHaveTextContent("Pagamento de checkout substituído");
expect(screen.getByRole("alert")).toHaveTextContent("R$ 100,00");
expect(screen.getByRole("link", { name: "Abrir comprovante" }))
  .toHaveAttribute("href", review.receiptUrl);
```

- [ ] **Step 3: Run domain, server, and page tests to confirm failures**

Run:

```powershell
npm test -- src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.test.tsx --run --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the review model and alert do not exist.

- [ ] **Step 4: Add the review model and server query**

Define:

```ts
export type AdminSupersededCheckoutReview = {
  orderNsu: string;
  amountCents: number;
  paidAmountCents: number;
  paymentMethod: "pix" | "credit_card";
  installments: number;
  paidAt: string;
  transactionNsu: string;
  receiptUrl: string | null;
};
```

Add `supersededCheckoutReview?: AdminSupersededCheckoutReview | null` to `AdminRegistrationRow`, a repository method `listSupersededCheckoutReviews(registrationIds)`, and pass the newest review into `enrichAdminRegistrationRow` in both paged and export enrichment paths. The review must not alter financial summaries, because resolution remains manual.

- [ ] **Step 5: Render the accessible warning**

Import `Alert`, `AlertTitle`, and `AlertDescription`. Above the financial detail section, render an `Alert` with title `Pagamento de checkout substituído`, amount/date/method/transaction, the instruction `Revisão administrativa necessária; a inscrição atual não foi confirmada automaticamente.`, and a safe external receipt link only for an allowed InfinitePay HTTPS URL.

- [ ] **Step 6: Run the focused admin tests**

Run the command from Step 3.

Expected: PASS.

- [ ] **Step 7: Commit the administrative review surface**

```powershell
git add -- src/features/admin/admin.domain.ts src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.tsx src/features/admin/AdminRegistrationsPage.test.tsx
git commit -m "feat: show superseded checkout payment reviews"
```

### Task 7: End-to-end verification and release boundary

**Files:**
- Verify: all files changed by Tasks 1-6
- Modify only if a verification failure directly belongs to this feature.

**Interfaces:**
- Consumes: the complete branch implementation.
- Produces: local proof only; no remote database, Git push, Lovable deployment, or real payment mutation.

- [ ] **Step 1: Run all focused tests serially**

```powershell
npm test -- src/features/registration/registration-checkout-contract.test.ts src/features/registration/registration-checkout-replacement-migration.test.ts src/features/registration/registration-payment.server.test.ts src/features/registration/infinitepay.server.test.ts src/features/registration/webhook.server.test.ts src/features/registration/PaymentConfirmationPage.test.tsx src/lib/registration.functions.test.ts src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.test.tsx --run --no-file-parallelism --maxWorkers=1
```

Expected: all named files pass with zero failures.

- [ ] **Step 2: Verify types and lint only the touched TypeScript files**

```powershell
npx tsc --noEmit
npx eslint src/features/registration/registration-checkout-contract.ts src/features/registration/registration-checkout-contract.test.ts src/features/registration/registration-checkout-replacement-migration.test.ts src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts src/features/registration/infinitepay.server.ts src/features/registration/infinitepay.server.test.ts src/features/registration/webhook.server.ts src/features/registration/webhook.server.test.ts src/features/registration/PaymentConfirmationPage.tsx src/features/registration/PaymentConfirmationPage.test.tsx src/features/admin/admin.domain.ts src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.tsx src/features/admin/AdminRegistrationsPage.test.tsx src/integrations/supabase/types.ts
```

Expected: exit code 0. Do not mass-format unrelated CRLF files.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: exit code 0; generated route or lockfile noise is not staged.

- [ ] **Step 4: Re-run local migration verification**

```powershell
supabase db reset --local
supabase migration list --local
```

Expected: clean local reset and the checkout-replacement migration present. Do not execute `db push`, `migration up --linked`, SQL against a remote URL, or any production MCP mutation.

- [ ] **Step 5: Inspect the final branch scope**

```powershell
git status --short
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only the approved spec, plan, migration, checkout/reconciliation code, generated Supabase types, and focused tests are present.

- [ ] **Step 6: Commit any direct verification corrections separately**

If Step 1-4 required a feature-scoped correction, stage only those exact files and run:

```powershell
git commit -m "test: complete checkout replacement verification"
```

If no correction was required, do not create an empty commit.

- [ ] **Step 7: Report local proof and stop at the authorization boundary**

Report test counts, typecheck/lint/build results, migration-local result, branch name, and commit SHAs. State explicitly that production Supabase, GitHub main, and Lovable remain unchanged, then request separate authorization for any desired remote mutation.
