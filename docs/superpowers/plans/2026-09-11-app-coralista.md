# App do Coralista Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Entregar um app mobile-first autenticado para o coralista, com as abas Home, Cantos, Partituras e Meu Perfil, consumindo com privacidade o conteúdo do evento oficial administrado no CoroApp.

**Architecture:** O CoroApp mantém o evento oficial e uma publicação privada de ativos em bucket privado. Uma Edge Function do CoroApp autenticada por HMAC fornece somente o feed publicado e URLs assinadas temporárias; uma função de servidor do Encontro valida o participante ativo e pago antes de consultar o feed. O React do Encontro renderiza o shell aprovado e não conhece credenciais, IDs arbitrários ou URLs permanentes do CoroApp.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Supabase Auth, Supabase Edge Functions/Deno, PostgreSQL/RLS/Storage, Tailwind CSS, Vitest, Testing Library e o visualizador PDF já existente.

**Spec:** docs/superpowers/specs/2026-09-11-app-coralista-design.md

## Global Constraints

- O aplicativo exige login e vínculo participante ativo com inscrição paga.
- O CoroApp é a fonte oficial e a primeira versão possui exatamente um evento configurado por CHORISTER_PORTAL_EVENT_ID.
- Áudios, partituras e documentos do portal usam o bucket privado chorister-portal-assets; os buckets legados públicos permanecem inalterados.
- Somente administradores do CoroApp fazem upload, organização, publicação e remoção.
- A função de leitura aceita somente POST, HMAC-SHA-256 recente e o evento configurado; o navegador nunca escolhe event_id.
- URLs assinadas expiram em 10 minutos e o feed validado pode ser armazenado em cache por no máximo 60 segundos.
- O portal do Encontro exibe exatamente Home, Cantos, Partituras e Meu Perfil.
- user_metadata, service_role, segredos, JWTs e URLs assinadas não chegam ao bundle do navegador nem aos logs.
- Preserve modificações não relacionadas, .env e worktrees; não rebaseie, amende, compacte, force-pushe ou publique Lovable automaticamente.
- Antes de cada alteração remota de banco, Storage, secrets, Edge Function, Git ou Lovable, informar alvo, impacto, reversão e validação e solicitar autorização atual.
- Cada tarefa termina com teste focado, git diff --check e commit normal no worktree correspondente.

## Worktrees

- Encontro: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista na branch codex/app-coralista.
- CoroApp: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista na branch codex/app-coralista.
- O checkout principal do CoroApp possui alterações não relacionadas; nenhuma delas entra neste trabalho.

## File Structure

### CoroApp

| Path | Responsibility |
| --- | --- |
| supabase/migrations/20260912000608_create_chorister_portal_assets.sql | Publication, private asset metadata, bucket, grants, RLS, constraints and indexes |
| supabase/tests/chorister_portal_assets_rls.test.sql | Proof that public roles cannot read or mutate portal assets |
| src/features/chorister-portal/choristerPortal.domain.ts | Closed asset/publication types and validation helpers |
| src/features/chorister-portal/choristerPortal.domain.test.ts | Domain and invariant tests |
| src/features/chorister-portal/portalFeed.ts | Feed DTO mapper and HMAC canonical request helpers |
| src/features/chorister-portal/portalFeed.test.ts | Feed mapping and signature tests |
| supabase/functions/_shared/choristerPortal.ts | Deno-safe HMAC, auth, MIME and response helpers |
| supabase/functions/chorister-portal-feed/index.ts | HMAC-protected official-event feed and signed download URLs |
| supabase/functions/chorister-portal-feed/index_test.ts | HMAC, fixed-event, publication and response tests |
| src/features/chorister-portal/choristerPortalAdmin.ts | Typed admin-function client contract |
| supabase/functions/chorister-portal-admin/index.ts | Authenticated admin operations and signed upload URLs |
| supabase/functions/chorister-portal-admin/index_test.ts | Admin authorization and operation tests |
| src/features/chorister-portal/ChoristerPortalAdminPanel.tsx | Admin-only publication, upload and ordering UI |
| src/features/chorister-portal/ChoristerPortalAdminPanel.test.tsx | Admin panel interaction and failure tests |
| src/pages/SimpleEventAudios.tsx | Mount the admin panel without changing existing editor behavior |
| src/integrations/supabase/types.ts | Generated types after the migration |

