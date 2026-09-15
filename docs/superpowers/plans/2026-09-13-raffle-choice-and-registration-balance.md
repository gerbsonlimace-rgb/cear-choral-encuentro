# Raffle Choice and Registration Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let participants explicitly choose raffle pre-registration or full-price registration, then show and collect the exact outstanding balance from the admin and regent interfaces.

**Architecture:** Keep the database schema unchanged: the trusted `pricing_type` and price snapshots encode the selected path, while the existing complement ledger records later balance payments. Add one shared financial-state calculator, use it in both admin and regent projections, and make complement checkout creation server-owned so the browser sends only the registration ID.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Zod, Vitest/Testing Library, Supabase/Postgres, InfinitePay.

**Spec:** `docs/superpowers/specs/2026-09-13-raffle-choice-and-registration-balance-design.md`

## Global Constraints

- For raffle-enabled choirs, neither option is selected initially and a choice is required before payment.
- The approved positive copy must say that the participant is joining the raffle program, is making a pre-registration, will sell 25 raffles, and has the place confirmed only after the remaining value is paid.
- `pending` initial payment does not grant app access; confirmed pre-registration does grant app access even while the financial status is `partially_paid`.
- A new balance checkout always charges the complete current balance; old confirmed partial complements remain valid and reduce that balance.
- Regressions must be covered with tests that are observed failing before production changes.
- Every admin operation must use server-side `requireAdmin`; every regent operation must resolve the active choir membership server-side.
- Do not trust browser prices, browser roles, `user_metadata`, arbitrary return URLs, or checkout status returned without InfinitePay verification.
- Do not add or apply a Supabase migration unless implementation proves the approved no-migration design impossible and the design is reviewed again.
- Preserve all unrelated work in the primary checkout; work only in `.worktrees/raffle-choice-settlement`.
- Do not push, deploy to Lovable, or mutate a remote database without a separate explicit request.

---

## File map

- `src/features/registration/registration-financial-state.domain.ts`: shared derivation of `pending`, `partially_paid`, `paid`, and `legacy` plus pending cents.
- `src/features/choirs/choir-pricing.domain.ts`: trusted conversion from a raffle-enabled quote plus participant choice into the applied quote.
- `src/features/registration/registration.domain.ts`: submitted choice schema and choice/quote coherence.
- `src/features/registration/registration-payment.server.ts`: server-side quote selection, persisted snapshots, and paid-status metadata for confirmation copy.
- `src/features/registration/RegistrationSection.tsx`: mandatory choice, positive raffle copy, and dynamic review totals.
- `src/features/registration/PaymentConfirmationPage.tsx`: pre-registration versus full-registration confirmation.
- `src/features/regent/regent-payments.domain.ts`: complement eligibility adapter and balance checkout target types.
- `src/features/regent/regent-payment.server.ts`: exact server-calculated balance reservation and role-derived return route.
- `src/features/regent/regent-portal.server.ts`: financial state and ledger projection for regent rows.
- `src/features/regent/BalancePaymentDialog.tsx`: shared confirmation dialog with no editable amount.
- `src/features/regent/RegentParticipantList.tsx`: honest status, pending value, and pay/continue action.
- `src/features/regent/ComplementPaymentConfirmationPage.tsx`: reusable return page with role-specific back link.
- `src/features/admin/admin.domain.ts`: admin derived-status contracts, summaries, filters, and CSV labels.
- `src/features/admin/admin-registration.server.ts`: batched complement enrichment before derived filtering/pagination.
- `src/features/admin/AdminRegistrationsPage.tsx`: status, pending column/field, and shared balance action.
- `src/lib/regent.functions.ts`: narrowed balance checkout server-function input.
- `src/routes/admin.pagamento.tsx`: protected InfinitePay return route for admin-initiated balance payments.
- `src/routeTree.gen.ts`: generated registration of the new admin return route.

---

### Task 1: Shared financial-state domain

**Files:**

