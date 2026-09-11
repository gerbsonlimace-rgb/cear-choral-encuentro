# Unified Portal Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one **Acessar portal** entry point that authenticates once and routes active administrators, regents, and participants to the correct protected area.

**Architecture:** A small pure domain resolver applies the fixed Administrador → Regente → Participante priority. A server-only adapter reuses the current admin/regent and participant authorizers, while one authenticated TanStack server function exposes only an enumerated destination. A single React login page consumes that function; legacy login routes redirect to it and each destination retains its own server authorization.

**Tech Stack:** React 19, TypeScript 5.8, TanStack Start/Router, Supabase Auth, Tailwind CSS, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-11-unified-portal-access-design.md`

## Global Constraints

- The only home-page access label is **Acessar portal**, with destination `/acessar`.
- The login form has no profile selector.
- Multiple active profiles use this exact priority: Administrador → Regente → Participante.
- Allowed destinations are only `/admin/inscricoes`, `/regente/alterar-senha`, `/regente`, and `/participante`.
- Sessions without an active profile are signed out and receive generic feedback.
- `user_metadata`, URL parameters, and client-selected roles never participate in authorization.
- Existing destination middlewares remain the authorization boundary; the resolver does not grant data access.
- Do not create a migration or change RLS for this feature.
- Preserve unrelated modified and untracked files. Never stage `.env`, unrelated Supabase files, or another worktree's changes.
- Do not rebase, amend, squash, force-push, or otherwise rewrite Lovable-published history.
- Push and Lovable publication remain separate production mutations requiring a fresh authorization after local verification.
- Execute in an isolated worktree created with `superpowers:using-git-worktrees` from the latest `codex/refinar-mobile` commit containing spec commit `1baec2b`.
- Before Task 1, the execution branch must contain the completed participant files from `codex/area-participante` and the completed `/regente` route from Task 11 of `docs/superpowers/plans/2026-09-11-regent-area.md`. Verify with:

```powershell
git cat-file -e HEAD:src/features/participant/participant-auth.server.ts
git cat-file -e HEAD:src/routes/participante.index.tsx
git cat-file -e HEAD:src/routes/regente.tsx
```

  Each command must exit `0`. If any command fails, stop this plan and integrate the already-reviewed area work first; do not create a fake destination page.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/features/access/portal-access.domain.ts` | Closed destination types and pure priority resolver |
| `src/features/access/portal-access.domain.test.ts` | Priority, short-circuiting, and denied-state tests |
| `src/features/access/portal-access.server.ts` | Server-only composition of existing role authorizers |
| `src/features/access/portal-access.server.test.ts` | Adapter tests proving reuse of verified user identity and active memberships |
| `src/lib/portal-access.functions.ts` | Authenticated TanStack server-function boundary |
| `src/lib/portal-access.functions.test.ts` | HTTP method, middleware, and minimal-output contract tests |
| `src/features/access/UnifiedPortalLoginPage.tsx` | Single login form and safe session cleanup |
| `src/features/access/UnifiedPortalLoginPage.test.tsx` | Login, existing-session, failure, accessibility, and duplicate-submit tests |
| `src/routes/acessar.tsx` | Public route and destination navigation |
| `src/routes/access-routes.test.tsx` | Unified route and legacy redirect tests |
| `src/routes/admin.login.tsx` | Compatibility redirect to `/acessar` |
| `src/routes/regente.login.tsx` | Compatibility redirect to `/acessar` |
| `src/routes/participante.login.tsx` | Compatibility redirect to `/acessar` |
| `src/routes/admin.inscricoes.tsx` | Direct signed-out redirect to `/acessar` |
| `src/routes/admin.coros.tsx` | Direct signed-out redirect to `/acessar` |
| `src/routes/regente.alterar-senha.tsx` | Direct login-required redirect to `/acessar` |
| `src/routes/regente.tsx` | Direct missing-access redirect to `/acessar` |
| `src/routes/participante.index.tsx` | Direct missing-access redirect to `/acessar` |
| `src/routes/index.tsx` | Responsive home-page **Acessar portal** action |
| `src/routes/-index.test.tsx` | Home-page label and destination regression |
| `src/routeTree.gen.ts` | Generated route tree; update only through the TanStack generator |