### Encontro

| Path | Responsibility |
| --- | --- |
| src/features/chorister-app/choristerApp.domain.ts | Feed schema, tab state, search and expired-URL rules |
| src/features/chorister-app/choristerApp.domain.test.ts | DTO validation and UI-domain tests |
| src/features/chorister-app/choristerApp.server.ts | Participant gate, HMAC client and 60-second validated cache |
| src/features/chorister-app/choristerApp.server.test.ts | Server boundary tests proving no call for unauthorized users |
| src/lib/chorister-app.functions.ts | Authenticated TanStack server function |
| src/lib/chorister-app.functions.test.ts | Method, auth and minimal-output tests |
| src/features/participant/ChoristerAppShell.tsx | Mobile shell, bottom navigation and persistent player |
| src/features/participant/ChoristerAppShell.test.tsx | Four-tab navigation and accessibility tests |
| src/features/participant/ChoristerHomeTab.tsx | Event card and quick actions |
| src/features/participant/ChoristerSongsTab.tsx | Ordered songs, search, voice selection and player |
| src/features/participant/ChoristerScoresTab.tsx | Scores/documents list, signed PDF viewer and download |
| src/features/participant/ChoristerProfileTab.tsx | Existing participant identity, receipt, password and logout actions |
| src/features/participant/ChoristerTabs.test.tsx | Tab-specific rendering and failure tests |
| src/features/participant/ParticipantPortalPage.tsx | Authorization/loading gate and shell composition |
| src/features/participant/ParticipantPortalPage.test.tsx | Portal regression tests |

---

### Task 1: CoroApp private schema and domain invariants

**Files:**

- Modify: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\migrations\20260912000608_create_chorister_portal_assets.sql
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\tests\chorister_portal_assets_rls.test.sql
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\choristerPortal.domain.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\choristerPortal.domain.test.ts
- Modify: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\integrations\supabase\types.ts

**Interfaces:**

- PortalAssetKind: audio | sheet_music | manual | document.
- PortalVoicePart: principal | soprano | contralto | tenor | baixo | todos.
- validatePortalAssetInput(input): PortalAssetInput.
- isPublishablePortalAsset(asset): boolean.

- [ ] Step 1: Write the failing domain tests.

~~~ts
it('accepts a published soprano audio attached to a song', () => {
  const asset = validatePortalAssetInput({
    kind: 'audio', eventSongId: 'song-1', voicePart: 'soprano',
    title: 'Soprano', mimeType: 'audio/mpeg', sizeBytes: 1200,
  });
  expect(asset.kind).toBe('audio');
});

it('rejects an audio without a voice part', () => {
  expect(() => validatePortalAssetInput({
    kind: 'audio', eventSongId: 'song-1', voicePart: null,
    title: 'Audio', mimeType: 'audio/mpeg', sizeBytes: 1200,
  })).toThrow('voice_part');
});
~~~

Also test a manual linked to a song, invalid MIME, non-positive size and an unpublished asset.

- [ ] Step 2: Run the focused test and verify RED.

~~~powershell
Set-Location C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista
npm test -- --run src/features/chorister-portal/choristerPortal.domain.test.ts
~~~

Expected: failure because the domain module does not exist.

- [ ] Step 3: Implement the domain and SQL migration. Create chorister_portal_publications and chorister_portal_assets with RLS enabled, public/anon/authenticated/service_role table privileges revoked, and only the exact service-role operations granted to Edge Functions. Add relationship, MIME, size and voice constraints, indexes on publication/status/order and event song/kind/voice. Create private bucket chorister-portal-assets with no public SELECT policy; accept audio/mpeg, audio/mp4, audio/wav up to 100 MiB and application/pdf up to 25 MiB. Store only normalized paths.

- [ ] Step 4: Run tests and local security checks.