- Create: `src/features/registration/registration-financial-state.domain.ts`
- Create: `src/features/registration/registration-financial-state.domain.test.ts`
- Modify: `src/features/regent/regent-payments.domain.ts`
- Modify: `src/features/regent/regent-payments.domain.test.ts`

**Interfaces:**

- Produces: `RegistrationFinancialStatus`, `RegistrationFinancialState`, `deriveRegistrationFinancialState(input)`.
- Consumes: raw registration payment status, trusted price snapshots, initial checkout amount, confirmed complement principal.
- Preserves: `calculateComplementState()` for current regent consumers, implemented from the shared state.

- [ ] **Step 1: Write failing financial-state tests**

```ts
expect(deriveRegistrationFinancialState({
  paymentStatus: "pending",
  initialAmountCents: 10_000,
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  confirmedComplementCents: 0,
})).toEqual({ status: "pending", pendingCents: 10_000, confirmedPrincipalCents: 0 });

expect(deriveRegistrationFinancialState({
  paymentStatus: "paid",
  initialAmountCents: 10_000,
  pricingType: "promotional",
  standardPriceCents: 30_000,
  registrationPriceCents: 10_000,
  confirmedComplementCents: 8_000,
})).toEqual({ status: "partially_paid", pendingCents: 12_000, confirmedPrincipalCents: 18_000 });

expect(deriveRegistrationFinancialState({
  paymentStatus: "paid",
  initialAmountCents: 30_000,
  pricingType: "standard",
  standardPriceCents: 30_000,
  registrationPriceCents: 30_000,
  confirmedComplementCents: 0,
})).toEqual({ status: "paid", pendingCents: 0, confirmedPrincipalCents: 30_000 });
```

Also assert: legacy/missing snapshots return `{ status: "legacy", pendingCents: null, confirmedPrincipalCents: null }`; open/failed/expired payments are absent from `confirmedComplementCents`; overpayment and unsafe integers degrade to `legacy`; a fully settled promotional registration is `paid`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm run test:run -- src/features/registration/registration-financial-state.domain.test.ts src/features/regent/regent-payments.domain.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the shared module and derived state do not exist.

- [ ] **Step 3: Implement the minimal shared calculator and adapter**

```ts
export type RegistrationFinancialStatus = "legacy" | "pending" | "partially_paid" | "paid";

export type RegistrationFinancialState =
  | { status: "legacy"; pendingCents: null; confirmedPrincipalCents: null }
  | {
      status: Exclude<RegistrationFinancialStatus, "legacy">;
      pendingCents: number;
      confirmedPrincipalCents: number;
    };

export function deriveRegistrationFinancialState(input: {
  paymentStatus: "legacy" | "pending" | "paid";
  initialAmountCents: number | null;
  pricingType: "standard" | "promotional" | null;
  standardPriceCents: number | null;
  registrationPriceCents: number | null;
  confirmedComplementCents: number;
}): RegistrationFinancialState;
```

For `pending`, return the positive `initialAmountCents` as pending and zero confirmed principal. For confirmed registrations, validate snapshot coherence, use `registrationPriceCents` as initial principal, subtract confirmed complements from the standard price, and clamp only the exact valid result; inconsistent or overpaid inputs return `legacy` rather than inventing money.

Update `calculateComplementState()` to call the shared calculator for the paid promotional path and retain existing ineligibility reasons and open-payment behavior.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the shared domain**

```powershell
git add -- src/features/registration/registration-financial-state.domain.ts src/features/registration/registration-financial-state.domain.test.ts src/features/regent/regent-payments.domain.ts src/features/regent/regent-payments.domain.test.ts
git commit -m "feat: derive complete registration payment state"
```

---

### Task 2: Trusted raffle choice and checkout snapshots

**Files:**

- Modify: `src/features/choirs/choir-pricing.domain.ts`
- Modify: `src/features/choirs/choir-pricing.domain.test.ts`
- Modify: `src/features/registration/registration.domain.ts`
- Modify: `src/features/registration/registration.domain.test.ts`
- Modify: `src/features/registration/registration-payment.server.ts`
- Modify: `src/features/registration/registration-payment.server.test.ts`

