# Registration Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, authenticated administration area that securely lists, searches, filters, paginates, and exports II Encontro de Coros registrations.

**Architecture:** Supabase Auth identifies the user through the existing bearer-token middleware, then a composable server-function middleware verifies an active `admin_users` membership before any private operation. Server-only repository and service modules use `service_role`; routes consume narrow server functions, and CSV construction plus export auditing happens on the server.

**Tech Stack:** React 19, TanStack Start/Router, Supabase Auth and PostgREST, Zod, Tailwind CSS/Radix UI, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-registration-admin-dashboard-design.md`

## Global Constraints

- Keep `SUPABASE_SERVICE_ROLE_KEY` exclusively in server-only modules; never use a `VITE_*` service key.
- Authorize every private server function independently; route guards are navigation behavior, not the data boundary.
- Do not use `user_metadata`, browser-supplied e-mail, or URL parameters for authorization.
- Preserve every existing registration and every administrative grant/revocation record.
- Do not add registration edit, delete, manual payment confirmation, refund, or admin-management actions.
- Do not apply SQL to remote Supabase, create remote users, call InfinitePay, push Git, or publish to GitHub/Lovable.
- Create migration filenames with Supabase CLI 2.116.0; do not invent migration timestamps.
- Follow red-green-refactor for production behavior and commit each task only after its focused tests pass.

---

## File Structure

- `supabase/migrations/`: the Supabase CLI creates the timestamped `create_admin_dashboard_security` migration containing the private administrator membership and append-only export-audit schema.
- `src/integrations/supabase/types.ts`: local generated-style types for the two new tables.
- `src/features/admin/admin-migration.test.ts`: static security contract for the unapplied local migration.
- `src/features/admin/admin.domain.ts`: input schemas, registration view model, historical labels, currency/date formatting, and CSV encoder.
- `src/features/admin/admin.domain.test.ts`: domain and CSV behavior tests.
- `src/features/admin/admin-auth.server.ts`: active-membership lookup and authorization service using the server-only Supabase client.
- `src/features/admin/admin-auth.server.test.ts`: authorization order and membership tests.
- `src/features/admin/admin-auth.middleware.ts`: composable authenticated-admin middleware for server functions.
- `src/features/admin/admin-registration.server.ts`: paginated registration repository, batched export service, and audit insert.
- `src/features/admin/admin-registration.server.test.ts`: repository, paging, export, and audit tests.
- `src/lib/admin.functions.ts`: narrow typed server-function boundary for access check, list, and export.
- `src/lib/admin.functions.test.ts`: handler delegation and response-minimization tests.
- `src/features/admin/AdminLoginPage.tsx`: login and unauthorized-state UI.
- `src/features/admin/AdminLoginPage.test.tsx`: login behavior tests.
- `src/features/admin/AdminRegistrationsPage.tsx`: responsive read-only table/cards, filters, pagination, export, and logout.
- `src/features/admin/AdminRegistrationsPage.test.tsx`: dashboard interaction tests.
- `src/routes/admin.login.tsx`: `/admin/login` route integration.
- `src/routes/admin.inscricoes.tsx`: protected `/admin/inscricoes` route integration.
- `docs/admin-access.md`: safe bootstrap/revocation procedure, explicitly marked as a later authorized remote operation.

---

### Task 1: Add the local administrator and audit schema

**Files:**
- Create: `src/features/admin/admin-migration.test.ts`
- Create with CLI: the timestamped `create_admin_dashboard_security.sql` path printed by `supabase migration new`
- Modify: `src/integrations/supabase/types.ts:15`
- Create: `docs/admin-access.md`

**Interfaces:**
- Produces: `public.admin_users` append-only memberships and `public.admin_access_events` export events.
- Produces: typed `Database["public"]["Tables"]["admin_users"]` and `admin_access_events` definitions.
- Security contract: no privileges for `anon`/`authenticated`; `service_role` gets `select` on memberships and `select, insert` on audit events.

- [ ] **Step 1: Write the failing migration security test**

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAdminMigration() {
  const directory = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(directory).find((name) =>
    name.endsWith("_create_admin_dashboard_security.sql"),
  );
  if (!file) throw new Error("admin dashboard migration not found");
  return readFileSync(join(directory, file), "utf8").toLowerCase();
}

describe("admin dashboard migration", () => {
  it("keeps memberships and export audit private and non-destructive", () => {
    const sql = readAdminMigration();
    expect(sql).toContain("alter table public.admin_users enable row level security");
    expect(sql).toContain("alter table public.admin_access_events enable row level security");
    expect(sql).toContain("revoke all on public.admin_users from anon, authenticated, service_role");
    expect(sql).toContain("grant select on public.admin_users to service_role");
    expect(sql).toContain("grant select, insert on public.admin_access_events to service_role");
    expect(sql).not.toMatch(/delete\s+from\s+public\.registrations/);
    expect(sql).not.toMatch(/drop\s+table\s+public\.registrations/);
  });
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npm run test:run -- src/features/admin/admin-migration.test.ts`