After the new flow is green, remove the three superseded login components and their component tests:

- `src/features/admin/AdminLoginPage.tsx`
- `src/features/admin/AdminLoginPage.test.tsx`
- `src/features/regent/RegentLoginPage.tsx`
- `src/features/regent/RegentLoginPage.test.tsx`
- `src/features/participant/ParticipantLoginPage.tsx`
- `src/features/participant/ParticipantLoginPage.test.tsx`

---

### Task 1: Closed destination resolver and server adapters

**Files:**
- Create: `src/features/access/portal-access.domain.ts`
- Create: `src/features/access/portal-access.domain.test.ts`
- Create: `src/features/access/portal-access.server.ts`
- Create: `src/features/access/portal-access.server.test.ts`

**Interfaces:**
- Consumes: `getPortalAuthorizer().findActive(userId, email)` and `getParticipantAuthorizer().findAccess(userId)`.
- Produces: `PortalDestination`, `UnifiedPortalAccess`, `UnifiedPortalChecks`, `createUnifiedPortalResolver(checks)`, and `getUnifiedPortalAccessResolver().resolve(userId, email)`.

- [ ] **Step 1: Write the failing pure-domain tests**

Create `src/features/access/portal-access.domain.test.ts` with concrete fixtures and assertions:

```ts
import { describe, expect, it, vi } from "vitest";
import { createUnifiedPortalResolver, type UnifiedPortalChecks } from "./portal-access.domain";

function setup(overrides: Partial<UnifiedPortalChecks> = {}) {
  const checks: UnifiedPortalChecks = {
    findAdminOrRegent: vi.fn().mockResolvedValue(null),
    hasParticipantAccess: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { checks, resolver: createUnifiedPortalResolver(checks) };
}

describe("unified portal destination", () => {
  it.each([
    [{ role: "admin" as const }, "/admin/inscricoes"],
    [{ role: "regent" as const, passwordChangeRequired: true }, "/regente/alterar-senha"],
    [{ role: "regent" as const, passwordChangeRequired: false }, "/regente"],
  ])("routes an admin or regent profile", async (profile, destination) => {
    const { checks, resolver } = setup({
      findAdminOrRegent: vi.fn().mockResolvedValue(profile),
      hasParticipantAccess: vi.fn().mockResolvedValue(true),
    });

    await expect(resolver.resolve("user-1", "person@example.com")).resolves.toEqual({
      status: "authorized",
      destination,
    });
    expect(checks.hasParticipantAccess).not.toHaveBeenCalled();
  });

  it("uses participant access only after admin and regent access are absent", async () => {
    const { resolver } = setup({ hasParticipantAccess: vi.fn().mockResolvedValue(true) });
    await expect(resolver.resolve("user-1", null)).resolves.toEqual({
      status: "authorized",
      destination: "/participante",
    });
  });

  it("returns no destination when every active-profile lookup is negative", async () => {
    const { resolver } = setup();
    await expect(resolver.resolve("user-1", null)).resolves.toEqual({ status: "unavailable" });
  });
});
```

- [ ] **Step 2: Run the domain test and verify RED**

```powershell
npm run test:run -- src/features/access/portal-access.domain.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `portal-access.domain.ts` does not exist.

- [ ] **Step 3: Implement the closed domain contract**

Create `src/features/access/portal-access.domain.ts`:

```ts
export type PortalDestination =
  | "/admin/inscricoes"
  | "/regente/alterar-senha"
  | "/regente"
  | "/participante";

export type UnifiedPortalAccess =
  | { status: "authorized"; destination: PortalDestination }
  | { status: "unavailable" };

export type AdminOrRegentProfile =
  | { role: "admin" }
  | { role: "regent"; passwordChangeRequired: boolean }
  | null;

export type UnifiedPortalChecks = {
  findAdminOrRegent(userId: string, email: string | null): Promise<AdminOrRegentProfile>;
  hasParticipantAccess(userId: string): Promise<boolean>;
};