**Interfaces:**

- Produces: `raffleChoiceSchema`, `RaffleChoice = "participate" | "full_price"`, and `applyRaffleChoice(availableQuote, choice)`.
- Changes: `RegistrationInput` gains `raffleChoice: RaffleChoice`.
- Preserves: `resolveActiveChoir(choirId)` as the trusted source of choir eligibility and current prices.

- [ ] **Step 1: Write failing choice and server-authority tests**

```ts
expect(applyRaffleChoice(promotionalQuote, "participate")).toEqual(promotionalQuote);
expect(applyRaffleChoice(promotionalQuote, "full_price")).toEqual({
  pricingType: "standard",
  standardPriceCents: 30_000,
  registrationPriceCents: 30_000,
});
expect(() => applyRaffleChoice(standardQuote, "participate")).toThrow(
  "O programa de rifas não está disponível para este coro.",
);
```

In `registration-payment.server.test.ts`, submit a promotional browser quote with `raffleChoice: "full_price"` and assert `createPending` and InfinitePay receive `30_000`, `pricingType: "standard"`, and no browser-provided promotional amount. Submit `"participate"` and assert `10_000` plus promotional snapshots. Assert an incoherent displayed quote returns the existing configuration-changed error before upload/persistence.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm run test:run -- src/features/choirs/choir-pricing.domain.test.ts src/features/registration/registration.domain.test.ts src/features/registration/registration-payment.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the choice is not part of the contract and the applied quote is always promotional for an eligible choir.

- [ ] **Step 3: Implement choice parsing and trusted quote application**

```ts
export const raffleChoiceSchema = z.enum(["participate", "full_price"]);
export type RaffleChoice = z.infer<typeof raffleChoiceSchema>;

export function applyRaffleChoice(
  availableQuote: DisplayedQuote,
  choice: RaffleChoice,
): DisplayedQuote {
  if (choice === "participate") {
    if (availableQuote.pricingType !== "promotional") {
      throw new Error("O programa de rifas não está disponível para este coro.");
    }
    return availableQuote;
  }
  return {
    pricingType: "standard",
    standardPriceCents: availableQuote.standardPriceCents,
    registrationPriceCents: availableQuote.standardPriceCents,
  };
}
```

Extend `registrationSchema` with `raffleChoice` and require coherent pairs: `participate` requires a promotional displayed quote; `full_price` requires a standard quote with equal prices. In `startCheckout`, call `resolveChoirSelection`, then `applyRaffleChoice(selection.quote, input.raffleChoice)`, compare the displayed quote against that trusted applied quote, and use it for amount/items/snapshots. Do not persist a new column.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit trusted pricing**

```powershell
git add -- src/features/choirs/choir-pricing.domain.ts src/features/choirs/choir-pricing.domain.test.ts src/features/registration/registration.domain.ts src/features/registration/registration.domain.test.ts src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts
git commit -m "feat: apply participant raffle choice server side"
```

---

### Task 3: Mandatory participant choice and positive review copy

**Files:**

- Modify: `src/features/registration/RegistrationSection.tsx`
- Modify: `src/features/registration/RegistrationSection.test.tsx`

**Interfaces:**

- Consumes: `RaffleChoice`, `applyRaffleChoice`, `PublicChoirOption`.
- Produces: a submitted `raffleChoice` and displayed quote matching the visible selection.

- [ ] **Step 1: Write failing interaction tests**

Add tests that select a promotional choir and assert neither radio is initially checked, advancing is blocked with `Escolha como deseja realizar sua inscrição.`, and the choice group receives focus. Then select **Quero participar do Programa de Venda de Rifas** and assert:

```ts
expect(screen.getByText("Pré-inscrição agora: R$ 100,00")).toBeInTheDocument();
expect(screen.getByText("Valor restante: R$ 200,00")).toBeInTheDocument();
expect(screen.getByText(/sua vaga estará confirmada/)).toBeInTheDocument();
expect(screen.getByText(/25 rifas/)).toBeInTheDocument();
```

Select **Prefiro pagar a inscrição integral** and assert only `R$ 300,00` is due now and the review says the place is confirmed after that payment. Assert a non-promotional choir hides the choice and submits `raffleChoice: "full_price"`. Assert changing between promotional choirs clears the choice and changing to a standard choir selects the full-price path internally.

- [ ] **Step 2: Run the UI test and verify RED**

```powershell
npm run test:run -- src/features/registration/RegistrationSection.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the choice group and approved copy are absent.

- [ ] **Step 3: Implement the form state, validation, and summary**

Add `raffleChoice: "" | RaffleChoice` to form state and a `raffleChoice` entry to step 2 fields. Derive the displayed quote with `applyRaffleChoice` only after a valid selection. Use an accessible radio group with visible cards and the exact labels from Step 1. For promotional participation, render:

```tsx
<p>
  Você está aderindo ao Programa de Venda de Rifas do seu coro. Com essa escolha,
  você realiza agora sua pré-inscrição no valor de {preRegistration} e participa da
  mobilização do grupo com a venda de 25 rifas. Assim que o valor restante de
  {remaining} for pago, sua inscrição será concluída e sua vaga estará confirmada.
