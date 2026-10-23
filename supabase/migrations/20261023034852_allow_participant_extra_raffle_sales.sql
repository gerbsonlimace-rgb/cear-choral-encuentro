-- Participant raffle sales may exceed the original target. Keep regent/admin
-- complements capped at the outstanding promotional balance.
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
  v_free_raffles boolean;
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
  if v_registration.payment_status is distinct from 'paid' then
    raise exception 'Complement requires a paid registration' using errcode = '23514';
  end if;

  v_free_raffles := v_registration.is_free_registration
    and v_registration.payment_origin = 'exemption'
    and v_registration.pricing_type = 'standard'
    and v_registration.standard_price_cents = 0
    and v_registration.registration_price_cents = 0
    and v_registration.remaining_price_cents = 0
    and v_registration.amount_cents = 0;

  if v_free_raffles then
    if new.initiated_as <> 'participant' then
      raise exception 'Free-group raffle payments require participant access' using errcode = '23514';
    end if;
  elsif v_registration.pricing_type is distinct from 'promotional' then
    raise exception 'Complement requires a paid promotional registration' using errcode = '23514';
  elsif v_registration.standard_price_cents is null
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

  if new.initiated_as = 'participant' then
    if new.amount_cents % 1000 <> 0 then
      raise exception 'Raffle payments must contain whole tickets' using errcode = '23514';
    end if;
  else
    select coalesce(sum(payment.amount_cents), 0) into v_paid_cents
    from public.registration_complement_payments as payment
    where payment.registration_id = new.registration_id
      and payment.status = 'paid' and payment.id <> new.id;
    v_remaining_cents := v_registration.remaining_price_cents::bigint - v_paid_cents;
    if new.amount_cents > v_remaining_cents then
      raise exception 'Complement amount exceeds outstanding balance' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new is distinct from old then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.validate_registration_complement_payment()
  from public, anon, authenticated;