~~~powershell
npm test -- --run src/features/chorister-portal/choristerPortal.domain.test.ts
npx supabase@latest db lint --local
git diff --check
~~~

The SQL test must prove anon and authenticated cannot select, insert, update, delete or read Storage objects.

- [ ] Step 5: Generate types and commit.

~~~powershell
npx supabase@latest gen types typescript --local > src/integrations/supabase/types.ts
git add supabase/migrations/20260912000608_create_chorister_portal_assets.sql supabase/tests/chorister_portal_assets_rls.test.sql src/features/chorister-portal src/integrations/supabase/types.ts
git commit -m "feat: add private chorister portal assets"
~~~

### Task 2: CoroApp HMAC helpers and private feed

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\portalFeed.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\portalFeed.test.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\functions\_shared\choristerPortal.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\functions\chorister-portal-feed\index.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\functions\chorister-portal-feed\index_test.ts

**Interfaces:**

- buildPortalCanonicalMessage(timestamp, method, path): string.
- createPortalSignature(secret, timestamp, method, path): Promise<string>.
- mapPortalFeed(event, songs, assets): PortalFeed.
- POST /functions/v1/chorister-portal-feed returns published or not_published.

- [ ] Step 1: Write failing tests for a fixed HMAC vector, stale timestamp, invalid signature, arbitrary event_id body, omitted drafts/unpublished assets and ten-minute signed URLs.

- [ ] Step 2: Run the tests and verify RED.

~~~powershell
npx vitest run src/features/chorister-portal/portalFeed.test.ts
~~~

- [ ] Step 3: Implement Deno-safe helpers and feed. Read CHORISTER_PORTAL_EVENT_ID and CHORISTER_PORTAL_SHARED_SECRET from Deno.env; require POST, timestamp, signature and no selector; compare signatures in constant time; use service role only after the request gate; load the configured publication and event associations; create signed URLs with expiresIn 600; return the closed DTO. Never include storage_path, credentials or internal errors.

- [ ] Step 4: Serve and exercise the function locally.

~~~powershell
npx supabase@latest functions serve chorister-portal-feed --env-file supabase/.env.local
~~~

Exercise one valid request and missing signature, stale timestamp and arbitrary event body. Only the valid request may return 200.

- [ ] Step 5: Commit.

~~~powershell
git add src/features/chorister-portal/portalFeed.ts src/features/chorister-portal/portalFeed.test.ts supabase/functions/_shared/choristerPortal.ts supabase/functions/chorister-portal-feed
git commit -m "feat: expose private chorister portal feed"
~~~

### Task 3: CoroApp authenticated admin function

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\functions\chorister-portal-admin\index.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\supabase\functions\chorister-portal-admin\index_test.ts
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\choristerPortalAdmin.ts

**Interfaces:**

- portalAdminOperationSchema accepts list, begin_upload, finalize_upload, update_asset, delete_asset, publish and unpublish.
- begin_upload returns uploadUrl, storagePath and assetId.
- finalize_upload returns an asset only after Storage metadata confirms MIME and size.
- delete_asset deletes exactly the private object and row; it never deletes a songs row.

- [ ] Step 1: Write failing tests for no JWT, non-admin JWT, another tenant, wrong event ID, invalid MIME/size, incomplete audio metadata, successful finalization, publication transition and library-song preservation.

- [ ] Step 2: Run the focused tests and verify RED.

~~~powershell
npx vitest run src/features/chorister-portal/choristerPortalAdmin.test.ts
~~~

- [ ] Step 3: Implement the function. Validate the normal CoroApp JWT, reuse the existing tenant-admin/write authorization helper, reject every event except CHORISTER_PORTAL_EVENT_ID, validate operation input, issue signed upload URLs into events/<event-id>/<kind>/<asset-id>/<safe-filename>, and use service role only after authorization. Do not accept a client-provided storage path.

- [ ] Step 4: Implement the typed client wrapper and verify.

~~~powershell
npx vitest run src/features/chorister-portal/choristerPortalAdmin.test.ts
npx supabase@latest functions serve chorister-portal-admin --env-file supabase/.env.local
git diff --check
~~~