export function createUnifiedPortalResolver(checks: UnifiedPortalChecks) {
  return {
    async resolve(userId: string, email: string | null): Promise<UnifiedPortalAccess> {
      const portal = await checks.findAdminOrRegent(userId, email);
      if (portal?.role === "admin") {
        return { status: "authorized", destination: "/admin/inscricoes" };
      }
      if (portal?.role === "regent") {
        return {
          status: "authorized",
          destination: portal.passwordChangeRequired ? "/regente/alterar-senha" : "/regente",
        };
      }
      if (await checks.hasParticipantAccess(userId)) {
        return { status: "authorized", destination: "/participante" };
      }
      return { status: "unavailable" };
    },
  };
}
```

- [ ] **Step 4: Run the domain test and verify GREEN**

```powershell
npm run test:run -- src/features/access/portal-access.domain.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS with 5 parameterized cases and no warnings.

- [ ] **Step 5: Write the failing server-adapter tests**

Mock `getPortalAuthorizer` and `getParticipantAuthorizer` in `src/features/access/portal-access.server.test.ts`. Prove that the adapter maps only the minimum profile facts and uses the verified user ID:

```ts
it("maps the existing admin/regent authorizer before participant access", async () => {
  findPortal.mockResolvedValue({ role: "admin", userId: "user-1", email: "admin@example.com" });

  await expect(getUnifiedPortalAccessResolver().resolve("user-1", "admin@example.com"))
    .resolves.toEqual({ status: "authorized", destination: "/admin/inscricoes" });
  expect(findPortal).toHaveBeenCalledExactlyOnceWith("user-1", "admin@example.com");
  expect(findParticipant).not.toHaveBeenCalled();
});

it("accepts participant access only when the active paid account authorizer confirms it", async () => {
  findPortal.mockResolvedValue(null);
  findParticipant.mockResolvedValue({
    status: "authorized",
    accountId: "private-account",
    registrationId: "private-registration",
    userId: "user-1",
  });

  await expect(getUnifiedPortalAccessResolver().resolve("user-1", null)).resolves.toEqual({
    status: "authorized",
    destination: "/participante",
  });
});
```

- [ ] **Step 6: Run the server-adapter test and verify RED**

```powershell
npm run test:run -- src/features/access/portal-access.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `portal-access.server.ts` does not exist.

- [ ] **Step 7: Compose the existing authorizers on the server**

Create `src/features/access/portal-access.server.ts`:

```ts
import { getPortalAuthorizer } from "@/features/regent/regent-auth.server";
import { getParticipantAuthorizer } from "@/features/participant/participant-auth.server";
import { createUnifiedPortalResolver } from "./portal-access.domain";

let resolver: ReturnType<typeof createUnifiedPortalResolver> | undefined;

export function getUnifiedPortalAccessResolver() {
  if (!resolver) {
    resolver = createUnifiedPortalResolver({
      async findAdminOrRegent(userId, email) {
        const access = await getPortalAuthorizer().findActive(userId, email);
        if (!access) return null;
        return access.role === "admin"
          ? { role: "admin" }
          : { role: "regent", passwordChangeRequired: access.passwordChangeRequired };
      },
      async hasParticipantAccess(userId) {
        return (await getParticipantAuthorizer().findAccess(userId)).status === "authorized";
      },
    });
  }
  return resolver;
}
```

- [ ] **Step 8: Run both resolver tests and verify GREEN**

```powershell
npm run test:run -- src/features/access/portal-access.domain.test.ts src/features/access/portal-access.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS. Confirm the returned objects contain only `status` and `destination`.

- [ ] **Step 9: Commit the resolver**

```powershell
git add -- src/features/access/portal-access.domain.ts src/features/access/portal-access.domain.test.ts src/features/access/portal-access.server.ts src/features/access/portal-access.server.test.ts
git diff --cached --check
git commit -m "feat: resolve unified portal destinations"
```

---

### Task 2: Authenticated server-function boundary

**Files:**
- Create: `src/lib/portal-access.functions.ts`
- Create: `src/lib/portal-access.functions.test.ts`

