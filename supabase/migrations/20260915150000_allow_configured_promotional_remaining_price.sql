-- The promotional amount paid upfront and the outstanding balance are
-- independently configured values. The balance may be greater than the
-- standard-price discount difference.
alter table public.registrations
  drop constraint if exists registrations_remaining_price_check;

alter table public.registrations
  add constraint registrations_remaining_price_check
  check (
    remaining_price_cents is null
    or (
      pricing_type = 'promotional'
      and remaining_price_cents >= 0
    )
  );