</p>
```

Ensure the review definition list includes `Programa de rifas` with `Participarei` or `Pagamento integral`, and submit the applied displayed quote rather than the choir's default promotional quote.

- [ ] **Step 4: Run the UI test and verify GREEN**

Run the Step 2 command. Expected: PASS without new `act(...)` warnings from the added tests.

- [ ] **Step 5: Commit the participant UI**

```powershell
git add -- src/features/registration/RegistrationSection.tsx src/features/registration/RegistrationSection.test.tsx
git commit -m "feat: require raffle choice before registration payment"
```

---

### Task 4: Honest initial-payment confirmation and access regression

**Files:**

- Modify: `src/features/registration/registration-payment.server.ts`
- Modify: `src/features/registration/registration-payment.server.test.ts`
- Modify: `src/features/registration/PaymentConfirmationPage.tsx`
- Modify: `src/features/registration/PaymentConfirmationPage.test.tsx`
- Modify: `src/features/participant/participant-provisioning.server.test.ts`
- Modify: `src/features/participant/participant-area.server.test.ts`

**Interfaces:**

- Changes: paid `PublicPaymentStatus` gains required `pricingType`, `standardPriceCents`, and `registrationPriceCents`.
- Preserves: participant provisioning is triggered only from a confirmed initial payment.

- [ ] **Step 1: Write failing confirmation and access tests**

For a paid promotional response, assert the page shows `Pré-inscrição confirmada`, `Acesso ao app liberado`, `Valor restante: R$ 200,00`, and text that the place is confirmed after settlement. For a paid standard response, assert `Inscrição confirmada`, `Vaga confirmada`, and no remaining-value message. In provisioning/participant-area tests, retain explicit assertions that raw `payment_status: "pending"` neither provisions nor authorizes access, while a paid promotional registration does.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/registration/registration-payment.server.test.ts src/features/registration/PaymentConfirmationPage.test.tsx src/features/participant/participant-provisioning.server.test.ts src/features/participant/participant-area.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because public paid status lacks price snapshots and the page uses one success message.

- [ ] **Step 3: Return trusted snapshots and render the correct success state**

Add the three pricing fields to `RegistrationPaymentRecord`, the repository payment projection, and `toPublicPaymentStatus`. Determine the copy from `pricingType === "promotional" && registrationPriceCents < standardPriceCents`; calculate the remaining value from those snapshots. Do not use `paidAmountCents` because provider fees can make it exceed the principal.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit confirmation semantics**

```powershell
git add -- src/features/registration/registration-payment.server.ts src/features/registration/registration-payment.server.test.ts src/features/registration/PaymentConfirmationPage.tsx src/features/registration/PaymentConfirmationPage.test.tsx src/features/participant/participant-provisioning.server.test.ts src/features/participant/participant-area.server.test.ts
git commit -m "feat: distinguish pre-registration confirmation"
```

---

### Task 5: Server-owned full-balance checkout and return routes

**Files:**

- Modify: `src/features/regent/regent-payments.domain.ts`
- Modify: `src/features/regent/regent-payments.domain.test.ts`
- Modify: `src/features/regent/regent-payment.server.ts`
- Modify: `src/features/regent/regent-payment.server.test.ts`
- Modify: `src/features/registration/infinitepay.server.ts`
- Modify: `src/features/registration/infinitepay.server.test.ts`
- Modify: `src/lib/regent.functions.ts`
- Modify: `src/lib/regent.functions.test.ts`
- Modify: `src/features/regent/ComplementPaymentConfirmationPage.tsx`
- Modify: `src/features/regent/ComplementPaymentConfirmationPage.test.tsx`
- Create: `src/routes/admin.pagamento.tsx`
- Modify: `src/features/regent/regente-pagamento-route.test.ts`
- Modify: `src/routeTree.gen.ts`

**Interfaces:**

- Changes: `complementCheckoutSchema` becomes `{ registrationId: string }`; browser-supplied `amountCents` is removed.
- Changes: `RegentPaymentService.startCheckout(input, access)` reserves `state.balanceCents` exactly.
- Changes: InfinitePay `redirectPath` accepts `/admin/pagamento`.
- Changes: `ComplementPaymentConfirmationPage` accepts `returnTo: "/regente" | "/admin/inscricoes"` and `returnLabel: string`.

- [ ] **Step 1: Write failing service and route tests**

```ts
await service.startCheckout({ registrationId }, regent);
expect(repository.reserve).toHaveBeenCalledWith(
  expect.objectContaining({ registrationId, amountCents: 12_000, initiatedAs: "regent" }),
);
expect(infinitePay.createCheckout).toHaveBeenCalledWith(
  expect.objectContaining({
    items: [{ quantity: 1, price: 12_000, description: "Saldo da inscrição — II Encontro de Coros" }],
    redirectPath: "/regente/pagamento",
  }),
);
```

Repeat with admin access and expect `/admin/pagamento`. Assert extra `amountCents` input is rejected by the strict schema, a regent cannot access another choir, an open payment prevents another reservation, old paid complements reduce the exact amount, and zero balance cannot start checkout. Route tests must prove `/admin/pagamento` requires active admin access and uses the admin back link.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-payment.server.test.ts src/features/regent/regent-payments.domain.test.ts src/features/registration/infinitepay.server.test.ts src/lib/regent.functions.test.ts src/features/regent/ComplementPaymentConfirmationPage.test.tsx src/features/regent/regente-pagamento-route.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because amount is client-controlled and the admin return route is absent.

- [ ] **Step 3: Make the server own amount and return path**

Replace the schema with:

```ts
export const complementCheckoutSchema = z
  .object({ registrationId: z.string().uuid() })
  .strict();