**Interfaces:**
- Consumes: `getUnifiedPortalAccessResolver().resolve(userId, email)` from Task 1 and `requireSupabaseAuth`.
- Produces: `getUnifiedPortalAccess(): Promise<UnifiedPortalAccess>` as an authenticated GET server function.

- [ ] **Step 1: Write the failing boundary test**

Use the existing `createServerFn` test builder pattern from `src/lib/regent.functions.test.ts`, then assert:

```ts
const fn = getUnifiedPortalAccess as unknown as {
  (input: unknown): Promise<unknown>;
  method: string;
  middlewares: unknown[];
};

expect(fn.method).toBe("GET");
expect(fn.middlewares).toContain(requireSupabaseAuth);

await expect(
  fn({
    data: { role: "admin", userId: "spoofed" },
    context: { userId: "verified-user", claims: { email: "verified@example.com" } },
  }),
).resolves.toEqual({ status: "authorized", destination: "/participante" });

expect(resolve).toHaveBeenCalledExactlyOnceWith("verified-user", "verified@example.com");
```

Add one case where `claims.email` is absent and assert the resolver receives `null`. The test mock must return no identity fields beyond the closed `UnifiedPortalAccess` result.

- [ ] **Step 2: Run the boundary test and verify RED**

```powershell
npm run test:run -- src/lib/portal-access.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `portal-access.functions.ts` does not exist.

- [ ] **Step 3: Implement the authenticated GET function**

Create `src/lib/portal-access.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUnifiedPortalAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUnifiedPortalAccessResolver } =
      await import("@/features/access/portal-access.server");
    return getUnifiedPortalAccessResolver().resolve(
      context.userId,
      typeof context.claims.email === "string" ? context.claims.email : null,
    );
  });
```

- [ ] **Step 4: Run the boundary and existing authorization tests**

```powershell
npm run test:run -- src/lib/portal-access.functions.test.ts src/features/admin/admin-auth.server.test.ts src/features/regent/regent-auth.server.test.ts src/features/participant/participant-auth.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS. The existing admin, regent, and participant authorization behavior must remain unchanged.

- [ ] **Step 5: Commit the boundary**

```powershell
git add -- src/lib/portal-access.functions.ts src/lib/portal-access.functions.test.ts
git diff --cached --check
git commit -m "feat: expose authenticated portal routing"
```

---

### Task 3: Single accessible login page

**Files:**
- Create: `src/features/access/UnifiedPortalLoginPage.tsx`
- Create: `src/features/access/UnifiedPortalLoginPage.test.tsx`

**Interfaces:**
- Consumes: Supabase `signInWithPassword`, `getSession`, `signOut`, and `getUnifiedPortalAccess`.
- Produces: `UnifiedPortalLoginPage({ onAuthorized })`, where `onAuthorized(destination: PortalDestination): void`.

- [ ] **Step 1: Write the failing component tests**

Create a setup helper with injected Auth methods. `getSession` defaults to a resolved null session. Cover the destinations with this parameterized assertion:

```ts
it.each([
  "/admin/inscricoes",
  "/regente/alterar-senha",
  "/regente",
  "/participante",
] as const)("navigates to an authorized %s destination", async (destination) => {
  const { user, signIn, checkAccess, onAuthorized } = setup({
    checkAccess: vi.fn().mockResolvedValue({ status: "authorized", destination }),
  });

  await user.type(screen.getByLabelText("E-mail"), "  pessoa@example.com  ");
  await user.type(screen.getByLabelText("Senha"), "SenhaSegura123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));

  expect(signIn).toHaveBeenCalledExactlyOnceWith({
    email: "pessoa@example.com",
    password: "SenhaSegura123",
  });
  expect(checkAccess).toHaveBeenCalledOnce();
  expect(onAuthorized).toHaveBeenCalledExactlyOnceWith(destination);
  expect(screen.getByLabelText("Senha")).toHaveValue("");
});
```

Add explicit tests for:

```ts
expect(screen.queryByRole("radio")).not.toBeInTheDocument();
expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
expect(screen.getByRole("heading", { name: "Acessar portal" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
```

Also prove these behaviors with real component state, not implementation mocks:

- invalid credentials do not call `checkAccess` or `signOut`, clear the password, and show `Não foi possível entrar. Verifique seu e-mail e senha.`;
- `{ status: "unavailable" }` signs out, does not navigate, and shows `Não foi possível acessar o portal.`;
- a thrown access check attempts sign-out and shows `Não foi possível verificar seu acesso. Tente novamente.` without internal error text;
- two submissions while `signIn` is pending invoke it once;
- show/hide changes only the password input type;
- an existing session calls `checkAccess` without calling `signIn` and navigates;
- no existing session leaves the form ready without calling `checkAccess`;
- unmounting before an async result prevents navigation and state updates.

- [ ] **Step 2: Run the component test and verify RED**

```powershell
npm run test:run -- src/features/access/UnifiedPortalLoginPage.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the minimal login state machine**

Use these exact injectable boundaries in `UnifiedPortalLoginPage.tsx`:

```ts
type Props = {
  onAuthorized: (destination: PortalDestination) => void;
  signIn?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  checkAccess?: () => Promise<UnifiedPortalAccess>;
  signOut?: () => Promise<{ error: unknown }>;
  getSession?: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
};

const defaultSignIn: NonNullable<Props["signIn"]> = (credentials) =>
  supabase.auth.signInWithPassword(credentials);
const defaultCheckAccess = getUnifiedPortalAccess;
const defaultSignOut: NonNullable<Props["signOut"]> = () => supabase.auth.signOut();
const defaultGetSession: NonNullable<Props["getSession"]> = () => supabase.auth.getSession();
```

The component must keep a `busy` ref, a mounted guard, controlled e-mail/password fields, password visibility, pending state, and one generic error string. Both post-login and existing-session checks call one helper:

```ts
async function routeAuthorizedAccess(access: UnifiedPortalAccess) {
  if (access.status === "authorized") {
    onAuthorized(access.destination);
    return true;
  }
  try {
    await signOut();
  } catch {
    // The public response remains generic even if cleanup fails.
  }
  if (mounted.current) setError("Não foi possível acessar o portal.");
  return false;
}
```

On mount, call `getSession()` once. Resolve access only when a session exists. On submit, trim the e-mail, authenticate once, clear the password, then call `checkAccess()`. If the access check throws after a session exists, attempt `signOut()` and show only the generic verification error. Render the existing event identity, `<Label>`, `<Input>`, and `<Button>` primitives, with `autoComplete="email"` and `autoComplete="current-password"`, plus **Voltar ao evento** linking to `/`.

- [ ] **Step 4: Run the component and resolver tests**

```powershell
npm run test:run -- src/features/access/UnifiedPortalLoginPage.test.tsx src/features/access/portal-access.domain.test.ts src/features/access/portal-access.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS with no React act warnings or leaked internal error strings.

- [ ] **Step 5: Commit the login page**

```powershell
git add -- src/features/access/UnifiedPortalLoginPage.tsx src/features/access/UnifiedPortalLoginPage.test.tsx
git diff --cached --check
git commit -m "feat: add unified portal login"
```

---

### Task 4: Unified route and legacy compatibility

**Files:**
- Create: `src/routes/acessar.tsx`
- Create: `src/routes/access-routes.test.tsx`
- Modify: `src/routes/admin.login.tsx`
- Modify: `src/routes/regente.login.tsx`
- Modify: `src/routes/participante.login.tsx`
- Modify: `src/routes/admin.inscricoes.tsx`
- Modify: `src/routes/admin.coros.tsx`
- Modify: `src/routes/regente.alterar-senha.tsx`
- Modify: `src/routes/regente.tsx`
- Modify: `src/routes/participante.index.tsx`
- Delete: `src/features/admin/AdminLoginPage.tsx`
- Delete: `src/features/admin/AdminLoginPage.test.tsx`
- Delete: `src/features/regent/RegentLoginPage.tsx`
- Delete: `src/features/regent/RegentLoginPage.test.tsx`
- Delete: `src/features/participant/ParticipantLoginPage.tsx`
- Delete: `src/features/participant/ParticipantLoginPage.test.tsx`
- Modify generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `UnifiedPortalLoginPage` and its closed `PortalDestination` callback.
- Produces: `/acessar`, three legacy redirects, and direct protected-area fallback navigation to `/acessar`.