- [ ] Step 5: Commit.

~~~powershell
git add supabase/functions/chorister-portal-admin src/features/chorister-portal/choristerPortalAdmin.ts
git commit -m "feat: add chorister portal admin operations"
~~~

### Task 4: CoroApp administrator UI

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\ChoristerPortalAdminPanel.tsx
- Create: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\features\chorister-portal\ChoristerPortalAdminPanel.test.tsx
- Modify: C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista\src\pages\SimpleEventAudios.tsx

**Interfaces:**

- ChoristerPortalAdminPanelProps consumes event ID, event songs and admin state and calls only choristerPortalAdmin.
- onRefresh() runs after finalization, metadata edit, deletion, publication or unpublication.

- [ ] Step 1: Write failing component tests. Assert hidden for non-admins and non-official events; admin sees Rascunho/Publicado, private asset rows, Publicar no app, upload controls, document upload, ordering and removal confirmation.

- [ ] Step 2: Run focused tests and verify RED.

~~~powershell
npm test -- --run src/features/chorister-portal/ChoristerPortalAdminPanel.test.tsx
~~~

- [ ] Step 3: Implement the App do coralista section in SimpleEventAudios. Reuse event ordering and existing admin checks. Upload audio/partitura per song and PDF manual/document without exposing Storage URLs; show progress and retry; confirmation states that removal affects only the private portal asset.

- [ ] Step 4: Verify UI regressions.

~~~powershell
npm test -- --run src/features/chorister-portal/ChoristerPortalAdminPanel.test.tsx src/pages/SimpleEventAudios.test.tsx
npm run lint -- src/features/chorister-portal/ChoristerPortalAdminPanel.tsx src/pages/SimpleEventAudios.tsx
git diff --check
~~~

- [ ] Step 5: Commit.

~~~powershell
git add src/features/chorister-portal/ChoristerPortalAdminPanel.tsx src/features/chorister-portal/ChoristerPortalAdminPanel.test.tsx src/pages/SimpleEventAudios.tsx
git commit -m "feat: manage chorister portal content in event editor"
~~~

### Task 5: Encontro feed domain and server boundary

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\chorister-app\choristerApp.domain.ts
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\chorister-app\choristerApp.domain.test.ts
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\chorister-app\choristerApp.server.ts
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\chorister-app\choristerApp.server.test.ts
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\lib\chorister-app.functions.ts
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\lib\chorister-app.functions.test.ts

**Interfaces:**

- ChoristerPortalFeedSchema.parse(value): ChoristerPortalFeed.
- createChoristerAppServer({ participantAccess, fetchImpl, clock, env }).load(): Promise<ChoristerPortalFeedState>.
- getChoristerPortalFeed returns published, not_published or unavailable.

- [ ] Step 1: Write failing tests for malformed DTO, safe tab values, local search, no CoroApp call for unauthorized access, HMAC headers, 60-second cache, timeout and generic unavailable output.

- [ ] Step 2: Run focused tests and verify RED.

~~~powershell
npm run test:run -- src/features/chorister-app/choristerApp.domain.test.ts src/features/chorister-app/choristerApp.server.test.ts src/lib/chorister-app.functions.test.ts --no-file-parallelism --maxWorkers=1
~~~

- [ ] Step 3: Implement the Zod schema, tabSchema = z.enum(['home', 'cantos', 'partituras', 'perfil']), local search and expired-URL policy. Reject unknown statuses, arbitrary event IDs, invalid voices, non-HTTPS URLs and expired timestamps.

- [ ] Step 4: Implement the server adapter. Read COROAPP_PORTAL_FEED_URL and CHORISTER_PORTAL_SHARED_SECRET only from process.env; obtain participant access through the existing authorizer; sign HMAC; use AbortSignal.timeout; validate the response; cache for at most 60 seconds; map fetch/parse failures to unavailable. Do not add a database query or browser CoroApp client.

- [ ] Step 5: Verify and commit.