Expected: FAIL with `admin dashboard migration not found`.

- [ ] **Step 3: Create the migration through the Supabase CLI**

Run: `npx --yes supabase@2.116.0 migration new create_admin_dashboard_security`

Expected: the CLI prints the exact generated file under `supabase/migrations/`. Use that printed path for the remaining steps; do not rename it.

- [ ] **Step 4: Implement the schema in the CLI-created migration**

```sql
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint admin_users_revocation_actor_check
    check (revoked_by is null or revoked_at is not null),
  constraint admin_users_revocation_time_check
    check (revoked_at is null or revoked_at >= granted_at)
);

create unique index admin_users_active_user_uidx
  on public.admin_users (user_id)
  where revoked_at is null;

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated, service_role;
grant select on public.admin_users to service_role;

create table public.admin_access_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payment_status_filter text,
  search_used boolean not null,
  result_count integer not null,
  created_at timestamptz not null default now(),
  constraint admin_access_events_type_check
    check (event_type = 'registrations.export_csv'),
  constraint admin_access_events_status_check
    check (
      payment_status_filter is null
      or payment_status_filter in ('pending', 'paid', 'legacy')
    ),
  constraint admin_access_events_result_count_check
    check (result_count >= 0)
);

alter table public.admin_access_events enable row level security;
revoke all on public.admin_access_events from anon, authenticated, service_role;
grant select, insert on public.admin_access_events to service_role;
```

- [ ] **Step 5: Add generated-style local TypeScript table types**

Add `admin_users` and `admin_access_events` alongside `registrations` in `Database.public.Tables`. Use these exact shapes:

```ts
admin_users: {
  Row: {
    granted_at: string
    granted_by: string | null
    id: string
    revoked_at: string | null
    revoked_by: string | null
    user_id: string
  }
  Insert: {
    granted_at?: string
    granted_by?: string | null
    id?: string
    revoked_at?: string | null
    revoked_by?: string | null
    user_id: string
  }
  Update: {
    granted_at?: string
    granted_by?: string | null
    id?: string
    revoked_at?: string | null
    revoked_by?: string | null
    user_id?: string
  }
  Relationships: []
}
admin_access_events: {
  Row: {
    admin_user_id: string
    created_at: string
    event_type: string
    id: string
    payment_status_filter: string | null
    result_count: number
    search_used: boolean
  }
  Insert: {
    admin_user_id: string
    created_at?: string
    event_type: string
    id?: string
    payment_status_filter?: string | null
    result_count: number
    search_used: boolean
  }
  Update: {
    admin_user_id?: string
    created_at?: string
    event_type?: string
    id?: string
    payment_status_filter?: string | null
    result_count?: number
    search_used?: boolean
  }
  Relationships: []
}
```

- [ ] **Step 6: Document deferred administrator provisioning and revocation**

Create `docs/admin-access.md` with these mandatory points:

```markdown
# Acesso administrativo

O aplicativo não cria administradores automaticamente e não oferece cadastro público.

## Concessão inicial

1. Obtenha autorização específica para alterar o projeto Supabase remoto.
2. Crie ou confirme a conta em Authentication > Users.
3. Copie o UUID imutável da conta.
4. Em uma sessão SQL administrativa autorizada, insira uma nova linha em
   `public.admin_users` com esse UUID em `user_id`.
5. Confirme o acesso pelo painel sem consultar ou expor a chave `service_role`.

## Revogação

Em uma sessão SQL administrativa autorizada, preencha `revoked_at = now()` e
`revoked_by` na associação ativa. Não apague nem reutilize a linha. Uma futura
reconcessão deve inserir uma nova associação para preservar o histórico.

Nenhum desses passos é executado pela aplicação ou por esta entrega local.
```

- [ ] **Step 7: Run the focused test**

Run: `npm run test:run -- src/features/admin/admin-migration.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the schema contract**

```powershell
git add -- supabase/migrations src/integrations/supabase/types.ts src/features/admin/admin-migration.test.ts docs/admin-access.md
git commit -m "feat: define secure admin access schema"
```

---

### Task 2: Define filters, historical presentation, and safe CSV

**Files:**
- Create: `src/features/admin/admin.domain.test.ts`
- Create: `src/features/admin/admin.domain.ts`

**Interfaces:**
- Produces: `adminRegistrationQuerySchema`, `adminRegistrationExportSchema`.
- Produces: `AdminRegistrationRow`, `AdminRegistrationPage`, `AdminExportFile`.
- Produces: `mapAdminRegistrationRow(row)`, `buildRegistrationsCsv(rows, now)`.
- Consumes: raw registration fields already represented by `Database.public.Tables.registrations.Row`.

- [ ] **Step 1: Write failing filter-schema tests**

```ts
import { describe, expect, it } from "vitest";
import { adminRegistrationExportSchema, adminRegistrationQuerySchema } from "./admin.domain";