- [ ] **Step 1: Write failing route tests**

In `src/routes/access-routes.test.tsx`, mock `useNavigate`, `Navigate`, and `UnifiedPortalLoginPage`. Assert the new route forwards the closed destination:

```ts
render(<UnifiedRoute.options.component! />);
await userEvent.click(screen.getByRole("button", { name: "Resolve portal" }));
expect(navigate).toHaveBeenCalledExactlyOnceWith({ href: "/admin/inscricoes" });
```

Render each legacy route component and require the same replacement target:

```ts
for (const route of [AdminLoginRoute, RegentLoginRoute, ParticipantLoginRoute]) {
  const LegacyLoginRoute = route.options.component!;
  const { unmount } = render(<LegacyLoginRoute />);
  expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/acessar");
  expect(screen.getByTestId("navigate")).toHaveAttribute("data-replace", "true");
  unmount();
}
```

Add source-level assertions only for the protected wrappers, using `readFileSync`, so the tiny route contract is tested without mounting data-heavy pages:

```ts
it.each([
  ["admin.inscricoes.tsx", "/admin/login"],
  ["admin.coros.tsx", "/admin/login"],
  ["regente.alterar-senha.tsx", "/regente/login"],
  ["regente.tsx", "/regente/login"],
  ["participante.index.tsx", "/participante/login"],
])("routes missing access in %s through the unified login", (file, oldDestination) => {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  expect(source).toContain('"/acessar"');
  expect(source).not.toContain(`"${oldDestination}"`);
});
```

- [ ] **Step 2: Run the route test and verify RED**

```powershell
npm run test:run -- src/routes/access-routes.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `/acessar` and the compatibility redirects do not exist.

- [ ] **Step 3: Create `/acessar`**

Create `src/routes/acessar.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UnifiedPortalLoginPage } from "@/features/access/UnifiedPortalLoginPage";

