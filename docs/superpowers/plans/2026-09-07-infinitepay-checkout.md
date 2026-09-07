# InfinitePay Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simulated Pix screen with a secure InfinitePay checkout that records pending registrations and confirms Pix or card payments only after server-side verification.

**Architecture:** Keep browser-facing form calls in TanStack Start server functions, isolate InfinitePay HTTP calls and Supabase persistence in server-only modules, and expose one TanStack server route for the InfinitePay webhook. Both the return page and webhook call the same idempotent reconciliation service, which checks the provider before changing a registration to paid.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Zod, Supabase Postgres, InfinitePay Checkout API, Vitest 5, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-07-infinitepay-checkout-design.md`

## Global Constraints

- Use InfiniteTag `antonio-gerbson`, overridable only by the server-side `INFINITEPAY_HANDLE` environment variable.
- Charge `10000` cents for registration and `3990` cents for the optional shirt.
- Offer Pix and card through the InfinitePay hosted checkout; card fee pass-through is configured in the InfinitePay account, not fabricated in application code.
- Calculate and validate all monetary values on the server.
- Never confirm a payment from redirect parameters or webhook fields alone; call InfinitePay `payment_check` first.
- Keep the Supabase service-role key in server-only modules.
- Preserve existing registration rows as `legacy`; do not invent their amount or payment state.
- Keep `registrations` inaccessible to `anon` and `authenticated` roles.
- Do not create a real InfinitePay charge in automated tests.
- Do not apply migrations to remote Supabase and do not push to GitHub/Lovable in this plan.
- Follow the live InfinitePay contract at `https://www.infinitepay.io/checkout-documentacao` and TanStack server-route conventions at `https://tanstack.com/start/latest/docs/framework/react/guide/server-routes`.

## File Structure

- `vitest.config.ts`: Vitest/jsdom configuration and `@` alias.
- `src/test/setup.ts`: DOM cleanup and jest-dom matchers.
- `src/features/registration/registration.domain.ts`: shared registration schema, prices, roles, shirt sizes, checkout items, and return-parameter schema.
- `src/features/registration/registration.domain.test.ts`: pure validation and price tests.
- `src/features/registration/infinitepay.server.ts`: typed InfinitePay client, response validation, and safe URL checks.
- `src/features/registration/infinitepay.server.test.ts`: mocked HTTP contract tests.
- `src/features/registration/registration-payment.server.ts`: repository contract, Supabase implementation, checkout orchestration, and idempotent reconciliation.
- `src/features/registration/registration-payment.server.test.ts`: service tests with fake repository and InfinitePay client.
- `src/features/registration/webhook.server.ts`: webhook parsing and HTTP response behavior.
- `src/features/registration/webhook.server.test.ts`: webhook request tests.
- `src/features/registration/RegistrationSection.tsx`: extracted registration form and checkout redirect behavior.
- `src/features/registration/RegistrationSection.test.tsx`: form loading, error preservation, and redirect tests.
- `src/features/registration/PaymentConfirmationPage.tsx`: verified payment-result UI and bounded retry behavior.
- `src/features/registration/PaymentConfirmationPage.test.tsx`: confirmation-state and retry tests.
- `src/lib/registration.functions.ts`: same-origin server functions for starting checkout and verifying payment.
- `src/routes/api/infinitepay-webhook.ts`: public POST route called by InfinitePay.
- `src/routes/pagamento.tsx`: payment return route and search-parameter mapping.
- `src/routes/index.tsx`: remove the embedded mock flow and render `RegistrationSection`.
- `src/start.ts`: add explicit CSRF middleware for server functions.
- `src/integrations/supabase/types.ts`: keep generated database types aligned with the migration.
- `supabase/migrations/*_add_infinitepay_payments.sql`: schema migration created by the Supabase CLI.
- `PRODUCT.md`: describe the now-functional registration flow.
- `README.md`: document local variables and InfinitePay go-live settings.

---

### Task 1: Add the test harness

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

**Interfaces:**
- Consumes: existing Vite alias `@` → `src` and React 19.
- Produces: `npm test -- --run` for one-shot tests and a jsdom environment with Testing Library cleanup.

- [ ] **Step 1: Install pinned test dependencies with Bun so the existing lockfile remains authoritative**

Run:

```powershell
npx --yes bun@1.4.2 add --dev vitest@5.0.0 jsdom@30.0.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.1 @testing-library/user-event@14.6.7 @testing-library/jest-dom@6.8.0
```

Expected: `package.json` and `bun.lock` change; no `package-lock.json` is created.

- [ ] **Step 2: Add the scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