~~~powershell
npm run test:run -- src/features/chorister-app/choristerApp.domain.test.ts src/features/chorister-app/choristerApp.server.test.ts src/lib/chorister-app.functions.test.ts --no-file-parallelism --maxWorkers=1
npx tsc --noEmit
git diff --check
git add src/features/chorister-app src/lib/chorister-app.functions.ts src/lib/chorister-app.functions.test.ts
git commit -m "feat: load private chorister portal feed"
~~~

### Task 6: Encontro Home and Cantos tabs

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerAppShell.tsx
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerAppShell.test.tsx
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerHomeTab.tsx
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerSongsTab.tsx
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerTabs.test.tsx

**Interfaces:**

- ChoristerAppShellProps consumes ParticipantRegistrationView, ChoristerPortalFeed, password/receipt/logout callbacks and produces the four-tab shell.
- ChoristerSongsTab emits onPlay(audioId), onOpenSong(songId) and onOpenScore(assetId); it does not fetch data.

- [ ] Step 1: Write failing UI tests for exact tab labels/order, Home event card and shortcuts, Cantos order/search/voice filter, 44px controls, no upload controls and persistent player.

- [ ] Step 2: Run focused tests and verify RED.

~~~powershell
npm run test:run -- src/features/participant/ChoristerAppShell.test.tsx src/features/participant/ChoristerTabs.test.tsx --no-file-parallelism --maxWorkers=1
~~~

- [ ] Step 3: Implement the shell and Home/Cantos. Match the approved prototype with compact black/dourado/white identity, event card for 20–22 November 2026 and Quixadá, bottom navigation, safe-area padding, local search, order from feed, voice selector and persistent mini-player. Use existing UI primitives and lucide-react.

- [ ] Step 4: Verify focused UI and lint.

~~~powershell
npm run test:run -- src/features/participant/ChoristerAppShell.test.tsx src/features/participant/ChoristerTabs.test.tsx --no-file-parallelism --maxWorkers=1
npm run lint -- src/features/participant/ChoristerAppShell.tsx src/features/participant/ChoristerHomeTab.tsx src/features/participant/ChoristerSongsTab.tsx
git diff --check
~~~

- [ ] Step 5: Commit.

~~~powershell
git add src/features/participant/ChoristerAppShell.tsx src/features/participant/ChoristerAppShell.test.tsx src/features/participant/ChoristerHomeTab.tsx src/features/participant/ChoristerSongsTab.tsx src/features/participant/ChoristerTabs.test.tsx
git commit -m "feat: add chorister home and songs tabs"
~~~

### Task 7: Encontro Partituras and Meu Perfil tabs

**Files:**

- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerScoresTab.tsx
- Create: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerProfileTab.tsx
- Modify: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerAppShell.tsx
- Modify: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ChoristerTabs.test.tsx

**Interfaces:**

- ChoristerScoresTab consumes event.songs[].sheetMusic and event.documents and emits onOpen(asset), onDownload(asset).
- ChoristerProfileTab consumes the existing registration view and callbacks; it owns no authorization logic.

- [ ] Step 1: Write failing tests for grouped scores/documents, no upload button, signed PDF open/download, expiry refresh, profile masking/receipt/password/logout and immediate content clearing.

- [ ] Step 2: Run focused tests and verify RED.

~~~powershell
npm run test:run -- src/features/participant/ChoristerTabs.test.tsx --no-file-parallelism --maxWorkers=1
~~~

- [ ] Step 3: Implement Partituras with the existing PDF viewer pattern, signed-URL renewal once, download and new-tab fallback. Implement Meu Perfil by moving current identification/password/logout behavior into the tab while preserving receipt prerequisites and neutral errors.

- [ ] Step 4: Verify and commit.

~~~powershell
npm run test:run -- src/features/participant/ChoristerTabs.test.tsx src/features/participant/ParticipantPortalPage.test.tsx --no-file-parallelism --maxWorkers=1
npm run lint -- src/features/participant/ChoristerScoresTab.tsx src/features/participant/ChoristerProfileTab.tsx src/features/participant/ChoristerAppShell.tsx
git diff --check
git add src/features/participant/ChoristerScoresTab.tsx src/features/participant/ChoristerProfileTab.tsx src/features/participant/ChoristerAppShell.tsx src/features/participant/ChoristerTabs.test.tsx
git commit -m "feat: add chorister scores and profile tabs"
~~~

