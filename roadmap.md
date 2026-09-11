# Roadmap

## Done
- Confirm Supabase backend is active and reachable (10 public tables, auth, storage).

## Open
- Fix typecheck build errors in preview (see /tmp/observability/build-errors.log):
  - `src/features/registration/registration-payment.server.test.ts` — `cpf` undefined / possibly-undefined call.
  - `src/features/sponsors/sponsor.repository.server.ts` — `never` assignability errors.
  - `src/integrations/supabase/types.ts` — duplicate `replace_active_choir_regent` (generated file: fix at the database level).
- Verify participant portal login end-to-end (needs a real registration; none exist right now).