Keep the existing scripts unchanged.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(rootDir, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 5: Run the empty suite and the existing build**

Run:

```powershell
npm run test:run -- --passWithNoTests
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit the harness**

```powershell
git add package.json bun.lock vitest.config.ts src/test/setup.ts
git commit -m "test: add Vitest harness"
```

---

### Task 2: Define the registration and payment domain contract

**Files:**
- Create: `src/features/registration/registration.domain.ts`
- Create: `src/features/registration/registration.domain.test.ts`

**Interfaces:**
- Consumes: Zod.
- Produces: `registrationSchema`, `RegistrationInput`, `REGISTRATION_PRICE_CENTS`, `SHIRT_PRICE_CENTS`, `CheckoutItem`, `buildCheckoutItems(input)`, `calculateOrderAmountCents(input)`, `paymentLookupSchema`, and `PaymentLookup`.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildCheckoutItems,
  calculateOrderAmountCents,
  registrationSchema,
} from "./registration.domain";

const baseInput = {
  name: "Maria da Silva",
  email: "maria@example.com",
  phone: "85999999999",
  city: "Quixadá",
  institution: "Coro Paroquial",
  role: "singer" as const,
  includeShirt: false,
  shirtSize: "" as const,
  observations: "",
};

describe("registration domain", () => {
  it("charges only registration without a shirt", () => {
    expect(calculateOrderAmountCents(baseInput)).toBe(10000);
    expect(buildCheckoutItems(baseInput)).toEqual([
      { quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" },
    ]);
  });

  it("adds the selected shirt", () => {
    const input = { ...baseInput, includeShirt: true, shirtSize: "M" as const };
    expect(calculateOrderAmountCents(input)).toBe(13990);
    expect(buildCheckoutItems(input)[1]).toEqual({
      quantity: 1,
      price: 3990,
      description: "Camisa oficial — tamanho M",
    });
  });

  it("rejects a registration with a shirt but no size", () => {
    const result = registrationSchema.safeParse({
      ...baseInput,
      includeShirt: true,
      shirtSize: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `npm run test:run -- src/features/registration/registration.domain.test.ts`

Expected: FAIL because `registration.domain.ts` does not exist.

- [ ] **Step 3: Implement the domain module**

Use these exact exported contracts:

```ts
import { z } from "zod";

export const REGISTRATION_PRICE_CENTS = 10000;
export const SHIRT_PRICE_CENTS = 3990;
export const registrationRoleSchema = z.enum([
  "participant",
  "musician",
  "singer",
  "conductor",
  "liturgist",
  "priest",
  "other",
]);
export const shirtSizeSchema = z.enum(["P", "M", "G", "GG", "XG"]);

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(8).max(30),
    city: z.string().trim().min(2).max(100),
    institution: z.string().trim().max(200).optional().or(z.literal("")),
    role: registrationRoleSchema,
    includeShirt: z.boolean(),
    shirtSize: shirtSizeSchema.or(z.literal("")),
    observations: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.includeShirt && !value.shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "Escolha o tamanho da camisa.",
      });
    }
    if (!value.includeShirt && value.shirtSize) {
      context.addIssue({
        code: "custom",
        path: ["shirtSize"],
        message: "O tamanho só pode ser informado quando a camisa está incluída.",
      });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type CheckoutItem = { quantity: 1; price: number; description: string };

export function buildCheckoutItems(input: RegistrationInput): CheckoutItem[] {
  const items: CheckoutItem[] = [
    { quantity: 1, price: REGISTRATION_PRICE_CENTS, description: "Inscrição — II Encontro de Coros" },
  ];
  if (input.includeShirt) {
    items.push({
      quantity: 1,
      price: SHIRT_PRICE_CENTS,
      description: `Camisa oficial — tamanho ${input.shirtSize}`,
    });
  }
  return items;
}

export function calculateOrderAmountCents(input: RegistrationInput): number {
  return buildCheckoutItems(input).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export const paymentLookupSchema = z.object({
  orderNsu: z.string().uuid(),
  transactionNsu: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  receiptUrl: z.string().url().optional(),
});

export type PaymentLookup = z.infer<typeof paymentLookupSchema>;
```

- [ ] **Step 4: Run domain tests**

Run: `npm run test:run -- src/features/registration/registration.domain.test.ts`

Expected: PASS with three tests.

- [ ] **Step 5: Commit the domain contract**

```powershell
git add src/features/registration/registration.domain.ts src/features/registration/registration.domain.test.ts
git commit -m "feat: define registration payment domain"
```

---

### Task 3: Add the payment schema while preserving historical registrations

**Files:**
- Create via CLI: `supabase/migrations/*_add_infinitepay_payments.sql` (use the exact filename printed by the CLI command in Step 1)
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consumes: `registrations` table created by `20260719212731_466da91e-0111-4be3-b19e-166fa2ad7fa8.sql` and locked down by `20260719212753_536e60af-e065-4fd8-bb1c-efe415dde972.sql`.
- Produces: payment and shirt columns used by `RegistrationRepository`; preserves `anon` and `authenticated` revocations.

- [ ] **Step 1: Create the migration with the Supabase CLI**

Run:

```powershell
npx --yes supabase@latest migration new add_infinitepay_payments
```

Expected: one new migration ending in `_add_infinitepay_payments.sql`. Do not rename it.

- [ ] **Step 2: Put the complete migration in the generated file**

```sql
alter table public.registrations
  add column include_shirt boolean not null default false,
  add column shirt_size text,
  add column amount_cents integer,
  add column payment_status text,
  add column order_nsu uuid,
  add column checkout_url text,
  add column infinitepay_invoice_slug text,
  add column infinitepay_transaction_nsu text,
  add column payment_method text,
  add column installments integer,
  add column paid_amount_cents integer,
  add column receipt_url text,
  add column paid_at timestamptz;

update public.registrations
set payment_status = 'legacy'
where payment_status is null;

alter table public.registrations
  alter column payment_status set not null,
  alter column payment_status set default 'pending';

alter table public.registrations
  drop constraint if exists registrations_role_check;

alter table public.registrations
  add constraint registrations_role_check
    check (role in (
      'participant', 'listener', 'musician', 'choir_member',
      'singer', 'conductor', 'liturgist', 'priest', 'other'
    )),
  add constraint registrations_shirt_selection_check
    check (
      (include_shirt and shirt_size in ('P', 'M', 'G', 'GG', 'XG'))
      or (not include_shirt and shirt_size is null)
    ),
  add constraint registrations_amount_check
    check (amount_cents is null or amount_cents > 0),
  add constraint registrations_payment_status_check
    check (payment_status in ('legacy', 'pending', 'paid')),
  add constraint registrations_order_required_check
    check (
      (payment_status = 'legacy' and order_nsu is null and amount_cents is null)
      or (payment_status in ('pending', 'paid') and order_nsu is not null and amount_cents > 0)
    ),
  add constraint registrations_payment_method_check
    check (payment_method is null or payment_method in ('pix', 'credit_card')),
  add constraint registrations_installments_check
    check (installments is null or installments > 0),
  add constraint registrations_paid_amount_check
    check (paid_amount_cents is null or paid_amount_cents > 0),
  add constraint registrations_paid_details_check
    check (
      payment_status <> 'paid'
      or (
        infinitepay_transaction_nsu is not null
        and payment_method is not null
        and installments is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
    );

create unique index registrations_order_nsu_uidx
  on public.registrations (order_nsu)
  where order_nsu is not null;

create unique index registrations_infinitepay_transaction_nsu_uidx
  on public.registrations (infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;

revoke all on public.registrations from anon, authenticated;
grant all on public.registrations to service_role;
```

- [ ] **Step 3: Verify migration ordering and SQL formatting**

Run:

```powershell
npx --yes supabase@latest migration list --local
git diff --check
```

Expected: the new migration is the last local migration and `git diff --check` exits `0`. If the local database runtime is available, additionally run `npx --yes supabase@latest db reset` and expect all three migrations to apply.

- [ ] **Step 4: Update the generated TypeScript table shape**

Add the new fields to `Row`, `Insert`, and `Update` in `src/integrations/supabase/types.ts`. Use these nullabilities:

```ts
amount_cents: number | null
checkout_url: string | null
include_shirt: boolean
infinitepay_invoice_slug: string | null
infinitepay_transaction_nsu: string | null
installments: number | null
order_nsu: string | null
paid_amount_cents: number | null
paid_at: string | null
payment_method: string | null
payment_status: string
receipt_url: string | null
shirt_size: string | null
```

For `Insert`, make `include_shirt` and `payment_status` optional and keep payment metadata nullable/optional. For `Update`, make every new field optional.

- [ ] **Step 5: Run type-aware build**

Run: `npm run build`

Expected: exit `0`.

- [ ] **Step 6: Commit the schema contract**

```powershell
git add supabase/migrations src/integrations/supabase/types.ts
git commit -m "feat: store InfinitePay payment state"
```

---

### Task 4: Implement the InfinitePay HTTP client

**Files:**
- Create: `src/features/registration/infinitepay.server.ts`
- Create: `src/features/registration/infinitepay.server.test.ts`

**Interfaces:**
- Consumes: `CheckoutItem` and `PaymentLookup` from `registration.domain.ts`, a `fetch`-compatible function, `INFINITEPAY_HANDLE`, and `PUBLIC_SITE_URL`.
- Produces: `InfinitePayClient`, `createInfinitePayClient(fetcher, config)`, `CheckedPayment`, and safe checkout/receipt URL validation.

- [ ] **Step 1: Write failing HTTP contract tests**

Cover these exact cases with a mocked `fetcher`:

```ts
it("creates a checkout with server-owned identifiers and URLs", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ url: "https://checkout.infinitepay.com.br/antonio-gerbson/abc" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const client = createInfinitePayClient(fetcher, {
    handle: "antonio-gerbson",
    siteUrl: "https://encontrocorosce.lovable.app",
  });

  const result = await client.createCheckout({
    orderNsu: "11111111-1111-4111-8111-111111111111",
    items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
    customer: { name: "Maria", email: "maria@example.com", phoneNumber: "85999999999" },
  });

  expect(result.url).toContain("checkout.infinitepay.com.br");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    handle: "antonio-gerbson",
    order_nsu: "11111111-1111-4111-8111-111111111111",
    redirect_url: "https://encontrocorosce.lovable.app/pagamento",
    webhook_url: "https://encontrocorosce.lovable.app/api/infinitepay-webhook",
  });
});

it("rejects a checkout URL outside InfinitePay", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ url: "https://malicious.example/steal" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const client = createInfinitePayClient(fetcher, {
    handle: "antonio-gerbson",
    siteUrl: "https://encontrocorosce.lovable.app",
  });

  await expect(client.createCheckout({
    orderNsu: "11111111-1111-4111-8111-111111111111",
    items: [{ quantity: 1, price: 10000, description: "Inscrição — II Encontro de Coros" }],
    customer: { name: "Maria", email: "maria@example.com", phoneNumber: "85999999999" },
  })).rejects.toThrow("Endereço de checkout inválido");
});

it("maps a verified payment_check response", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      success: true,
      paid: true,
      amount: 10000,
      paid_amount: 10420,
      installments: 2,
      capture_method: "credit_card",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const client = createInfinitePayClient(fetcher, {
    handle: "antonio-gerbson",
    siteUrl: "https://encontrocorosce.lovable.app",
  });

  await expect(client.checkPayment({
    orderNsu: "11111111-1111-4111-8111-111111111111",
    transactionNsu: "transaction-1",
    slug: "invoice-1",
  })).resolves.toEqual({
    paid: true,
    amountCents: 10000,
    paidAmountCents: 10420,
    installments: 2,
    paymentMethod: "credit_card",
  });

  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    handle: "antonio-gerbson",
    order_nsu: "11111111-1111-4111-8111-111111111111",
    transaction_nsu: "transaction-1",
    slug: "invoice-1",
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- src/features/registration/infinitepay.server.test.ts`

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the typed client**

Use this public contract:

```ts
export type PaymentMethod = "pix" | "credit_card";
export type CheckedPayment =
  | { paid: false }
  | {
      paid: true;
      amountCents: number;
      paidAmountCents: number;
      installments: number;
      paymentMethod: PaymentMethod;
    };

export type InfinitePayClient = {
  createCheckout(input: {
    orderNsu: string;
    items: CheckoutItem[];
    customer: { name: string; email: string; phoneNumber: string };
  }): Promise<{ url: string }>;
  checkPayment(input: PaymentLookup): Promise<CheckedPayment>;
};

export function createInfinitePayClient(
  fetcher: typeof fetch,
  config: { handle: string; siteUrl: string },
): InfinitePayClient;
```

Implementation requirements:

- POST JSON to `https://api.checkout.infinitepay.io/links` and `https://api.checkout.infinitepay.io/payment_check`.
- Reject non-2xx responses with the public message `Não foi possível comunicar com a InfinitePay.`
- Parse both `{ url }` and the documented alternate `{ checkout_url }`, but return only `{ url }`.
- Allow checkout hosts `checkout.infinitepay.io` and `checkout.infinitepay.com.br` only.
- `sanitizeInfinitePayReceiptUrl(value)` returns an HTTPS URL only for `infinitepay.io`, `infinitepay.com.br`, or their subdomains; otherwise it returns `undefined`.
- Validate every response with Zod before returning it. Accept a minimal unpaid response as `{ paid: false }`; require amount, paid amount, installments, and capture method whenever `paid` is true.
- Never log request bodies because they contain participant data.

- [ ] **Step 4: Run the client tests**

Run: `npm run test:run -- src/features/registration/infinitepay.server.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the provider client**

```powershell
git add src/features/registration/infinitepay.server.ts src/features/registration/infinitepay.server.test.ts
git commit -m "feat: add InfinitePay checkout client"
```

---

### Task 5: Implement pending-order creation and idempotent reconciliation

**Files:**
- Create: `src/features/registration/registration-payment.server.ts`
- Create: `src/features/registration/registration-payment.server.test.ts`

**Interfaces:**
- Consumes: `RegistrationInput`, `PaymentLookup`, `buildCheckoutItems`, `calculateOrderAmountCents`, `InfinitePayClient`, and `supabaseAdmin`.
- Produces: `RegistrationRepository`, `createRegistrationPaymentService(deps)`, `getRegistrationPaymentService()`, `PublicPaymentStatus`, `startCheckout(input)`, `reconcilePayment(lookup)`, and `getPublicStatus(orderNsu)`.

- [ ] **Step 1: Write failing service tests with fakes**

Use a fake repository and fake InfinitePay client. Cover:

```ts
it("stores a pending registration before requesting checkout", async () => {
  const result = await service.startCheckout(baseInput);
  expect(calls).toEqual(["createPending", "createCheckout", "saveCheckoutUrl"]);
  expect(result).toEqual({
    checkoutUrl: "https://checkout.infinitepay.com.br/antonio-gerbson/abc",
    orderNsu: "11111111-1111-4111-8111-111111111111",
  });
});

it("leaves the registration pending when checkout creation fails", async () => {
  await expect(service.startCheckout(baseInput)).rejects.toThrow();
  expect(repository.findPayment(fixedOrderNsu)).resolves.toMatchObject({ paymentStatus: "pending" });
});

it("rejects an original amount different from the local order", async () => {
  client.checkPayment = vi.fn().mockResolvedValue({
    paid: true,
    amountCents: 9999,
    paidAmountCents: 10420,
    installments: 2,
    paymentMethod: "credit_card",
  });
  await expect(service.reconcilePayment(lookup)).rejects.toThrow("Valor do pagamento divergente");
});

it("accepts a higher paid amount caused by card fee pass-through", async () => {
  const result = await service.reconcilePayment(lookup);
  expect(result.status).toBe("paid");
  expect(repository.markPaid).toHaveBeenCalledOnce();
});

it("does not update twice when the same transaction is repeated", async () => {
  await service.reconcilePayment(lookup);
  await service.reconcilePayment(lookup);
  expect(repository.markPaid).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/features/registration/registration-payment.server.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Define repository and public types**

```ts
export type RegistrationPaymentRecord = {
  id: string;
  orderNsu: string;
  amountCents: number;
  paymentStatus: "pending" | "paid";
  transactionNsu: string | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  receiptUrl: string | null;
};

export type PublicPaymentStatus =
  | { status: "pending" }
  | {
      status: "paid";
      paymentMethod: "pix" | "credit_card";
      installments: number;
      receiptUrl?: string;
    };

export type RegistrationRepository = {
  createPending(input: RegistrationInput & { orderNsu: string; amountCents: number }): Promise<void>;
  saveCheckoutUrl(orderNsu: string, checkoutUrl: string): Promise<void>;
  findPayment(orderNsu: string): Promise<RegistrationPaymentRecord | null>;
  markPaid(orderNsu: string, confirmation: {
    transactionNsu: string;
    invoiceSlug: string;
    paymentMethod: "pix" | "credit_card";
    installments: number;
    paidAmountCents: number;
    receiptUrl?: string;
    paidAt: string;
  }): Promise<RegistrationPaymentRecord>;
};
```

- [ ] **Step 4: Implement the service with dependency injection**

```ts
export function createRegistrationPaymentService(deps: {
  repository: RegistrationRepository;
  infinitePay: InfinitePayClient;
  randomUUID: () => string;
  now: () => string;
}) {
  return {
    startCheckout: async (input: RegistrationInput) => {
      const orderNsu = deps.randomUUID();
      const amountCents = calculateOrderAmountCents(input);
      await deps.repository.createPending({ ...input, orderNsu, amountCents });
      const checkout = await deps.infinitePay.createCheckout({
        orderNsu,
        items: buildCheckoutItems(input),
        customer: { name: input.name, email: input.email, phoneNumber: input.phone },
      });
      await deps.repository.saveCheckoutUrl(orderNsu, checkout.url);
      return { checkoutUrl: checkout.url, orderNsu };
    },
    reconcilePayment: async (lookup: PaymentLookup): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(lookup.orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");

      if (registration.paymentStatus === "paid") {
        if (registration.transactionNsu !== lookup.transactionNsu) {
          throw new Error("Transação divergente para pedido já confirmado.");
        }
        return toPublicPaymentStatus(registration);
      }

      const checked = await deps.infinitePay.checkPayment(lookup);
      if (!checked.paid) return { status: "pending" };
      if (checked.amountCents !== registration.amountCents) {
        throw new Error("Valor do pagamento divergente.");
      }
      if (checked.paidAmountCents < registration.amountCents) {
        throw new Error("Valor pago é inferior ao valor do pedido.");
      }

      const confirmed = await deps.repository.markPaid(lookup.orderNsu, {
        transactionNsu: lookup.transactionNsu,
        invoiceSlug: lookup.slug,
        paymentMethod: checked.paymentMethod,
        installments: checked.installments,
        paidAmountCents: checked.paidAmountCents,
        receiptUrl: sanitizeInfinitePayReceiptUrl(lookup.receiptUrl),
        paidAt: deps.now(),
      });
      return toPublicPaymentStatus(confirmed);
    },
    getPublicStatus: async (orderNsu: string): Promise<PublicPaymentStatus> => {
      const registration = await deps.repository.findPayment(orderNsu);
      if (!registration) throw new Error("Pedido não encontrado.");
      return toPublicPaymentStatus(registration);
    },
  };
}

function toPublicPaymentStatus(record: RegistrationPaymentRecord): PublicPaymentStatus {
  if (
    record.paymentStatus !== "paid" ||
    !record.paymentMethod ||
    !record.installments
  ) {
    return { status: "pending" };
  }
  return {
    status: "paid",
    paymentMethod: record.paymentMethod,
    installments: record.installments,
    ...(record.receiptUrl ? { receiptUrl: record.receiptUrl } : {}),
  };
}
```

The Supabase repository must:

- insert every form field, setting `shirt_size` to `null` when no shirt is selected;
- use `.eq("order_nsu", orderNsu).maybeSingle()` for lookup;
- update only rows with `payment_status = 'pending'`;
- if a conditional update returns no row, reload and accept only the same transaction as an idempotent repeat;
- throw on a different transaction or any database error;
- never return name, email, phone, city, institution, role, observations, or shirt data from `getPublicStatus`.

Implement the repository around this exact query pattern:

```ts
const paymentColumns =
  "id,order_nsu,amount_cents,payment_status,infinitepay_transaction_nsu,payment_method,installments,receipt_url" as const;

function mapPaymentRow(row: {
  id: string;
  order_nsu: string | null;
  amount_cents: number | null;
  payment_status: string;
  infinitepay_transaction_nsu: string | null;
  payment_method: string | null;
  installments: number | null;
  receipt_url: string | null;
}): RegistrationPaymentRecord {
  if (!row.order_nsu || !row.amount_cents || !["pending", "paid"].includes(row.payment_status)) {
    throw new Error("Registro de pagamento inválido.");
  }
  return {
    id: row.id,
    orderNsu: row.order_nsu,
    amountCents: row.amount_cents,
    paymentStatus: row.payment_status as "pending" | "paid",
    transactionNsu: row.infinitepay_transaction_nsu,
    paymentMethod: row.payment_method as "pix" | "credit_card" | null,
    installments: row.installments,
    receiptUrl: row.receipt_url,
  };
}

function createSupabaseRegistrationRepository(): RegistrationRepository {
  const findPayment = async (orderNsu: string) => {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(paymentColumns)
      .eq("order_nsu", orderNsu)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar a inscrição.");
    return data ? mapPaymentRow(data) : null;
  };

  return {
    createPending: async (input) => {
      const { error } = await supabaseAdmin.from("registrations").insert({
        name: input.name,
        email: input.email,
        phone: input.phone,
        city: input.city,
        institution: input.institution || null,
        role: input.role,
        observations: input.observations || null,
        include_shirt: input.includeShirt,
        shirt_size: input.includeShirt ? input.shirtSize : null,
        amount_cents: input.amountCents,
        payment_status: "pending",
        order_nsu: input.orderNsu,
      });
      if (error) throw new Error("Não foi possível salvar a inscrição.");
    },
    saveCheckoutUrl: async (orderNsu, checkoutUrl) => {
      const { error } = await supabaseAdmin
        .from("registrations")
        .update({ checkout_url: checkoutUrl })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending");
      if (error) throw new Error("Não foi possível salvar o checkout.");
    },
    findPayment,
    markPaid: async (orderNsu, confirmation) => {
      const { data, error } = await supabaseAdmin
        .from("registrations")
        .update({
          payment_status: "paid",
          infinitepay_invoice_slug: confirmation.invoiceSlug,
          infinitepay_transaction_nsu: confirmation.transactionNsu,
          payment_method: confirmation.paymentMethod,
          installments: confirmation.installments,
          paid_amount_cents: confirmation.paidAmountCents,
          receipt_url: confirmation.receiptUrl ?? null,
          paid_at: confirmation.paidAt,
        })
        .eq("order_nsu", orderNsu)
        .eq("payment_status", "pending")
        .select(paymentColumns)
        .maybeSingle();
      if (error) throw new Error("Não foi possível confirmar a inscrição.");
      if (data) return mapPaymentRow(data);

      const existing = await findPayment(orderNsu);
      if (existing?.paymentStatus === "paid" && existing.transactionNsu === confirmation.transactionNsu) {
        return existing;
      }
      throw new Error("Transação divergente ou pedido indisponível.");
    },
  };
}
```

`getRegistrationPaymentService()` must lazily import/use `supabaseAdmin`, read `INFINITEPAY_HANDLE || "antonio-gerbson"`, read `PUBLIC_SITE_URL || "https://encontrocorosce.lovable.app"`, and supply `crypto.randomUUID` plus `new Date().toISOString()`.

```ts
let paymentService: ReturnType<typeof createRegistrationPaymentService> | undefined;

export function getRegistrationPaymentService() {
  if (!paymentService) {
    paymentService = createRegistrationPaymentService({
      repository: createSupabaseRegistrationRepository(),
      infinitePay: createInfinitePayClient(fetch, {
        handle: process.env.INFINITEPAY_HANDLE?.trim() || "antonio-gerbson",
        siteUrl: process.env.PUBLIC_SITE_URL?.trim() || "https://encontrocorosce.lovable.app",
      }),
      randomUUID: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    });
  }
  return paymentService;
}
```

- [ ] **Step 5: Run service and domain tests**

Run:

```powershell
npm run test:run -- src/features/registration/registration-payment.server.test.ts src/features/registration/registration.domain.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the payment service**

```powershell
git add src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts
git commit -m "feat: reconcile registration payments"
```

---

### Task 6: Connect same-origin server functions and CSRF protection

**Files:**
- Modify: `src/lib/registration.functions.ts`
- Modify: `src/start.ts`

**Interfaces:**
- Consumes: `registrationSchema`, `paymentLookupSchema`, and `getRegistrationPaymentService()`.
- Produces: `startRegistrationCheckout({ data })` and `verifyRegistrationPayment({ data })` for browser components.

- [ ] **Step 1: Add schema tests for public inputs**

Extend `registration.domain.test.ts` with:

```ts
it("rejects an invalid payment return identifier", () => {
  expect(paymentLookupSchema.safeParse({
    orderNsu: "not-a-uuid",
    transactionNsu: "transaction",
    slug: "invoice",
  }).success).toBe(false);
});
```

- [ ] **Step 2: Run the focused schema regression test**

Run: `npm run test:run -- src/features/registration/registration.domain.test.ts`

Expected: PASS after importing `paymentLookupSchema`; this locks the public input boundary before the server-function glue is changed.

- [ ] **Step 3: Replace the unused insert-only server function**

Use static imports only for client-safe schemas. Dynamically import the server-only service inside each handler:

```ts
import { createServerFn } from "@tanstack/react-start";
import { paymentLookupSchema, registrationSchema } from "@/features/registration/registration.domain";

export const startRegistrationCheckout = createServerFn({ method: "POST" })
  .validator(registrationSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } = await import(
      "@/features/registration/registration-payment.server"
    );
    return getRegistrationPaymentService().startCheckout(data);
  });

export const verifyRegistrationPayment = createServerFn({ method: "POST" })
  .validator(paymentLookupSchema)
  .handler(async ({ data }) => {
    const { getRegistrationPaymentService } = await import(
      "@/features/registration/registration-payment.server"
    );
    return getRegistrationPaymentService().reconcilePayment(data);
  });
```

- [ ] **Step 4: Add TanStack CSRF middleware in `src/start.ts`**

```ts
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test:run -- src/features/registration/registration.domain.test.ts
npm run build
```

Expected: both exit `0`.

- [ ] **Step 6: Commit the server-function boundary**

```powershell
git add src/lib/registration.functions.ts src/start.ts src/features/registration/registration.domain.test.ts
git commit -m "feat: expose secure checkout server functions"
```

---

### Task 7: Add the InfinitePay webhook route

**Files:**
- Create: `src/features/registration/webhook.server.ts`
- Create: `src/features/registration/webhook.server.test.ts`
- Create: `src/routes/api/infinitepay-webhook.ts`

**Interfaces:**
- Consumes: InfinitePay webhook JSON and `getRegistrationPaymentService().reconcilePayment(lookup)`.
- Produces: public `POST /api/infinitepay-webhook` returning `{ success: true, message: null }` on reconciliation and a retryable `400` on invalid or failed reconciliation.

- [ ] **Step 1: Write failing webhook handler tests**

```ts
const validBody = {
  invoice_slug: "abc123",
  amount: 10000,
  paid_amount: 10420,
  installments: 2,
  capture_method: "credit_card",
  transaction_nsu: "transaction-1",
  order_nsu: "11111111-1111-4111-8111-111111111111",
  receipt_url: "https://receipt.infinitepay.io/123",
  items: [],
};

const jsonRequest = (body: unknown) =>
  new Request("https://site.test/api/infinitepay-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const reconcile = vi.fn();

it("rejects malformed JSON with 400", async () => {
  const response = await handleInfinitePayWebhook(
    new Request("https://site.test/api/infinitepay-webhook", { method: "POST", body: "{" }),
    reconcile,
  );
  expect(response.status).toBe(400);
});

it("verifies a valid webhook before acknowledging it", async () => {
  reconcile.mockResolvedValue({ status: "paid", paymentMethod: "credit_card", installments: 2 });
  const response = await handleInfinitePayWebhook(jsonRequest(validBody), reconcile);
  expect(reconcile).toHaveBeenCalledWith({
    orderNsu: validBody.order_nsu,
    transactionNsu: validBody.transaction_nsu,
    slug: validBody.invoice_slug,
    receiptUrl: validBody.receipt_url,
  });
  expect(response.status).toBe(200);
});

it("returns 400 when provider verification fails", async () => {
  reconcile.mockRejectedValue(new Error("Valor do pagamento divergente"));
  expect((await handleInfinitePayWebhook(jsonRequest(validBody), reconcile)).status).toBe(400);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm run test:run -- src/features/registration/webhook.server.test.ts`

Expected: FAIL because `webhook.server.ts` does not exist.

- [ ] **Step 3: Implement the webhook handler**

```ts
import { z } from "zod";
import type { PaymentLookup } from "./registration.domain";
import type { PublicPaymentStatus } from "./registration-payment.server";

const webhookSchema = z.object({
  invoice_slug: z.string().trim().min(1).max(200),
  amount: z.number().int().positive(),
  paid_amount: z.number().int().positive(),
  installments: z.number().int().positive(),
  capture_method: z.enum(["pix", "credit_card"]),
  transaction_nsu: z.string().trim().min(1).max(200),
  order_nsu: z.string().uuid(),
  receipt_url: z.string().url().optional(),
  items: z.array(z.unknown()).optional(),
});

const failedResponse = () =>
  Response.json(
    { success: false, message: "Não foi possível confirmar o pedido." },
    { status: 400 },
  );

export async function handleInfinitePayWebhook(
  request: Request,
  reconcile: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    console.error("[InfinitePay webhook] invalid JSON");
    return failedResponse();
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[InfinitePay webhook] invalid payload");
    return failedResponse();
  }

  try {
    await reconcile({
      orderNsu: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      slug: parsed.data.invoice_slug,
      receiptUrl: parsed.data.receipt_url,
    });
    return Response.json({ success: true, message: null }, { status: 200 });
  } catch {
    console.error("[InfinitePay webhook] reconciliation failed", {
      orderNsu: parsed.data.order_nsu,
    });
    return failedResponse();
  }
}
```

Do not log the request body.

- [ ] **Step 4: Wire the TanStack server route**

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInfinitePayWebhook } = await import(
          "@/features/registration/webhook.server"
        );
        const { getRegistrationPaymentService } = await import(
          "@/features/registration/registration-payment.server"
        );
        return handleInfinitePayWebhook(
          request,
          (lookup) => getRegistrationPaymentService().reconcilePayment(lookup),
        );
      },
    },
  },
});
```

- [ ] **Step 5: Run webhook tests and build to regenerate the route tree**

Run:

```powershell
npm run test:run -- src/features/registration/webhook.server.test.ts
npm run build
```

Expected: tests pass, build exits `0`, and `src/routeTree.gen.ts` contains `/api/infinitepay-webhook`. Do not edit the generated route tree manually.

- [ ] **Step 6: Commit the webhook**

```powershell
git add src/features/registration/webhook.server.ts src/features/registration/webhook.server.test.ts src/routes/api/infinitepay-webhook.ts src/routeTree.gen.ts
git commit -m "feat: confirm InfinitePay webhooks"
```

---

### Task 8: Replace the simulated payment UI with real checkout redirect

**Files:**
- Create: `src/features/registration/RegistrationSection.tsx`
- Create: `src/features/registration/RegistrationSection.test.tsx`
- Modify: `src/routes/index.tsx:1-70`
- Modify: `src/routes/index.tsx:149`
- Modify: `src/routes/index.tsx:687-1125`

**Interfaces:**
- Consumes: `RegistrationInput`, price constants, `startRegistrationCheckout`, existing UI primitives, and the existing shirt asset.
- Produces: `RegistrationSection({ startCheckout?, navigateToCheckout? })` that preserves form state on errors and redirects only to the server-returned InfinitePay URL.

- [ ] **Step 1: Write failing component tests**

Inject collaborators so tests never call the network or mutate `window.location`:

```ts
const startCheckout = vi.fn();
const navigateToCheckout = vi.fn();
const safeUrl = "https://checkout.infinitepay.com.br/antonio-gerbson/abc";
const fixedOrderNsu = "11111111-1111-4111-8111-111111111111";

async function fillRequiredFields(values: { name?: string } = {}) {
  await user.type(screen.getByLabelText("Nome completo"), values.name ?? "Maria da Silva");
  await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
  await user.type(screen.getByLabelText("Telefone"), "85999999999");
  await user.type(screen.getByLabelText("Cidade"), "Quixadá");
}

it("disables the submit button while checkout is being prepared", async () => {
  startCheckout.mockReturnValue(new Promise(() => undefined));
  render(<RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />);
  await fillRequiredFields();
  await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
  expect(screen.getByRole("button", { name: "Preparando pagamento…" })).toBeDisabled();
});

it("keeps the entered form when checkout creation fails", async () => {
  startCheckout.mockRejectedValue(new Error("provider unavailable"));
  render(<RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />);
  await fillRequiredFields({ name: "Maria da Silva" });
  await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
  expect(await screen.findByText("Não foi possível preparar o pagamento. Tente novamente.")).toBeVisible();
  expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria da Silva");
  expect(navigateToCheckout).not.toHaveBeenCalled();
});

it("redirects after a successful server response", async () => {
  startCheckout.mockResolvedValue({ checkoutUrl: safeUrl, orderNsu: fixedOrderNsu });
  render(<RegistrationSection startCheckout={startCheckout} navigateToCheckout={navigateToCheckout} />);
  await fillRequiredFields();
  await user.click(screen.getByRole("button", { name: "Continuar para pagamento" }));
  await waitFor(() => expect(navigateToCheckout).toHaveBeenCalledWith(safeUrl));
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm run test:run -- src/features/registration/RegistrationSection.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Extract and connect the component**

Use this dependency-injection boundary:

```ts
type RegistrationSectionProps = {
  startCheckout?: (input: RegistrationInput) => Promise<{ checkoutUrl: string; orderNsu: string }>;
  navigateToCheckout?: (url: string) => void;
};

export function RegistrationSection({
  startCheckout = (input) => startRegistrationCheckout({ data: input }),
  navigateToCheckout = (url) => window.location.assign(url),
}: RegistrationSectionProps) {
  // Keep the current fields and shirt card, validate with registrationSchema,
  // map Zod issues by field, submit once, and preserve state on failure.
}
```

Required visible changes:

- remove `MOCK_PIX_CODE`, the mock QR panel, copy behavior, and the internal `status === "payment"` branch;
- change the badge to `Pix sem taxa • cartão em até 12x`;
- change the observations placeholder to mention Pix or cartão;
- label the submit button `Continuar para pagamento`;
- while awaiting the server, disable it and show `Preparando pagamento…`;
- render an `aria-live="polite"` error without clearing any field;
- retain the current responsive layout, shirt image, prices, roles, and sizes.

In `index.tsx`, import the extracted component, keep `<RegistrationSection />` at the existing location, and remove imports/constants/types used only by the old embedded component.

- [ ] **Step 4: Run component and domain tests**

Run:

```powershell
npm run test:run -- src/features/registration/RegistrationSection.test.tsx src/features/registration/registration.domain.test.ts
```

Expected: PASS.

- [ ] **Step 5: Build and check the route page**

Run: `npm run build`

Expected: exit `0`; no mock Pix text remains when running `rg -n "MOCK|mockad|QR ilustrativo" src`.

- [ ] **Step 6: Commit the real checkout form**

```powershell
git add src/features/registration/RegistrationSection.tsx src/features/registration/RegistrationSection.test.tsx src/routes/index.tsx
git commit -m "feat: redirect registrations to InfinitePay"
```

---

### Task 9: Add the verified payment return page

**Files:**
- Create: `src/features/registration/PaymentConfirmationPage.tsx`
- Create: `src/features/registration/PaymentConfirmationPage.test.tsx`
- Create: `src/routes/pagamento.tsx`

**Interfaces:**
- Consumes: InfinitePay query parameters and `verifyRegistrationPayment({ data: PaymentLookup })`.
- Produces: `/pagamento` with `processing`, `paid`, `pending`, and temporary-error states; retries pending verification at most three times.

- [ ] **Step 1: Write failing confirmation-page tests**

```ts
it("shows a confirmed Pix payment without personal data", async () => {
  verifyPayment.mockResolvedValue({ status: "paid", paymentMethod: "pix", installments: 1 });
  render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} />);
  expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
  expect(screen.getByText("Pix")).toBeVisible();
});

it("retries a pending payment and then confirms it", async () => {
  vi.useFakeTimers();
  verifyPayment
    .mockResolvedValueOnce({ status: "pending" })
    .mockResolvedValueOnce({ status: "paid", paymentMethod: "credit_card", installments: 2 });
  render(<PaymentConfirmationPage lookup={lookup} verifyPayment={verifyPayment} retryDelayMs={10} />);
  await vi.advanceTimersByTimeAsync(10);
  expect(await screen.findByText("Inscrição confirmada")).toBeVisible();
  vi.useRealTimers();
});

it("does not expose or link an untrusted receipt URL", async () => {
  verifyPayment.mockResolvedValue({
    status: "paid",
    paymentMethod: "pix",
    installments: 1,
    receiptUrl: undefined,
  });
  render(<PaymentConfirmationPage lookup={{ ...lookup, receiptUrl: "https://malicious.example" }} verifyPayment={verifyPayment} />);
  expect(screen.queryByRole("link", { name: "Ver comprovante" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/features/registration/PaymentConfirmationPage.test.tsx`

Expected: FAIL because the page component does not exist.

- [ ] **Step 3: Implement the bounded retry state machine**

Use this interface:

```ts
type PaymentConfirmationPageProps = {
  lookup: PaymentLookup | null;
  verifyPayment?: (lookup: PaymentLookup) => Promise<PublicPaymentStatus>;
  retryDelayMs?: number;
};
```

Behavior:

- invalid/missing lookup: show `Não foi possível identificar este pagamento.` and a home link;
- first valid render: call verification immediately and show `Confirmando pagamento…`;
- `pending`: retry after `2000` ms, up to three total calls;
- paid: stop retries and show `Inscrição confirmada`, `Pix` or `Cartão em N parcelas`, plus only the receipt URL returned by the verified server status;
- still pending after three calls: show `Pagamento ainda não confirmado` and a `Verificar novamente` button that begins a new bounded cycle;
- thrown error: show `Não foi possível verificar agora` and the same retry button.

- [ ] **Step 4: Add `/pagamento` route**

Map InfinitePay query names without trusting them:

```ts
const returnSearchSchema = z.object({
  order_nsu: z.string().optional(),
  transaction_nsu: z.string().optional(),
  slug: z.string().optional(),
  receipt_url: z.string().optional(),
});

export const Route = createFileRoute("/pagamento")({
  validateSearch: (search) => returnSearchSchema.parse(search),
  component: PaymentReturnRoute,
});
```

Inside `PaymentReturnRoute`, transform the values with `paymentLookupSchema.safeParse`. Pass `null` on failure; never render raw query values.

- [ ] **Step 5: Run page tests and build**

Run:

```powershell
npm run test:run -- src/features/registration/PaymentConfirmationPage.test.tsx
npm run build
```

Expected: tests pass, build exits `0`, and `src/routeTree.gen.ts` contains `/pagamento`.

- [ ] **Step 6: Commit the confirmation page**

```powershell
git add src/features/registration/PaymentConfirmationPage.tsx src/features/registration/PaymentConfirmationPage.test.tsx src/routes/pagamento.tsx src/routeTree.gen.ts
git commit -m "feat: show verified payment confirmation"
```

---

### Task 10: Document operations and run the full verification gate

**Files:**
- Modify: `PRODUCT.md:11-29`
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: accurate operating documentation and final local evidence without remote mutation.

- [ ] **Step 1: Update product documentation**

In `PRODUCT.md`, replace the static-backend language with:

```markdown
## Product Purpose

Divulgar o II Encontro de Musica Sacra do Estado do Ceara como uma campanha publica do evento, destacando a experiencia formativa, a cidade de Quixada, a camisa oficial, patrocinadores e uma inscricao online com pagamento pela InfinitePay.

O formulario salva a inscricao como pendente, direciona o participante para pagar por Pix ou cartao e confirma a vaga somente depois da verificacao do pagamento no servidor.
```

Replace the anti-reference that forbids real submission with `Evitar qualquer mensagem que trate uma inscricao pendente como confirmada.` Remove the design principle that calls the form a preview and add `Explicar com clareza os estados aguardando pagamento e inscricao confirmada.` Preserve all other brand, audience, and accessibility guidance.

- [ ] **Step 2: Add a go-live section to `README.md`**

Document exactly:

```markdown
## InfinitePay checkout

- InfiniteTag padrão: `antonio-gerbson`
- Webhook: `https://encontrocorosce.lovable.app/api/infinitepay-webhook`
- Retorno: `https://encontrocorosce.lovable.app/pagamento`
- Variáveis opcionais de servidor: `INFINITEPAY_HANDLE` e `PUBLIC_SITE_URL`

Antes da publicação, habilite Checkout Integrado na conta InfinitePay e configure o cartão para repassar as taxas ao participante. Pix permanece com taxa zero conforme as condições vigentes da InfinitePay.

A migração Supabase deve ser aplicada antes do novo código servido. Não publique apenas uma dessas partes.
```

- [ ] **Step 3: Run the complete automated suite**

Run: `npm run test:run`

Expected: all tests pass with no skipped payment tests.

- [ ] **Step 4: Run static checks and production build**

Run:

```powershell
npm run lint
npm run build
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 5: Verify security-sensitive source invariants**

Run:

```powershell
rg -n "SUPABASE_SERVICE_ROLE_KEY" src
rg -n "MOCK_PIX_CODE|QR MOCK|mockada" src
rg -n "api/infinitepay-webhook|/pagamento|antonio-gerbson" src README.md
```

Expected:

- service-role references appear only in server-only infrastructure;
- the mock search returns no matches;
- webhook, return route, and handle configuration are present.

- [ ] **Step 6: Review the final diff and migration scope**

Run:

```powershell
git status --short
git diff --stat e32a946..HEAD
git log --oneline -12
```

Expected: only files named in this plan are changed; no remote migration or publication has occurred.

- [ ] **Step 7: Commit documentation**

```powershell
git add PRODUCT.md README.md
git commit -m "docs: describe InfinitePay payment operations"
```

- [ ] **Step 8: Report the local-only handoff**

State separately:

- code and tests are complete locally;
- the migration is versioned but not applied remotely;
- the InfinitePay account still needs Checkout Integrado and card-fee pass-through enabled;
- no real charge was created;
- GitHub/Lovable publication was not performed.
