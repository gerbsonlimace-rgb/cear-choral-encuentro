begin;

-- Administrative cancellation of a registration. The shared payment columns
-- stay untouched so checkout eligibility and confirmed revenue keep their
-- meaning; the summary nets the refund against received revenue instead.
alter table public.registrations
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists refund_cents integer not null default 0;

alter table public.registrations
  drop constraint if exists registrations_refund_cents_non_negative;

alter table public.registrations
  add constraint registrations_refund_cents_non_negative
  check (refund_cents >= 0);

commit;