```

In `startCheckout`, assign `const amountCents = state.balanceCents`, use it in reservation and provider items, and select the fixed redirect path from `access.role`. Keep the database trigger's `<= balance` rule for compatibility with historical partial checkouts; the new application path always sends equality.

Create `/admin/pagamento` with the same validated InfinitePay search keys as `/regente/pagamento`, an active-admin `beforeLoad`, and the shared confirmation component pointing back to `/admin/inscricoes`. Regenerate the route tree through the normal Vite build/generator rather than hand-maintaining route metadata.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the full-balance server flow**

```powershell
git add -- src/features/regent/regent-payments.domain.ts src/features/regent/regent-payments.domain.test.ts src/features/regent/regent-payment.server.ts src/features/regent/regent-payment.server.test.ts src/features/registration/infinitepay.server.ts src/features/registration/infinitepay.server.test.ts src/lib/regent.functions.ts src/lib/regent.functions.test.ts src/features/regent/ComplementPaymentConfirmationPage.tsx src/features/regent/ComplementPaymentConfirmationPage.test.tsx src/routes/admin.pagamento.tsx src/features/regent/regente-pagamento-route.test.ts src/routeTree.gen.ts
git commit -m "feat: charge the complete registration balance"
```

---

### Task 6: Regent financial status and fixed-balance action

**Files:**

- Modify: `src/features/regent/regent-payments.domain.ts`
- Modify: `src/features/regent/regent-portal.server.ts`
- Modify: `src/features/regent/regent-portal.server.test.ts`
- Create: `src/features/regent/BalancePaymentDialog.tsx`
- Create: `src/features/regent/BalancePaymentDialog.test.tsx`
- Delete: `src/features/regent/ComplementPaymentDialog.tsx`
- Delete: `src/features/regent/ComplementPaymentDialog.test.tsx`
- Modify: `src/features/regent/RegentParticipantList.tsx`
- Modify: `src/features/regent/RegentParticipantList.test.tsx`
- Modify: `src/features/regent/RegentPortalPage.tsx`
- Modify: `src/features/regent/RegentPortalPage.test.tsx`

**Interfaces:**

- Changes: `PortalParticipant` gains `financialState: RegistrationFinancialState` and `initialAmountCents`.
- Produces: `BalancePaymentTarget = { id: string; name: string; balanceCents: number }`.
- Produces: `BalancePaymentDialog` calling `startCheckout({ data: { registrationId } })` once.

- [ ] **Step 1: Write failing regent projection and UI tests**

Assert the portal repository selects `amount_cents`; its service projects a promotional initial payment plus R$ 8.000 in confirmed historical complements as `partially_paid` with R$ 12.000 pending. In the list, assert labels **Parcialmente pago**, **Valor pendente**, **R$ 120,00**, and **Pagar saldo de R$ 120,00**. Assert raw initial pending is **Pendente**, shows its initial checkout amount, and has no balance-payment action. Assert settled and standard-price rows are **Pago** with `R$ 0,00`.

For `BalancePaymentDialog`, assert no textbox exists, the participant and exact balance are visible, double submit calls the server once, an unsafe checkout URL is rejected, and a successful safe URL is navigated to.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:run -- src/features/regent/regent-portal.server.test.ts src/features/regent/RegentParticipantList.test.tsx src/features/regent/BalancePaymentDialog.test.tsx src/features/regent/RegentPortalPage.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the list labels raw initial status and the dialog accepts a free amount.

- [ ] **Step 3: Project and render the derived state**

Add `amount_cents` to participant/summary queries and call `deriveRegistrationFinancialState` with the sum of only `status === "paid"` ledger entries. Render badge labels from:

```ts
const financialLabels = {
  legacy: "Histórico",
  pending: "Pendente",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
} as const;
```

Render the pending value for every state (`Não disponível`, currency balance, or `R$ 0,00`). If an open checkout has a safe URL, show **Continuar pagamento**. Otherwise show **Pagar saldo de R$ X** only for `partially_paid`. Replace the editable complement dialog with `BalancePaymentDialog` and refresh participant/summary data after returning to the portal.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the regent interface**

```powershell
git add -A -- src/features/regent
git commit -m "feat: show and settle regent participant balances"
```

---

### Task 7: Admin derived filters, pending value, and payment action

**Files:**

- Modify: `src/features/admin/admin.domain.ts`
- Modify: `src/features/admin/admin.domain.test.ts`
- Modify: `src/features/admin/admin-registration.server.ts`
- Modify: `src/features/admin/admin-registration.server.test.ts`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.test.tsx`
- Modify: `src/lib/admin.functions.ts`
- Modify: `src/lib/admin.functions.test.ts`