export const Route = createFileRoute("/acessar")({
  component: UnifiedPortalAccessRoute,
  head: () => ({
    meta: [
      { title: "Acessar portal | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function UnifiedPortalAccessRoute() {
  const navigate = useNavigate();
  return <UnifiedPortalLoginPage onAuthorized={(destination) => navigate({ href: destination })} />;
}
```

- [ ] **Step 4: Replace each old login form route with a compatibility redirect**

Preserve each file's existing `head` metadata and replace its component import/body with this route-specific pattern:

```tsx
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  component: () => <Navigate to="/acessar" replace />,
  head: () => ({
    meta: [
      { title: "Acesso administrativo | Encontro de Coros" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
```

Use the identical `<Navigate to="/acessar" replace />` component in `regente.login.tsx` and `participante.login.tsx`, retaining their existing route IDs and titles.

- [ ] **Step 5: Point protected-area fallbacks directly to `/acessar`**

Make these exact replacements:

```tsx
// admin.inscricoes.tsx and admin.coros.tsx
onSignedOut={() => navigate({ to: "/acessar" })}
onMissingSession={() => navigate({ to: "/acessar" })}

// regente.alterar-senha.tsx
onLoginRequired={() => navigate({ to: "/acessar" })}

// participante.index.tsx
onMissingAccess={() => navigate({ to: "/acessar" })}
onSignedOut={() => navigate({ to: "/acessar" })}
```

In `src/routes/regente.tsx`, replace every unauthenticated or forbidden destination `/regente/login` with `/acessar`; keep `/regente/alterar-senha` unchanged for an authenticated gated regent.

- [ ] **Step 6: Remove the unused old login components**

First prove they have no consumers after the route edits:

```powershell
rg -n "AdminLoginPage|RegentLoginPage|ParticipantLoginPage" src -g '!src/features/admin/AdminLoginPage*' -g '!src/features/regent/RegentLoginPage*' -g '!src/features/participant/ParticipantLoginPage*'
```

Expected: no matches. Then delete the six files listed in this task with `apply_patch`; do not use a recursive filesystem command.

- [ ] **Step 7: Generate the route tree and verify GREEN**

```powershell
npm run build
npm run test:run -- src/routes/access-routes.test.tsx src/features/access/UnifiedPortalLoginPage.test.tsx --no-file-parallelism --maxWorkers=1
rg -n 'acessar|admin/login|regente/login|participante/login' src/routeTree.gen.ts
```

Expected: build exits `0`, tests PASS, and the generated tree contains `/acessar` plus all three legacy paths. Inspect `src/routeTree.gen.ts`; do not edit it manually.

- [ ] **Step 8: Commit the route migration**

```powershell
git add -- src/routes/acessar.tsx src/routes/access-routes.test.tsx src/routes/admin.login.tsx src/routes/regente.login.tsx src/routes/participante.login.tsx src/routes/admin.inscricoes.tsx src/routes/admin.coros.tsx src/routes/regente.alterar-senha.tsx src/routes/regente.tsx src/routes/participante.index.tsx src/features/admin/AdminLoginPage.tsx src/features/admin/AdminLoginPage.test.tsx src/features/regent/RegentLoginPage.tsx src/features/regent/RegentLoginPage.test.tsx src/features/participant/ParticipantLoginPage.tsx src/features/participant/ParticipantLoginPage.test.tsx src/routeTree.gen.ts
git diff --cached --check
git commit -m "feat: route legacy logins through unified access"
```

---

### Task 5: Responsive home-page access action

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/-index.test.tsx`

**Interfaces:**
- Consumes: TanStack `Link` and the existing `Button` component.
- Produces: one visible **Acessar portal** link to `/acessar` in the sticky header at desktop and mobile widths.

- [ ] **Step 1: Write the failing home-page test**

Add a focused case to `src/routes/-index.test.tsx`:

```ts
it("offers one unified portal access without displacing registration", () => {
  const IndexPage = Route.options.component!;
  render(<IndexPage />);

  expect(screen.getByRole("link", { name: "Acessar portal" })).toHaveAttribute(
    "href",
    "/acessar",
  );
  expect(screen.getAllByRole("link", { name: "Acessar portal" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Inscrever" })).toHaveAttribute(
    "href",
    "#inscricao",
  );
});
```

Import `screen` from Testing Library. The existing router mock already renders `Link` as an anchor.

- [ ] **Step 2: Run the landing test and verify RED**

```powershell
npm run test:run -- src/routes/-index.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because **Acessar portal** is absent.

- [ ] **Step 3: Add the compact secondary action**

In `Header`, wrap the two actions without changing the current navigation or hero calls to action:

```tsx
<div className="flex shrink-0 items-center gap-2">
  <Button
    asChild
    variant="outline"
    size="sm"
    className="h-10 min-h-10 rounded-full px-3 text-xs font-bold sm:h-11 sm:px-4 sm:text-sm lg:h-10"
  >
    <Link to="/acessar">Acessar portal</Link>
  </Button>
  <Button
    asChild
    size="sm"
    className="h-10 min-h-10 rounded-full bg-amber px-4 text-sm font-bold text-amber-foreground hover:bg-amber/90 sm:h-11 sm:px-5 lg:h-10"
  >
    <a href="#inscricao">Inscrever</a>
  </Button>
</div>
```

Keep the full label visible at all widths. Do not add another access action to the hero or mobile shortcut row.

- [ ] **Step 4: Run the landing and hero regression tests**

```powershell
npm run test:run -- src/routes/-index.test.tsx src/routes/-hero-composition.test.tsx src/routes/-index.quixada.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: PASS. The registration and programme actions and hero composition remain unchanged.

- [ ] **Step 5: Commit the home-page action**

```powershell
git add -- src/routes/index.tsx src/routes/-index.test.tsx
git diff --cached --check
git commit -m "feat: add unified portal access to home"
```

---

### Task 6: Full local verification and publication gate

**Files:**
- Verify only; modify a file only if a fresh failure demonstrates a defect in this feature.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–5 and the completed destination portals.
- Produces: evidence that local code, generated routes, authorization regressions, build output, and responsive presentation satisfy the approved specification.

- [ ] **Step 1: Run the complete focused feature suite**

```powershell
npm run test:run -- src/features/access/portal-access.domain.test.ts src/features/access/portal-access.server.test.ts src/lib/portal-access.functions.test.ts src/features/access/UnifiedPortalLoginPage.test.tsx src/routes/access-routes.test.tsx src/routes/-index.test.tsx src/routes/-hero-composition.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: PASS with zero failed tests and no React act warnings.

- [ ] **Step 2: Run role-authorization regressions**

```powershell
npm run test:run -- src/features/admin/admin-auth.server.test.ts src/features/regent/regent-auth.server.test.ts src/features/participant/participant-auth.server.test.ts src/lib/admin.functions.test.ts src/lib/regent.functions.test.ts src/lib/participant.functions.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: PASS. Admin, regent, and participant data boundaries remain enforced independently of the new router.

- [ ] **Step 3: Run the serial full suite outside nested worktrees**

```powershell
npm run test:run -- --exclude "**/.worktrees/**" --no-file-parallelism --maxWorkers=1
```

Expected: exit `0` and zero failed tests. If an unrelated pre-existing failure remains, record its exact test and do not describe the full suite as green.

- [ ] **Step 4: Run static checks and production build**

```powershell
npx tsc --noEmit
npx eslint src/features/access/portal-access.domain.ts src/features/access/portal-access.domain.test.ts src/features/access/portal-access.server.ts src/features/access/portal-access.server.test.ts src/features/access/UnifiedPortalLoginPage.tsx src/features/access/UnifiedPortalLoginPage.test.tsx src/lib/portal-access.functions.ts src/lib/portal-access.functions.test.ts src/routes/acessar.tsx src/routes/access-routes.test.tsx src/routes/admin.login.tsx src/routes/regente.login.tsx src/routes/participante.login.tsx src/routes/admin.inscricoes.tsx src/routes/admin.coros.tsx src/routes/regente.alterar-senha.tsx src/routes/regente.tsx src/routes/participante.index.tsx src/routes/index.tsx src/routes/-index.test.tsx
npm run build
git diff --check
```

Expected: every command exits `0`. Confirm the build regenerated no unrelated route or formatting changes.

- [ ] **Step 5: Perform local route and responsive smoke tests**

Start the local app in a persistent terminal:

```powershell
npm run dev -- --host localhost --port 4173
```

Verify without real credentials:

1. `http://localhost:4173/` at 1440×900 and 390×844 shows one **Acessar portal** action and keeps **Inscrever** visible.
2. `/acessar` shows e-mail, password, show/hide control, **Entrar**, and **Voltar ao evento**, without profile selection.
3. `/admin/login`, `/regente/login`, and `/participante/login` each replace-navigate to `/acessar`.
4. Direct protected routes without a session reach `/acessar` and expose no private data.
5. The browser console contains no application errors during these public and denied flows.

- [ ] **Step 6: Confirm the exact final diff and commit state**

```powershell
git status --short
git log --oneline --decorate -6
git diff HEAD~5..HEAD --stat
```

Expected: the five feature commits are present and no unrelated file is staged. Keep pre-existing user changes outside the implementation worktree untouched.

- [ ] **Step 7: Stop before production publication**

Report local test, typecheck, lint, build, and browser evidence separately. Before any push to the Lovable-connected branch, state:

- destination: the exact Git remote and branch connected to `https://encontrocorosce.lovable.app/`;
- impact: publish the unified login route, legacy redirects, and home-page action;
- rollback: revert the five feature commits with normal revert commits;
- validation: remote SHA comparison, Lovable build status, served home-page asset inspection, and live route smoke tests.

Obtain fresh explicit authorization before the push. Do not treat a successful Git push as proof that Lovable deployed the new frontend.