describe("admin registration filters", () => {
  it("normalizes defaults and trims search", () => {
    expect(adminRegistrationQuerySchema.parse({ search: "  Maria  " })).toEqual({
      search: "Maria",
      paymentStatus: "all",
      page: 1,
      pageSize: 25,
    });
  });

  it("rejects unsupported status and oversized pages", () => {
    expect(() =>
      adminRegistrationQuerySchema.parse({ paymentStatus: "cancelled", pageSize: 101 }),
    ).toThrow();
  });

  it("removes pagination from export input", () => {
    expect(adminRegistrationExportSchema.parse({ search: "Ana", paymentStatus: "paid" })).toEqual({
      search: "Ana",
      paymentStatus: "paid",
    });
  });
});
```

- [ ] **Step 2: Run the schema tests and verify they fail because the domain module is absent**

Run: `npm run test:run -- src/features/admin/admin.domain.test.ts`

Expected: FAIL resolving `./admin.domain`.

- [ ] **Step 3: Implement the validated contracts**

```ts
import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const adminPaymentStatusSchema = z.enum(["all", "pending", "paid", "legacy"]);

export const adminRegistrationQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  paymentStatus: adminPaymentStatusSchema.default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminRegistrationExportSchema = adminRegistrationQuerySchema.pick({
  search: true,
  paymentStatus: true,
});

export type AdminRegistrationQuery = z.infer<typeof adminRegistrationQuerySchema>;
export type AdminRegistrationExportQuery = z.infer<typeof adminRegistrationExportSchema>;
export type RegistrationDatabaseRow = Tables<"registrations">;

export type AdminRegistrationRow = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  institution: string | null;
  role: string;
  paymentStatus: "legacy" | "pending" | "paid";
  shirtLabel: string;
  amountCents: number | null;
  paidAmountCents: number | null;
  paymentMethod: "pix" | "credit_card" | null;
  installments: number | null;
  paidAt: string | null;
};

export type AdminRegistrationPage = {
  rows: AdminRegistrationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminExportFile = { fileName: string; content: string };
```

- [ ] **Step 4: Run the focused tests and verify the filter contracts pass**

Run: `npm run test:run -- src/features/admin/admin.domain.test.ts`

Expected: PASS for the three filter tests.

- [ ] **Step 5: Add failing historical-mapping and CSV tests**

Add fixtures covering a `legacy` row, a pending row without a shirt, and a paid card row. Assert:

```ts
expect(mapAdminRegistrationRow(legacyRow)).toMatchObject({
  paymentStatus: "legacy",
  shirtLabel: "Não informado",
  amountCents: null,
  paymentMethod: null,
  installments: null,
});

const file = buildRegistrationsCsv(
  [mapAdminRegistrationRow({ ...paidRow, name: '=HYPERLINK("https://evil.example")' })],
  new Date("2026-09-07T12:00:00.000Z"),
);
expect(file.fileName).toBe("inscricoes-2026-09-07.csv");
expect(file.content.startsWith("\uFEFFData;Nome;E-mail;Telefone;")).toBe(true);
expect(file.content).toContain("'=" + 'HYPERLINK(""https://evil.example"")');
```

Also test quoted semicolons, embedded quotes, line breaks, Pix, card installments, expected amount, paid amount, and Brazilian date/currency output.

- [ ] **Step 6: Run the new tests and verify missing functions fail**

Run: `npm run test:run -- src/features/admin/admin.domain.test.ts`

Expected: FAIL because `mapAdminRegistrationRow` and `buildRegistrationsCsv` are not exported.

- [ ] **Step 7: Implement mapping and CSV encoding**

Implement these rules in `admin.domain.ts`:

```ts
export function mapAdminRegistrationRow(row: RegistrationDatabaseRow): AdminRegistrationRow {
  const status = row.payment_status as AdminRegistrationRow["paymentStatus"];
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    institution: row.institution,
    role: row.role,
    paymentStatus: status,
    shirtLabel:
      status === "legacy"
        ? "Não informado"
        : row.include_shirt
          ? `Tamanho ${row.shirt_size}`
          : "Sem camisa",
    amountCents: row.amount_cents,
    paidAmountCents: row.paid_amount_cents,
    paymentMethod: row.payment_method as AdminRegistrationRow["paymentMethod"],
    installments: row.installments,
    paidAt: row.paid_at,
  };
}

function escapeSpreadsheetCell(value: string): string {
  const neutralized = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(neutralized)
    ? `"${neutralized.replaceAll('"', '""')}"`
    : neutralized;
}
```

Use a fixed ordered header list, `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza" })`, `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, and `\r\n` row separators. Map absent values to `Não informado`, `pending` to `Pendente`, `paid` to `Pago`, `legacy` to `Histórico`, `pix` to `Pix`, and `credit_card` to `Cartão`.

- [ ] **Step 8: Run domain tests and commit**