### Task 8: Replace participant placeholders and wire the route

**Files:**

- Modify: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ParticipantPortalPage.tsx
- Modify: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\features\participant\ParticipantPortalPage.test.tsx
- Modify: C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista\src\routes\participante.index.tsx

- [ ] Step 1: Update failing regression tests. Replace Playlist/Partituras placeholders with the exact four tabs; assert feed is not requested before participant authorization; preserve existing profile/password/logout assertions.

- [ ] Step 2: Run focused test and verify RED.

~~~powershell
npm run test:run -- src/features/participant/ParticipantPortalPage.test.tsx --no-file-parallelism --maxWorkers=1
~~~

- [ ] Step 3: Implement gate wiring. After participant authorization and registration load, call getChoristerPortalFeed; keep personal/event data hidden during loading; render neutral not_published and retryable unavailable states; clear registration and feed before logout navigation.

- [ ] Step 4: Verify route and commit.

~~~powershell
npm run test:run -- src/features/participant/ParticipantPortalPage.test.tsx src/routes/access-routes.test.tsx --no-file-parallelism --maxWorkers=1
npx tsc --noEmit
npm run lint -- src/features/participant/ParticipantPortalPage.tsx src/routes/participante.index.tsx
git diff --check
git add src/features/participant/ParticipantPortalPage.tsx src/features/participant/ParticipantPortalPage.test.tsx src/routes/participante.index.tsx
git commit -m "feat: wire the chorister app into participant portal"
~~~

### Task 9: Integrated verification and controlled handoff

**Files:**

- No production files or secrets are changed by this task.
- Modify the plan checkboxes only while executing tasks.

- [ ] Step 1: Run CoroApp verification.

~~~powershell
Set-Location C:\Users\gerbs\Documents\GitHub\coroapp\.worktrees\app-coralista
npm run test -- --run
npm run lint
npm run build
git status --short
~~~

Exclude only **/.worktrees/** if the suite discovers nested worktree fixtures; report independent failures separately.

- [ ] Step 2: Run Encontro verification.

~~~powershell
Set-Location C:\Users\gerbs\Documents\GitHub\encontrocorosce\.worktrees\app-coralista
npm run test:run -- --no-file-parallelism --maxWorkers=1
npx tsc --noEmit
npm run lint
npm run build
git status --short
~~~

- [ ] Step 3: Run local security proof. Confirm public roles cannot select portal rows or objects, valid admin operations work through the admin function, invalid HMAC cannot read the feed, and signed URLs stop working after expiration. Do not use remote credentials.

- [ ] Step 4: Run local browser smoke test with fixtures. Verify /acessar, signed-out /participante/ redirect, authorized shell, all four tabs, search, audio play/pause, PDF fallback, generic feed failure and logout clearing. Do not enter real credentials or upload real files.

- [ ] Step 5: Review release boundaries. Compare local/tracking SHAs in both worktrees, inspect staged file lists, confirm no .env or unrelated worktree file is staged, and keep Git, migration application, Edge Function deployment, secrets and Lovable served frontend as separate proof points.

- [ ] Step 6: Stop before production mutations. Present exact target, impact, rollback and validation for any requested remote migration, Storage bucket, Edge Function, secret, Git push or Lovable publication. Obtain fresh authorization for each mutation and verify database ledger, function behavior, Git SHAs and served UI independently.

## Plan Self-Review

- Schema, private Storage, admin upload, HMAC feed, participant gate, four tabs, error states, accessibility, tests and release boundaries each have a task.
- No TBD, TODO, implement later or unspecified test step remains.
- PortalFeed, ChoristerPortalFeed, signedUrl and expiresAt names are consistent across the mapper, Edge Function, Encontro validator and React tabs.
- The Encontro database is intentionally unchanged; the generated migration scaffold is not required and should be removed before implementation if it remains empty.

