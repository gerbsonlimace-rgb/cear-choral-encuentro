alter table public.registrations
  add column if not exists manual_fee_pending_cents integer,
  add column if not exists manual_discount_cents integer;

alter table public.registrations
  add constraint registrations_manual_fee_pending_check
    check (manual_fee_pending_cents is null or manual_fee_pending_cents > 0),
  add constraint registrations_manual_discount_check
    check (manual_discount_cents is null or manual_discount_cents > 0),
  add constraint registrations_manual_balance_origin_check
    check (
      (manual_fee_pending_cents is null and manual_discount_cents is null)
      or (payment_status = 'paid' and payment_origin = 'manual')
    );

comment on column public.registrations.manual_fee_pending_cents is
  'Administrative registration-fee balance left open after a partial manual payment.';
comment on column public.registrations.manual_discount_cents is
  'Registration-fee amount waived by an administrator during manual payment.';