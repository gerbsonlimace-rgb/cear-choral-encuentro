create table public.choir_regents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  choir_id uuid not null references public.choirs(id) on delete restrict,
  email text not null,
  name text not null,
  password_change_required boolean not null default true,
  granted_at timestamptz not null default now(),
  granted_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint choir_regents_email_check check (
    email = lower(btrim(email)) and char_length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint choir_regents_name_check check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  constraint choir_regents_revocation_check check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null and revoked_at >= granted_at)
  )
);

create unique index choir_regents_active_choir_uidx
  on public.choir_regents (choir_id) where revoked_at is null;
create unique index choir_regents_active_user_uidx
  on public.choir_regents (user_id) where revoked_at is null;
-- Full indexes also cover foreign-key checks and revoked history.
create index choir_regents_choir_id_idx on public.choir_regents (choir_id);
create index choir_regents_user_id_idx on public.choir_regents (user_id);
create index choir_regents_granted_by_idx on public.choir_regents (granted_by);
create index choir_regents_revoked_by_idx on public.choir_regents (revoked_by);

alter table public.choir_regents enable row level security;
revoke all on public.choir_regents from anon, authenticated;
revoke all on public.choir_regents from public, service_role;
grant select, insert, update on public.choir_regents to service_role;

create or replace function public.replace_active_choir_regent(
  p_choir_id uuid,
  p_user_id uuid,
  p_email text,
  p_name text,
  p_granted_by uuid
)
returns public.choir_regents
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_regent public.choir_regents;
  v_changed_at timestamptz;
begin
  -- The parent exists even when no active association exists yet. Locking it
  -- serializes replacements for this choir; user uniqueness covers other choirs.
  perform 1 from public.choirs as choir where choir.id = p_choir_id for update;
  if not found then
    raise exception 'Choir not found' using errcode = '23503';
  end if;

  v_changed_at := clock_timestamp();
  update public.choir_regents
  set revoked_at = v_changed_at, revoked_by = p_granted_by
  where choir_id = p_choir_id and revoked_at is null;

  insert into public.choir_regents (
    choir_id, user_id, email, name, password_change_required, granted_at, granted_by
  ) values (
    p_choir_id, p_user_id, lower(btrim(p_email)), btrim(p_name), true, v_changed_at, p_granted_by
  ) returning * into v_regent;

  -- An insert failure rolls back the revocation as part of this same statement.
  return v_regent;
end;
$$;

revoke all on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid)
  to service_role;

create table public.registration_complement_payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  choir_id uuid not null references public.choirs(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'paid', 'failed', 'expired')),
  order_nsu uuid not null unique,
  checkout_url text,
  infinitepay_invoice_slug text,
  infinitepay_transaction_nsu text,
  payment_method text check (payment_method in ('pix', 'credit_card')),
  installments integer check (installments > 0),
  paid_amount_cents integer check (paid_amount_cents > 0),
  receipt_url text,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  initiated_by_name text not null,
  initiated_as text not null check (initiated_as in ('regent', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint registration_complement_payments_initiator_name_check check (
    initiated_by_name = btrim(initiated_by_name)
    and char_length(initiated_by_name) between 2 and 254
  ),
  constraint registration_complement_payments_checkout_url_check check (
    checkout_url is null
    or (char_length(checkout_url) <= 2048 and checkout_url ~ '^https://[^[:space:]]+$')
  ),
  constraint registration_complement_payments_receipt_url_check check (
    receipt_url is null
    or (char_length(receipt_url) <= 2048 and receipt_url ~ '^https://[^[:space:]]+$')
  ),
  constraint registration_complement_payments_invoice_check check (
    infinitepay_invoice_slug is null
    or (char_length(btrim(infinitepay_invoice_slug)) between 1 and 255)
  ),
  constraint registration_complement_payments_transaction_check check (
    infinitepay_transaction_nsu is null
    or (char_length(btrim(infinitepay_transaction_nsu)) between 1 and 255)
  ),
  constraint registration_complement_payments_pending_checkout_check check (
    status <> 'pending' or checkout_url is not null
  ),
  constraint registration_complement_payments_paid_details_check check (
    (status = 'paid' and infinitepay_transaction_nsu is not null
      and payment_method is not null and installments is not null
      and paid_amount_cents is not null and paid_amount_cents >= amount_cents
      and paid_at is not null and paid_at >= created_at)
    or (status <> 'paid' and paid_at is null and paid_amount_cents is null
      and infinitepay_transaction_nsu is null and payment_method is null
      and installments is null and receipt_url is null)
  )
);

create unique index registration_complement_payments_open_uidx
  on public.registration_complement_payments (registration_id)
  where status in ('creating', 'pending');
create unique index registration_complement_payments_transaction_uidx
  on public.registration_complement_payments (infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;
create index registration_complement_payments_registration_id_idx
  on public.registration_complement_payments (registration_id);
create index registration_complement_payments_choir_id_idx
  on public.registration_complement_payments (choir_id);
create index registration_complement_payments_initiated_by_idx
  on public.registration_complement_payments (initiated_by);
create index registration_complement_payments_paid_registration_idx
  on public.registration_complement_payments (registration_id) where status = 'paid';

alter table public.registration_complement_payments enable row level security;
revoke all on public.registration_complement_payments from anon, authenticated;
revoke all on public.registration_complement_payments from public, service_role;
grant select, insert, update on public.registration_complement_payments to service_role;

create or replace function public.validate_registration_complement_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration public.registrations;
  v_paid_cents bigint;
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

  -- Every write for a registration takes the same lock before reading payments.
  -- With the open-checkout unique index, reservations and confirmations cannot
  -- concurrently spend the same outstanding principal.
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

  if new.amount_cents > v_registration.standard_price_cents::bigint
    - v_registration.registration_price_cents::bigint - v_paid_cents then
    raise exception 'Complement amount exceeds outstanding balance' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new is distinct from old then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.validate_registration_complement_payment()
  from public, anon, authenticated;

create trigger validate_registration_complement_payment_before_write
before insert or update on public.registration_complement_payments
for each row execute function public.validate_registration_complement_payment();
