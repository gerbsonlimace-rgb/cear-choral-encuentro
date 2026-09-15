# DetraPay-Inspired Internal Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one responsive black-and-gold operating shell and apply it consistently to the participant, regent, and administration modules without changing the public portal or business behavior.

**Architecture:** Introduce focused shared shell and page-header components, then migrate each authenticated module onto those interfaces. Module-specific navigation data remains close to each module, while scoped CSS tokens and existing shadcn primitives supply the shared visual system.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS 4, Radix UI, Lucide icons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-13-detrapay-internal-shell-design.md`

## Global Constraints

- Do not change the public homepage, `/acessar`, public registration, or public payment-confirmation presentation.
- Preserve route contracts, permissions, server functions, Supabase behavior, media playback, filters, and logout behavior.
- Keep the interface light with black structure and restrained gold emphasis.
- Use at least 44px touch targets, visible focus, safe-area padding, and reduced-motion support.
- Work only in `codex/impeccable-light-polish`; do not push, deploy, or mutate Supabase.

---

### Task 1: Shared internal shell contract

**Files:**
- Create: `src/components/internal-app/InternalAppShell.tsx`
- Create: `src/components/internal-app/InternalAppShell.test.tsx`
- Create: `src/components/internal-app/InternalPageHeader.tsx`
- Create: `src/components/internal-app/InternalMetricCard.tsx`
- Modify: `src/styles.css`
- Test: `src/styles.design.test.ts`

**Interfaces:**
- Produces: `InternalNavItem`, `InternalAppShellProps`, `InternalAppShell`, `InternalPageHeader`, and `InternalMetricCard`.
- Consumes: existing `Button`, `Sheet`, `Avatar`, and Lucide-compatible icon components.

- [ ] **Step 1: Write failing shell tests**

  Assert that desktop navigation exposes all supplied destinations, mobile navigation exposes three primary items plus `Mais`, the active destination carries `aria-current="page"`, and secondary destinations are reachable from the sheet.

- [ ] **Step 2: Run the shell tests and verify RED**

  Run `npm run test:run -- src/components/internal-app/InternalAppShell.test.tsx --no-file-parallelism --maxWorkers=1` and confirm failure because the component does not exist.

- [ ] **Step 3: Implement the minimal shared components**

  Build a controlled shell accepting `brandLabel`, `moduleLabel`, `title`, `navItems`, `activeId`, `onNavigate`, profile metadata, and optional actions. Keep routing outside the component.

- [ ] **Step 4: Add scoped internal-module tokens**

  Add `.internal-app` variables/utilities for light canvas, black topbar, gold active/focus states, desktop sidebar width, bottom safe area, compact cards, and reduced motion. Preserve the public root tokens.

- [ ] **Step 5: Run focused tests and verify GREEN**

  Run `npm run test:run -- src/components/internal-app/InternalAppShell.test.tsx src/styles.design.test.ts --no-file-parallelism --maxWorkers=1`.

### Task 2: Participant migration

**Files:**
- Modify: `src/features/participant/ChoristerAppShell.tsx`
- Modify: `src/features/participant/ChoristerAppShell.test.tsx`
- Modify: `src/features/participant/ChoristerHomeTab.tsx`
- Modify: `src/features/participant/ChoristerProfileTab.tsx`
- Modify: `src/features/participant/ChoristerSongsTab.tsx`
- Modify: `src/features/participant/ChoristerScoresTab.tsx`
- Modify: `src/features/event-activities/ParticipantAttendancePage.tsx`

**Interfaces:**
- Consumes: `InternalAppShell`, `InternalPageHeader`, and existing `ChoristerTab` callbacks.
- Produces: participant-specific navigation mapping with unchanged tab and media-player behavior.

- [ ] **Step 1: Update participant tests for the approved shell**

  Assert black internal topbar, three primary mobile destinations plus `Mais`, secondary `Guia`/profile destinations, active state, and retained player/logout behavior.

- [ ] **Step 2: Run participant tests and verify RED**

  Run the participant shell and portal test files and confirm the new shell assertions fail against the old markup.

- [ ] **Step 3: Migrate participant navigation and surface components**

  Feed the existing participant tabs into `InternalAppShell`; keep selected event, signed URLs, playback, retry, and tab callbacks unchanged. Normalize page headers, event cards, empty/error panels, and profile sections to the shared language.

- [ ] **Step 4: Run participant tests and verify GREEN**

  Run `npm run test:run -- src/features/participant/ChoristerAppShell.test.tsx src/features/participant/ParticipantPortalPage.test.tsx src/features/participant/ChoristerTabs.test.tsx src/features/participant/ChoristerSongPlayer.test.tsx --no-file-parallelism --maxWorkers=1`.

### Task 3: Regent migration

**Files:**
- Modify: `src/features/regent/RegentPortalPage.tsx`
- Modify: `src/features/regent/RegentPortalPage.test.tsx`
- Modify: `src/features/regent/RegentParticipantList.tsx`
- Modify: `src/features/regent/RegentParticipantList.test.tsx`

**Interfaces:**
- Consumes: `InternalAppShell`, `InternalPageHeader`, `InternalMetricCard`, and existing regent data callbacks.
- Produces: controlled summary/participants/profile navigation without changing list queries or payment dialogs.

- [ ] **Step 1: Write failing regent shell assertions**

  Assert the approved topbar, desktop sidebar, mobile bottom navigation, active state, compact metrics, and existing profile/logout accessibility.

- [ ] **Step 2: Run regent tests and verify RED**

  Run both regent component test files and confirm failure on the new shell contract.

- [ ] **Step 3: Migrate regent layout**

  Wrap existing summary, choir selection, participant filters/list, and profile content in the shared shell. Replace local summary cards with `InternalMetricCard` while preserving values and loading/error behavior.

- [ ] **Step 4: Run regent tests and verify GREEN**

  Run `npm run test:run -- src/features/regent/RegentPortalPage.test.tsx src/features/regent/RegentParticipantList.test.tsx --no-file-parallelism --maxWorkers=1`.

### Task 4: Administration migration

**Files:**
- Modify: `src/features/admin/AdminNavigation.tsx`
- Modify: `src/features/admin/AdminNavigation.test.tsx`
- Modify: `src/features/admin/AdminRegistrationsPage.tsx`
- Modify: `src/features/admin/AdminChoirsPage.tsx`
- Modify: `src/features/admin/AdminSponsorsPage.tsx`
- Modify: `src/features/admin/AdminDocumentsPage.tsx`
- Modify: `src/features/admin/AdminCoroAppIntegrationPage.tsx`
- Modify: `src/features/event-activities/AdminEventActivitiesPage.tsx`
- Modify: `src/features/push/AdminPushMessagesPanel.tsx`

**Interfaces:**
- Consumes: shared shell components and existing `AdminNavigationPath` callbacks.
- Produces: complete admin route catalog with desktop sidebar and mobile primary/secondary grouping.

- [ ] **Step 1: Write failing admin navigation tests**

  Assert all admin destinations exist, the mobile primary set is Resumo/Inscrições/Coros, `Mais` contains Patrocinadores/Documentos/Atividades/Integrações/Configurações, and active state is announced.

- [ ] **Step 2: Run navigation tests and verify RED**

  Run `AdminNavigation.test.tsx` and confirm the expanded route catalog fails against the old navigation.

- [ ] **Step 3: Implement the admin shell adapter**

  Make `AdminNavigation` the module adapter over `InternalAppShell` navigation semantics, then apply the shared page header, metric cards, sections, toolbar density, and mobile card language across all admin surfaces.

- [ ] **Step 4: Run admin focused tests and verify GREEN**

  Run navigation plus all modified admin/event/push component tests serially. Record the pre-existing advanced-filter timeout separately if it remains the only failure.

### Task 5: Visual verification and documentation

**Files:**
- Create: `DESIGN.md`
- Create: `.impeccable/design.json`
- Create: `.impeccable/review/desktop.png`
- Create: `.impeccable/review/mobile.png`

**Interfaces:**
- Consumes: finished module shell and the approved design spec.
- Produces: documented tokens plus desktop/mobile evidence.

- [ ] **Step 1: Run static verification**

  Run focused suites, `npm run build`, and Impeccable detection on changed UI targets.

- [ ] **Step 2: Capture one batched visual round**

  Serve the app, inspect authenticated representative routes at 1440px and 390px, and save valid screenshots under `.impeccable/review/`.

- [ ] **Step 3: Apply one consolidated correction batch**

  Fix overflow, hierarchy, contrast, focus, safe-area, and component-consistency issues discovered by the first round.

- [ ] **Step 4: Capture the final confirmation round**

  Rebuild and recapture the same viewports once. Stop visual polishing after this second round.

- [ ] **Step 5: Document the internal design system**

  Record the scoped black/gold operational world, navigation rules, typography, spacing, and state treatments in `DESIGN.md` and `.impeccable/design.json` without redefining the public portal.

## Self-Review

- Spec coverage: shared shell, all three authenticated modules, public exclusions, behavior preservation, responsive navigation, accessibility, and documentation are each assigned to a task.
- Placeholder scan: no deferred `TODO`, `TBD`, or unspecified implementation step remains.
- Type consistency: all module tasks consume the `InternalAppShell`, `InternalPageHeader`, and `InternalMetricCard` interfaces created in Task 1.