Run: `npm run test:run -- src/features/admin/admin.domain.test.ts`

Expected: PASS.

```powershell
git add -- src/features/admin/admin.domain.ts src/features/admin/admin.domain.test.ts
git commit -m "feat: define admin registration exports"
```

---

### Task 3: Enforce active administrator authorization

**Files:**
- Create: `src/features/admin/admin-auth.server.test.ts`
- Create: `src/features/admin/admin-auth.server.ts`
- Create: `src/features/admin/admin-auth.middleware.ts`

**Interfaces:**
- Consumes: `requireSupabaseAuth` context `{ userId, claims }`.
- Produces: `AdminMembership { id: string; userId: string }`.
- Produces: `createAdminAuthorizer(repository).findActive(userId)` and `.requireActive(userId)`.
- Produces: `authorizeAdminOperation(userId, authorizer, operation)`.
- Produces: `requireAdmin` middleware context `{ adminUserId: string; adminMembershipId: string }`.

- [ ] **Step 1: Write failing authorization-order tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { authorizeAdminOperation, createAdminAuthorizer } from "./admin-auth.server";

describe("admin authorization", () => {
  it("rejects a user without an active membership before running the operation", async () => {
    const operation = vi.fn();
    const authorizer = createAdminAuthorizer({ findActive: vi.fn(async () => null) });

    await expect(
      authorizeAdminOperation("user-1", authorizer, operation),
    ).rejects.toThrow("Acesso não autorizado");
    expect(operation).not.toHaveBeenCalled();
  });

  it("passes the active membership to the protected operation", async () => {
    const membership = { id: "membership-1", userId: "user-1" };
    const authorizer = createAdminAuthorizer({ findActive: vi.fn(async () => membership) });

    await expect(
      authorizeAdminOperation("user-1", authorizer, async (admin) => admin.id),
    ).resolves.toBe("membership-1");
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npm run test:run -- src/features/admin/admin-auth.server.test.ts`

Expected: FAIL resolving `./admin-auth.server`.

- [ ] **Step 3: Implement the authorizer and server-only membership repository**

```ts
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminMembership = { id: string; userId: string };
export type AdminMembershipRepository = {
  findActive(userId: string): Promise<AdminMembership | null>;
};

export function createAdminAuthorizer(repository: AdminMembershipRepository) {
  return {
    findActive: (userId: string) => repository.findActive(userId),
    async requireActive(userId: string) {
      const membership = await repository.findActive(userId);
      if (!membership) throw new Error("Acesso não autorizado.");
      return membership;
    },
  };
}

export async function authorizeAdminOperation<T>(
  userId: string,
  authorizer: ReturnType<typeof createAdminAuthorizer>,
  operation: (membership: AdminMembership) => Promise<T>,
) {
  const membership = await authorizer.requireActive(userId);
  return operation(membership);
}
```

The concrete repository must select only `id,user_id`, filter `.eq("user_id", userId)`, filter `.is("revoked_at", null)`, and call `.maybeSingle()`. Map database failures to `Não foi possível validar o acesso administrativo.` without logging the UUID.

Expose the production authorizer lazily:

```ts
let adminAuthorizer: ReturnType<typeof createAdminAuthorizer> | undefined;

export function getAdminAuthorizer() {
  if (!adminAuthorizer) {
    adminAuthorizer = createAdminAuthorizer({
      async findActive(userId) {
        const { data, error } = await supabaseAdmin
          .from("admin_users")
          .select("id,user_id")
          .eq("user_id", userId)
          .is("revoked_at", null)
          .maybeSingle();
        if (error) throw new Error("Não foi possível validar o acesso administrativo.");
        return data ? { id: data.id, userId: data.user_id } : null;
      },
    });
  }
  return adminAuthorizer;
}
```

- [ ] **Step 4: Add and run a failing repository-query test**

Use a fluent Supabase mock whose `from`, `select`, `eq`, `is`, and `maybeSingle` methods append their arguments to a `trace` array. Assert the exact trace:

```ts
expect(trace).toEqual([
  ["from", "admin_users"],
  ["select", "id,user_id"],
  ["eq", "user_id", "user-1"],
  ["is", "revoked_at", null],
  ["maybeSingle"],
]);
```

Run: `npm run test:run -- src/features/admin/admin-auth.server.test.ts`

Expected: FAIL until the concrete repository matches the query contract.

- [ ] **Step 5: Implement the composable middleware**

```ts
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { authorizeAdminOperation, getAdminAuthorizer } = await import("./admin-auth.server");
    return authorizeAdminOperation(context.userId, getAdminAuthorizer(), (membership) =>
      next({
        context: {
          adminUserId: context.userId,
          adminMembershipId: membership.id,
        },
      }),
    );
  });
```

Keep the `supabaseAdmin` import inside `admin-auth.server.ts`; `admin-auth.middleware.ts` must use only a dynamic import of that module inside `.server()`.

- [ ] **Step 6: Run focused and existing authentication tests**

Run: `npm run test:run -- src/features/admin/admin-auth.server.test.ts src/features/registration/registration-payment.server.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit authorization**

```powershell
git add -- src/features/admin/admin-auth.server.ts src/features/admin/admin-auth.server.test.ts src/features/admin/admin-auth.middleware.ts
git commit -m "feat: enforce active administrator access"
```

---

### Task 4: Query registrations and audit server-generated exports

**Files:**
- Create: `src/features/admin/admin-registration.server.test.ts`
- Create: `src/features/admin/admin-registration.server.ts`

**Interfaces:**
- Consumes: `AdminRegistrationQuery`, `AdminRegistrationExportQuery`, `AdminRegistrationPage`, `AdminExportFile`.
- Produces: `AdminRegistrationRepository.list(query)`.
- Produces: `AdminRegistrationRepository.listAll(query)`.
- Produces: `AdminRegistrationRepository.recordExport(event)`.
- Produces: `createAdminRegistrationService(repository, now).list(query)` and `.export(query, adminUserId)`.
- Produces: lazy `getAdminRegistrationService()` wired to the Supabase repository and `() => new Date()`.

- [ ] **Step 1: Write failing repository tests for a deterministic page**

Build a fluent Supabase mock and assert that `list`:

```ts
await repository.list({ search: "Maria", paymentStatus: "paid", page: 2, pageSize: 25 });

expect(trace).toContainEqual(["from", "registrations"]);
expect(trace).toContainEqual(["select", expectedColumns, { count: "exact" }]);
expect(trace).toContainEqual(["eq", "payment_status", "paid"]);
expect(trace).toContainEqual(["order", "created_at", { ascending: false }]);
expect(trace).toContainEqual(["order", "id", { ascending: false }]);
expect(trace).toContainEqual(["range", 25, 49]);
```

Add a hostile search fixture containing `"),payment_status.eq.paid` and assert the generated `.or(...)` expression keeps it inside escaped quoted `ilike` values for only `name`, `email`, `phone`, `city`, and `institution`.

- [ ] **Step 2: Run the repository test and verify the module is missing**

Run: `npm run test:run -- src/features/admin/admin-registration.server.test.ts`

Expected: FAIL resolving `./admin-registration.server`.

- [ ] **Step 3: Implement the repository query**

Use this exact selected-column boundary:

```ts
export const adminRegistrationColumns = [
  "id", "created_at", "name", "email", "phone", "city", "institution", "role",
  "include_shirt", "shirt_size", "amount_cents", "paid_amount_cents", "payment_status",
  "payment_method", "installments", "paid_at",
].join(",");
```

Build the search filter through a single helper that escapes backslash, double quote, `%`, and `_`, wraps each pattern in PostgREST double quotes, and never accepts a column name from input. Apply count, status, `created_at desc`, `id desc`, and the inclusive range. Convert database errors to `Não foi possível consultar as inscrições.`.

- [ ] **Step 4: Add failing batched-export and audit-order tests**

Test 1,005 rows with internal pages of 1,000 and assert two list calls. Then assert the sequence is:

```ts
expect(calls).toEqual(["listAll", "buildCsv", "recordExport"]);
expect(repository.recordExport).toHaveBeenCalledWith({
  adminUserId: "user-1",
  paymentStatusFilter: "paid",
  searchUsed: true,
  resultCount: 1005,
});
```

Also assert:

- a list failure does not call `recordExport`;
- a CSV construction failure does not call `recordExport`;
- an audit insert failure rejects the export instead of returning a file.

- [ ] **Step 5: Implement batching, service orchestration, and append-only audit insert**

```ts
export type AdminExportAuditEvent = {
  adminUserId: string;
  paymentStatusFilter: "pending" | "paid" | "legacy" | null;
  searchUsed: boolean;
  resultCount: number;
};

export function createAdminRegistrationService(
  repository: AdminRegistrationRepository,
  now: () => Date,
) {
  return {
    list: (query: AdminRegistrationQuery) => repository.list(query),
    async export(query: AdminRegistrationExportQuery, adminUserId: string) {
      const rows = await repository.listAll(query);
      const file = buildRegistrationsCsv(rows, now());
      await repository.recordExport({
        adminUserId,
        paymentStatusFilter: query.paymentStatus === "all" ? null : query.paymentStatus,
        searchUsed: query.search.length > 0,
        resultCount: rows.length,
      });
      return file;
    },
  };
}
```

The audit insert must write only `admin_user_id`, `event_type: "registrations.export_csv"`, `payment_status_filter`, `search_used`, and `result_count`. It must not write the search string or exported rows.

Expose the production service through a lazy accessor so environment-backed clients are created only on the server:

```ts
let adminRegistrationService:
  | ReturnType<typeof createAdminRegistrationService>
  | undefined;

export function getAdminRegistrationService() {
  if (!adminRegistrationService) {
    adminRegistrationService = createAdminRegistrationService(
      createSupabaseAdminRegistrationRepository(),
      () => new Date(),
    );
  }
  return adminRegistrationService;
}
```

- [ ] **Step 6: Run focused server tests and commit**

Run: `npm run test:run -- src/features/admin/admin-registration.server.test.ts src/features/admin/admin.domain.test.ts`

Expected: PASS.

```powershell
git add -- src/features/admin/admin-registration.server.ts src/features/admin/admin-registration.server.test.ts
git commit -m "feat: query and export registrations on server"
```

---

### Task 5: Expose narrow protected server functions

**Files:**
- Create: `src/lib/admin.functions.test.ts`
- Create: `src/lib/admin.functions.ts`

**Interfaces:**
- Consumes: `requireSupabaseAuth`, `requireAdmin`, both Zod input schemas, `getAdminAuthorizer()`, and `getAdminRegistrationService()`.
- Produces: `AdminAccessState`, equal to `{ status: "authorized"; userId: string; email: string | null } | { status: "forbidden" }`.
- Produces: `getAdminAccess()`; unauthenticated requests fail in `requireSupabaseAuth`, while authenticated non-admin users receive `{ status: "forbidden" }`.
- Produces: `toAdminAccessState(input)` and `createAdminFunctionHandlers(service)` as pure, testable adapters.
- Produces: `listAdminRegistrations({ data })` returning `AdminRegistrationPage`.
- Produces: `exportAdminRegistrations({ data })` returning `AdminExportFile`.

- [ ] **Step 1: Write failing handler-factory tests**

Export pure `toAdminAccessState(input)` and `createAdminFunctionHandlers(service)` adapters from the future module and test:

```ts
const service = {
  list: vi.fn(async () => page),
  export: vi.fn(async () => ({ fileName: "inscricoes-2026-09-07.csv", content: "csv" })),
};
const handlers = createAdminFunctionHandlers(service);

expect(
  toAdminAccessState({ userId: "user-1", email: "admin@example.com", authorized: true }),
).toEqual({ status: "authorized", userId: "user-1", email: "admin@example.com" });
expect(
  toAdminAccessState({ userId: "user-2", email: "member@example.com", authorized: false }),
).toEqual({ status: "forbidden" });

await expect(handlers.list(query)).resolves.toBe(page);
await expect(handlers.export(exportQuery, "user-1")).resolves.toEqual({
  fileName: "inscricoes-2026-09-07.csv",
  content: "csv",
});
```

Add an access-state test proving unrelated JWT claims are not returned.

- [ ] **Step 2: Run the tests and verify the module is missing**

Run: `npm run test:run -- src/lib/admin.functions.test.ts`

Expected: FAIL resolving `./admin.functions`.

- [ ] **Step 3: Implement functions with authorization attached to each endpoint**

```ts
export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminAuthorizer } = await import("@/features/admin/admin-auth.server");
    const membership = await getAdminAuthorizer().findActive(context.userId);
    return toAdminAccessState({
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      authorized: membership !== null,
    });
  });

export const listAdminRegistrations = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .validator(adminRegistrationQuerySchema)
  .handler(async ({ data }) => handlers.list(data));

export const exportAdminRegistrations = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(adminRegistrationExportSchema)
  .handler(async ({ data, context }) => handlers.export(data, context.adminUserId));
```

Instantiate registration handlers only after dynamically importing `getAdminRegistrationService` inside list/export handlers or through a lazy server-only accessor. Do not statically import `admin-registration.server.ts` or `admin-auth.server.ts` into this isomorphic file. `getAdminAccess` is the sole exception to `requireAdmin`: it returns no registration data and must distinguish an authenticated non-admin from a missing session. List and export always use `requireAdmin`.

- [ ] **Step 4: Run focused tests and inspect the dependency boundary**

Run: `npm run test:run -- src/lib/admin.functions.test.ts src/features/admin/admin-auth.server.test.ts src/features/admin/admin-registration.server.test.ts`

Expected: PASS.

Run: `rg -n "client\.server|SUPABASE_SERVICE_ROLE_KEY" src/lib/admin.functions.ts src/features/admin/admin-auth.middleware.ts`

Expected: no static service-client import and no key reference.

- [ ] **Step 5: Commit the protected function boundary**

```powershell
git add -- src/lib/admin.functions.ts src/lib/admin.functions.test.ts
git commit -m "feat: expose protected admin server functions"
```

---

### Task 6: Build the login route

**Files:**
- Create: `src/features/admin/AdminLoginPage.test.tsx`
- Create: `src/features/admin/AdminLoginPage.tsx`
- Create: `src/routes/admin.login.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `getAdminAccess`, router navigation.
- Produces: login form with generic invalid-credential feedback and an unauthorized signed-in state.
- Route: `/admin/login`.

- [ ] **Step 1: Write failing login-page tests**

Render `AdminLoginPage` with injected `signIn`, `checkAdmin`, and `onAuthorized` callbacks. Test:

```tsx
await user.type(screen.getByLabelText("E-mail"), "admin@example.com");
await user.type(screen.getByLabelText("Senha"), "segredo");
await user.click(screen.getByRole("button", { name: "Entrar" }));

expect(signIn).toHaveBeenCalledWith({
  email: "admin@example.com",
  password: "segredo",
});
expect(checkAdmin).toHaveBeenCalledOnce();
expect(onAuthorized).toHaveBeenCalledOnce();
```

Add tests that:

- invalid credentials show `Não foi possível entrar. Verifique suas credenciais.`;
- a valid Supabase user without admin membership shows `Acesso não autorizado.` and does not navigate;
- the button shows `Entrando…` and remains disabled while pending;
- no raw Supabase error, token, or user-enumeration detail appears.

- [ ] **Step 2: Run the component test and verify the missing component failure**

Run: `npm run test:run -- src/features/admin/AdminLoginPage.test.tsx`

Expected: FAIL resolving `./AdminLoginPage`.

- [ ] **Step 3: Implement the focused login component**

Use semantic labels, `autoComplete="email"`, `autoComplete="current-password"`, a form submit handler, and `role="alert"` for errors. Keep dependencies injectable for tests, with production defaults wrapping:

```ts
supabase.auth.signInWithPassword({ email, password });
getAdminAccess();
```

On `{ status: "forbidden" }`, retain only the Supabase session needed to render the access-denied state and offer an explicit `Sair` action. Do not load registration data.

- [ ] **Step 4: Wire `/admin/login` to the component**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLoginPage } from "@/features/admin/AdminLoginPage";

export const Route = createFileRoute("/admin/login")({ component: AdminLoginRoute });

function AdminLoginRoute() {
  const navigate = useNavigate();
  return <AdminLoginPage onAuthorized={() => navigate({ to: "/admin/inscricoes" })} />;
}
```

Allow the TanStack route generator to update `src/routeTree.gen.ts`; never edit it manually.

- [ ] **Step 5: Run login tests and build-route generation**

Run: `npm run test:run -- src/features/admin/AdminLoginPage.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS and generated route types include `/admin/login`.

- [ ] **Step 6: Commit the login route**

```powershell
git add -- src/features/admin/AdminLoginPage.tsx src/features/admin/AdminLoginPage.test.tsx src/routes/admin.login.tsx src/routeTree.gen.ts
git commit -m "feat: add administrator login"
```

---

### Task 7: Build the responsive registration dashboard

**Files:**
- Create: `src/features/admin/AdminRegistrationsPage.test.tsx`
- Create: `src/features/admin/AdminRegistrationsPage.tsx`
- Create: `src/routes/admin.inscricoes.tsx`
- Modify generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `listAdminRegistrations`, `exportAdminRegistrations`, `getAdminAccess`, `supabase.auth.signOut`.
- Produces: client-side access gate, desktop table, mobile cards, local search/status state, server pagination, CSV download, and logout.
- Route: `/admin/inscricoes`.

- [ ] **Step 1: Write failing list-rendering and historical-accuracy tests**

Render with an injected access check returning `{ status: "authorized" }` and a loader returning one `legacy`, one `pending`, and one paid-card row. Assert visible output includes:

```tsx
expect(await screen.findByText("3 inscrições encontradas")).toBeInTheDocument();
expect(screen.getByText("Histórico")).toBeInTheDocument();
expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
expect(screen.getByText("Tamanho M")).toBeInTheDocument();
expect(screen.getByText("Cartão · 2x")).toBeInTheDocument();
```

Ensure checkout URLs, receipt URLs, transaction NSUs, and observations are absent from the component props and DOM.

- [ ] **Step 2: Run the test and verify the component is missing**

Run: `npm run test:run -- src/features/admin/AdminRegistrationsPage.test.tsx`

Expected: FAIL resolving `./AdminRegistrationsPage`.

- [ ] **Step 3: Implement the initial responsive read-only view**

Use existing `Button`, `Input`, `Select`, `Badge`, `Table`, `Card`, and `Skeleton` components. The page must contain:

- title and result count;
- search input labeled `Pesquisar inscrições`;
- situation select labeled `Situação` with `Todas`, `Pendentes`, `Pagas`, `Históricas`;
- `Exportar CSV` and `Sair` actions;
- table visible at `md` and above;
- equivalent stacked cards below `md`;
- previous/next pagination with current page text;
- explicit loading, empty, retryable error, and expired-session states.

- [ ] **Step 4: Add failing interaction tests**

Use fake timers or an explicit submit/search action, then assert:

- changing search calls the loader with trimmed text and `page: 1`;
- changing situation calls the loader with the chosen status and `page: 1`;
- next page retains filters and increments the page;
- export receives only active `search` and `paymentStatus`;
- export creates a Blob with `text/csv;charset=utf-8`, clicks a temporary anchor with the server filename, then revokes its object URL;
- logout calls `supabase.auth.signOut`, clears state, and navigates to `/admin/login`;
- `{ status: "forbidden" }` renders `Acesso não autorizado` without calling the registration loader;
- a missing browser session redirects to `/admin/login` without calling the registration loader;
- an access-check failure while a browser session still exists renders a retryable temporary error instead of redirecting.

- [ ] **Step 5: Run the interaction tests and verify they fail for missing behavior**

Run: `npm run test:run -- src/features/admin/AdminRegistrationsPage.test.tsx`

Expected: FAIL on search/filter/export/logout assertions.

- [ ] **Step 6: Implement interactions and accessible states**

On mount, call `getAdminAccess` before `listAdminRegistrations`. A forbidden result renders the denied state. If the access call fails, use `supabase.auth.getSession()` only to decide navigation: no local session redirects to login, while an existing session shows a temporary verification error with retry. The local session is never sufficient to authorize or load data.

After authorization, keep `search`, `paymentStatus`, `page`, and `pageSize` in component state, not the URL. Reset `page` to `1` when search or status changes. Disable duplicate loads and exports, announce result/loading changes with an `aria-live="polite"` region, and keep retry actions keyboard accessible.

Use this download boundary:

```ts
const file = await exportAdminRegistrations({ data: { search, paymentStatus } });
const url = URL.createObjectURL(
  new Blob([file.content], { type: "text/csv;charset=utf-8" }),
);
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = file.fileName;
anchor.click();
URL.revokeObjectURL(url);
```

- [ ] **Step 7: Wire the access-gated `/admin/inscricoes` route**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminRegistrationsPage } from "@/features/admin/AdminRegistrationsPage";

export const Route = createFileRoute("/admin/inscricoes")({
  component: AdminRegistrationsRoute,
});

function AdminRegistrationsRoute() {
  const navigate = useNavigate();
  return (
    <AdminRegistrationsPage
      onSignedOut={() => navigate({ to: "/admin/login" })}
      onMissingSession={() => navigate({ to: "/admin/login" })}
    />
  );
}
```

The component must complete the access check before loading any registration. It must not parse error-message text to distinguish states, and the route must not attempt a server-side `beforeLoad` guard because the existing Supabase session is browser-managed and attached to server functions by client middleware. The protected list/export endpoints remain the security boundary.

- [ ] **Step 8: Run focused UI tests and production build**

Run: `npm run test:run -- src/features/admin/AdminLoginPage.test.tsx src/features/admin/AdminRegistrationsPage.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS and generated route types include `/admin/inscricoes`.

- [ ] **Step 9: Commit the dashboard**

```powershell
git add -- src/features/admin/AdminRegistrationsPage.tsx src/features/admin/AdminRegistrationsPage.test.tsx src/routes/admin.inscricoes.tsx src/routeTree.gen.ts
git commit -m "feat: add registration administration dashboard"
```

---

### Task 8: Verify security, migration behavior, and the complete application

**Files:**
- Modify only if verification exposes a defect: files introduced in Tasks 1-7.

**Interfaces:**
- Verifies every criterion in the approved spec.
- Produces no remote changes.

- [ ] **Step 1: Run every automated test serially**

Run: `npm run test:run -- --maxWorkers=1 --minWorkers=1`

Expected: all tests PASS with no unhandled promise rejection.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Inspect secret boundaries in source and public build output**

Run:

```powershell
rg -n "SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role" src
rg -n "SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role" .output/public
```

Expected:

- source references are limited to existing server-only Supabase client code and intentional security comments/tests;
- `.output/public` contains no service-role environment variable name, secret-key prefix, or secret value.

- [ ] **Step 5: Verify local migrations without contacting a remote project**

Run:

```powershell
npx --yes supabase@2.116.0 start
npx --yes supabase@2.116.0 db reset --local
npx --yes supabase@2.116.0 db lint --local
```

Expected: local services start, every migration applies from scratch, and lint reports no database errors. Do not pass `--linked`, `--db-url`, a project reference, or remote credentials.

- [ ] **Step 6: Review the final diff for scope and historical preservation**

Run:

```powershell
git diff ed3ebf5...HEAD --stat
git diff ed3ebf5...HEAD -- supabase/migrations src/features/admin src/lib/admin.functions.ts src/routes/admin.login.tsx src/routes/admin.inscricoes.tsx docs/admin-access.md
```

Confirm:

- no `delete`/`update` path exists for `registrations` in the admin feature;
- every administrative server function has `requireAdmin`;
- audit rows contain no search text or exported personal data;
- legacy records display unknown data as `Não informado`;
- no remote deployment configuration or credential was added.

- [ ] **Step 7: Run `git status` and record verification evidence**

Run: `git status --short --branch`

Expected: clean detached worktree after all local commits. Report the exact test, lint, build, local migration, and secret-scan results without claiming remote deployment.
