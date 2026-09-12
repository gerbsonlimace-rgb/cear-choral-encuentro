# Roadmap

## Done
- Confirm Supabase backend is active and reachable (10 public tables, auth, storage).
- Fix preview typecheck errors:
  - `src/features/regent/regent-payment.server.ts` — removed duplicated payment fields in `PaymentDatabaseRow`.
  - `src/features/registration/registration-payment.server.ts` — repository now exposes `findByCpf` as required.
  - `src/features/registration/registration-payment.server.test.ts` — declared the `cpf` fixture constant.
  - Sponsor repository and generated Supabase types errors were stale and no longer reproduce.

## Open
- Verify participant portal login end-to-end (needs a real registration; none exist right now).
- [x] Transform the public registration form into a large-field, three-step wizard with review before payment.
- [x] Show a live badge preview during personal details and keep the full price calculation card in payment review.

- [x] Apply the dark-background logo on dark surfaces and the light-background logo on light surfaces.
- [x] Compact the personal-data step and place the participant photo and event logo beside the name.
- [x] Restore the full vertical badge with a lanyard on the right while keeping fields compact.
- [ ] Rebalance the sponsor area with square, left-aligned cards, larger logos, and hover effects.
