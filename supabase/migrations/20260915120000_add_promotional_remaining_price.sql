alter table public.event_registration_settings
  add column if not exists promotional_remaining_price_cents integer;

alter table public.event_registration_settings
  drop constraint if exists event_registration_settings_promotional_remaining_price_check;
alter table public.event_registration_settings
  add constraint event_registration_settings_promotional_remaining_price_check
  check (promotional_remaining_price_cents is null or promotional_remaining_price_cents >= 0);

alter table public.registrations
  add column if not exists remaining_price_cents integer;

alter table public.registrations
  drop constraint if exists registrations_remaining_price_check;
alter table public.registrations
  add constraint registrations_remaining_price_check
  check (
    remaining_price_cents is null
    or (
      pricing_type = 'promotional'
      and standard_price_cents is not null
      and registration_price_cents is not null
      and remaining_price_cents between 0 and standard_price_cents - registration_price_cents
    )
  );

update public.event_registration_settings
set promotional_remaining_price_cents = standard_price_cents - promotional_price_cents
where promotional_remaining_price_cents is null
  and standard_price_cents is not null
  and promotional_price_cents is not null
  and standard_price_cents > promotional_price_cents;

update public.registrations
set remaining_price_cents = greatest(standard_price_cents - registration_price_cents, 0)
where remaining_price_cents is null
  and pricing_type = 'promotional'
  and standard_price_cents is not null
  and registration_price_cents is not null;

create or replace function public.validate_registration_complement_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration public.registrations;
  v_paid_cents bigint;
  v_remaining_cents bigint;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'creating' then
      raise exception 'Complement payment must start as creating' using errcode = '23514';
    end if;
  else
    if new.id is distinct from old.id
      or new.registration_id is distinct from old.registration_id
      or new.choir_id is distinct from old.choir_id
      or new.order_nsu is distinct from old.order_nsu
      or new.amount_cents is distinct from old.amount_cents
      or new.initiated_by is distinct from old.initiated_by
      or new.initiated_by_name is distinct from old.initiated_by_name
      or new.initiated_as is distinct from old.initiated_as
      or new.created_at is distinct from old.created_at then
      raise exception 'Complement payment identity and snapshots are immutable' using errcode = '23514';
    end if;
    if old.status in ('paid', 'failed', 'expired') and new is distinct from old then
      raise exception 'Complement payment is terminal' using errcode = '23514';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'creating' and new.status in ('pending', 'failed'))
      or (old.status = 'pending' and new.status in ('paid', 'failed', 'expired'))
    ) then
      raise exception 'Invalid complement payment transition' using errcode = '23514';
    end if;
  end if;

  select registration.* into v_registration
  from public.registrations as registration
  where registration.id = new.registration_id
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = '23503';
  end if;
  if v_registration.choir_id is distinct from new.choir_id then
    raise exception 'Registration belongs to another choir' using errcode = '23514';
  end if;
  if v_registration.payment_status is distinct from 'paid'
    or v_registration.pricing_type is distinct from 'promotional' then
    raise exception 'Complement requires a paid promotional registration' using errcode = '23514';
  end if;
  if v_registration.standard_price_cents is null
    or v_registration.registration_price_cents is null
    or v_registration.registration_price_cents <= 0
    or v_registration.standard_price_cents <= v_registration.registration_price_cents
    or v_registration.remaining_price_cents is null
    or v_registration.remaining_price_cents <= 0
    or v_registration.amount_cents is null
    or (v_registration.include_shirt and (
      v_registration.shirt_price_cents is null or v_registration.shirt_price_cents <= 0
    ))
    or (not v_registration.include_shirt and v_registration.shirt_price_cents is not null)
    or v_registration.amount_cents::bigint <> v_registration.registration_price_cents::bigint
      + coalesce(v_registration.shirt_price_cents, 0)::bigint then
    raise exception 'Registration pricing snapshots are incomplete or inconsistent' using errcode = '23514';
  end if;

  select coalesce(sum(payment.amount_cents), 0) into v_paid_cents
  from public.registration_complement_payments as payment
  where payment.registration_id = new.registration_id
    and payment.status = 'paid' and payment.id <> new.id;
  v_remaining_cents := v_registration.remaining_price_cents::bigint - v_paid_cents;
  if new.amount_cents > v_remaining_cents then
    raise exception 'Complement amount exceeds outstanding balance' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new is distinct from old then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