**Interfaces:**

- Changes: `AdminRegistrationRow` gains `financialState` and `openComplementPayment`.
- Changes: admin payment filter accepts `all | pending | partially_paid | paid | legacy` and filters derived state, not raw `registrations.payment_status`.
- Consumes: `BalancePaymentDialog`, `startComplementCheckout`, and shared financial state.

- [ ] **Step 1: Write failing admin domain/repository tests**

Assert `mapAdminRegistrationRow` plus ledger enrichment produces `partially_paid` and R$ 12.000 pending for a paid promotional row with R$ 8.000 confirmed complements. Assert summary counts include `partiallyPaid`, received principal includes initial plus confirmed complements, and expected totals do not count an already confirmed complement twice.

Repository tests must prove that searching happens server-side, complement rows are loaded in bounded batches for candidate IDs, derived filtering occurs before pagination, and only final page photos are signed. Test each filter value with a mixed set of raw pending, partially paid, fully paid, and legacy records.

- [ ] **Step 2: Run admin domain/server tests and verify RED**

```powershell
npm run test:run -- src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/lib/admin.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because admin rows do not include complement ledger data and filters use raw status.

- [ ] **Step 3: Enrich and paginate derived admin rows**

Split repository responsibilities into explicit methods:

```ts
type AdminRegistrationRepository = {
  listCandidates(search: string): Promise<AdminRegistrationCandidate[]>;
  listComplementPayments(registrationIds: string[]): Promise<AdminComplementPaymentRow[]>;
  signPhotos(rows: AdminRegistrationRow[]): Promise<AdminRegistrationRow[]>;
  recordExport(event: AdminExportAuditEvent): Promise<void>;
};
```

Load candidates in deterministic batches of 1.000, query complement rows in bounded registration-ID batches, group by registration, sum only paid principal, preserve the newest open checkout, derive state, apply the requested financial filter, then slice the requested page. Sign photos only after slicing. `listAll` uses the same enriched/filter path without photo signing. Keep search text out of URLs and audit logs.

- [ ] **Step 4: Run domain/server tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing admin page tests**

On desktop and mobile, assert **Parcialmente pago**, **Valor pendente**, **R$ 120,00**, **Pagar saldo de R$ 120,00**, **Continuar pagamento**, **Pendente** with no balance action, and **Pago** with R$ 0,00. Select the `Parcialmente pagas` filter and assert the server input uses `paymentStatus: "partially_paid"`. Open the payment dialog and assert it receives the exact row ID and server-derived balance.

- [ ] **Step 6: Run the page test and verify RED**

```powershell
npm run test:run -- src/features/admin/AdminRegistrationsPage.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the page renders raw status and has no balance action.

- [ ] **Step 7: Render derived status and reuse the balance dialog**

Replace `Status` and `pendingAmountCents` with `row.financialState`. Add the explicit pending column in desktop and field in mobile. Reuse `BalancePaymentDialog`; do not duplicate checkout URL validation in the admin page. Extend filter labels and summary cards with **Parcialmente pagas** while preserving **Históricas**.

- [ ] **Step 8: Run all admin tests and verify GREEN**

```powershell
npm run test:run -- src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.test.tsx src/lib/admin.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 9: Commit the admin interface**

```powershell
git add -- src/features/admin/admin.domain.ts src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.tsx src/features/admin/AdminRegistrationsPage.test.tsx src/lib/admin.functions.ts src/lib/admin.functions.test.ts
git commit -m "feat: manage participant balances from registrations"
```

---

### Task 8: Integrated verification and local proof

**Files:**

- Review: all files changed in Tasks 1–7
- Review: `docs/superpowers/specs/2026-09-13-raffle-choice-and-registration-balance-design.md`
- Review: `supabase/migrations/20260911050000_create_regent_portal.sql`

**Interfaces:**

- Confirms: participant choice, financial projections, access gate, admin/regent authorization, InfinitePay reconciliation, responsive UI, and unchanged database schema.

- [ ] **Step 1: Run the complete focused regression set**

```powershell
npm run test:run -- src/features/choirs/choir-pricing.domain.test.ts src/features/registration/registration.domain.test.ts src/features/registration/registration-financial-state.domain.test.ts src/features/registration/registration-payment.server.test.ts src/features/registration/RegistrationSection.test.tsx src/features/registration/PaymentConfirmationPage.test.tsx src/features/registration/infinitepay.server.test.ts src/features/participant/participant-provisioning.server.test.ts src/features/participant/participant-area.server.test.ts src/features/regent/regent-payments.domain.test.ts src/features/regent/regent-payment.server.test.ts src/features/regent/regent-portal.server.test.ts src/features/regent/RegentParticipantList.test.tsx src/features/regent/BalancePaymentDialog.test.tsx src/features/regent/RegentPortalPage.test.tsx src/features/regent/ComplementPaymentConfirmationPage.test.tsx src/features/regent/regente-pagamento-route.test.ts src/features/admin/admin.domain.test.ts src/features/admin/admin-registration.server.test.ts src/features/admin/AdminRegistrationsPage.test.tsx src/lib/regent.functions.test.ts src/lib/admin.functions.test.ts --no-file-parallelism --maxWorkers=1 --exclude "**/.worktrees/**"
```

Expected: PASS. Report the exact test count.

- [ ] **Step 2: Verify typecheck, lint, formatting, and build**

```powershell
.\node_modules\.bin\tsc.exe --noEmit
npx eslint src/features/choirs/choir-pricing.domain.ts src/features/registration src/features/regent src/features/admin/admin.domain.ts src/features/admin/admin-registration.server.ts src/features/admin/AdminRegistrationsPage.tsx src/lib/regent.functions.ts src/lib/admin.functions.ts src/routes/admin.pagamento.tsx
npx prettier --check src/features/choirs/choir-pricing.domain.ts src/features/registration src/features/regent src/features/admin/admin.domain.ts src/features/admin/admin-registration.server.ts src/features/admin/AdminRegistrationsPage.tsx src/lib/regent.functions.ts src/lib/admin.functions.ts src/routes/admin.pagamento.tsx
npm run build
git diff --check
```

Expected: every command exits 0. Inspect `src/routeTree.gen.ts` and keep only generated changes required for `/admin/pagamento`.

- [ ] **Step 3: Compare database contracts without applying SQL**

```powershell
git diff origin/main -- supabase/migrations src/integrations/supabase/types.ts
```

Expected: no migration or generated Supabase type change. Re-read the existing complement trigger and confirm the application continues to reserve within its enforced balance.

- [ ] **Step 4: Run the app locally and inspect the approved routes**

```powershell
npm run dev -- --host 0.0.0.0 --port 3000
```

Verify at minimum:

- participant registration with promotional choir: required empty choice, both totals, approved positive copy, responsive layout, visible focus;
- participant registration with standard choir: no raffle question and full-price summary;
- `/admin/inscricoes`: all four labels, pending value, fixed-balance action, safe continue action, desktop and mobile;
- `/regente`: same derived values/actions and no cross-choir control;
- `/admin/pagamento` and `/regente/pagamento`: protected route and correct back link.

Do not complete a real InfinitePay payment or mutate production data during browser verification.

- [ ] **Step 5: Inspect scope and commit verification-only adjustments**

```powershell
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

If verification required a source/test correction, stage only those exact files and commit:

```powershell
git commit -m "test: verify raffle balance flow"
```

If there are no additional changes, do not create an empty commit.

---

## Completion evidence

Before claiming completion, record:

- branch name and final local SHA;
- focused serial test count;
- typecheck, targeted lint, formatting, build, and `git diff --check` outcomes;
- local browser routes inspected and what was observed;
- explicit statement that no Supabase migration was created/applied and no production payment was attempted;
- explicit statement that no push or Lovable deployment occurred unless separately requested and verified.
