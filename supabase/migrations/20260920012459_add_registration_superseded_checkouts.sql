create table public.registration_superseded_checkouts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  order_nsu uuid not null unique,
  checkout_url text not null,
  amount_cents integer not null check (amount_cents > 0),
  pricing_type text not null check (pricing_type in ('standard', 'promotional')),
  standard_price_cents integer not null check (standard_price_cents > 0),
  registration_price_cents integer not null check (registration_price_cents > 0),
  remaining_price_cents integer check (remaining_price_cents >= 0),
  status text not null default 'superseded'
    check (status in ('superseded', 'paid_requires_review')),
  infinitepay_invoice_slug text,
  infinitepay_transaction_nsu text,
  payment_method text check (payment_method in ('pix', 'credit_card')),
  installments integer check (installments > 0),
  paid_amount_cents integer check (paid_amount_cents > 0),
  receipt_url text,
  superseded_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint registration_superseded_checkouts_checkout_url_check check (
    char_length(checkout_url) <= 2048
    and checkout_url ~ '^https://checkout\.infinitepay\.(io|com\.br)(/|$)'
  ),
  constraint registration_superseded_checkouts_invoice_check check (
    infinitepay_invoice_slug is null
    or char_length(btrim(infinitepay_invoice_slug)) between 1 and 255
  ),
  constraint registration_superseded_checkouts_transaction_check check (
    infinitepay_transaction_nsu is null
    or char_length(btrim(infinitepay_transaction_nsu)) between 1 and 255
  ),
  constraint registration_superseded_checkouts_receipt_url_check check (
    receipt_url is null
    or (char_length(receipt_url) <= 2048 and receipt_url ~ '^https://[^[:space:]]+$')
  ),
  constraint registration_superseded_checkouts_paid_details_check check (
    (
      status = 'superseded'
      and infinitepay_invoice_slug is null
      and infinitepay_transaction_nsu is null
      and payment_method is null
      and installments is null
      and paid_amount_cents is null
      and receipt_url is null
      and paid_at is null
    )
    or
    (
      status = 'paid_requires_review'
      and infinitepay_invoice_slug is not null
      and infinitepay_transaction_nsu is not null
      and payment_method is not null
      and installments is not null
      and paid_amount_cents is not null
      and paid_amount_cents >= amount_cents
      and paid_at is not null
    )
  )
);

create unique index registration_superseded_checkouts_transaction_uidx
  on public.registration_superseded_checkouts (infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;
create index registration_superseded_checkouts_registration_id_idx
  on public.registration_superseded_checkouts (registration_id);
create index registration_superseded_checkouts_review_idx
  on public.registration_superseded_checkouts (registration_id, paid_at desc)
  where status = 'paid_requires_review';

alter table public.registration_superseded_checkouts enable row level security;
revoke all on public.registration_superseded_checkouts from public, anon, authenticated;
revoke all on public.registration_superseded_checkouts from service_role;
grant select, insert, update on public.registration_superseded_checkouts to service_role;

create or replace function public.validate_registration_superseded_checkout()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'superseded' then
      raise exception 'Superseded checkout must start as superseded' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.registration_id is distinct from old.registration_id
    or new.order_nsu is distinct from old.order_nsu
    or new.checkout_url is distinct from old.checkout_url
    or new.amount_cents is distinct from old.amount_cents
    or new.pricing_type is distinct from old.pricing_type
    or new.standard_price_cents is distinct from old.standard_price_cents
    or new.registration_price_cents is distinct from old.registration_price_cents
    or new.remaining_price_cents is distinct from old.remaining_price_cents
    or new.superseded_at is distinct from old.superseded_at then
    raise exception 'Superseded checkout identity and snapshots are immutable' using errcode = '23514';
  end if;

  if old.status = 'paid_requires_review' and new is distinct from old then
    raise exception 'Reviewed checkout payment is terminal' using errcode = '23514';
  end if;

  if new is distinct from old and not (
    old.status = 'superseded' and new.status = 'paid_requires_review'
  ) then
    raise exception 'Invalid superseded checkout transition' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_registration_superseded_checkout()
  from public, anon, authenticated;

create trigger validate_registration_superseded_checkout_before_insert
before insert on public.registration_superseded_checkouts
for each row execute function public.validate_registration_superseded_checkout();

create trigger validate_registration_superseded_checkout_before_update
before update on public.registration_superseded_checkouts
for each row execute function public.validate_registration_superseded_checkout();

create or replace function public.replace_pending_registration_checkout(
  p_registration_id uuid,
  p_expected_order_nsu uuid,
  p_expected_checkout_url text,
  p_new_order_nsu uuid,
  p_checkout_claim text,
  p_name text,
  p_badge_name text,
  p_cpf text,
  p_photo_path text,
  p_musical_profile text,
  p_voice_part text,
  p_phone text,
  p_birth_date date,
  p_choir_id uuid,
  p_choir_name text,
  p_other_choir_name text,
  p_diocese text,
  p_email text,
  p_pricing_type text,
  p_standard_price_cents integer,
  p_registration_price_cents integer,
  p_remaining_price_cents integer,
  p_amount_cents integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration public.registrations;
begin
  if p_new_order_nsu = p_expected_order_nsu
    or p_checkout_claim is distinct from
      'https://pending.invalid/creating/' || p_new_order_nsu::text then
    raise exception 'Invalid replacement checkout claim' using errcode = '23514';
  end if;

  select registration.* into v_registration
  from public.registrations as registration
  where registration.id = p_registration_id
  for update;

  if not found then
    return false;
  end if;

  if v_registration.payment_status is distinct from 'pending'
    or v_registration.order_nsu is distinct from p_expected_order_nsu
    or v_registration.checkout_url is distinct from p_expected_checkout_url then
    return false;
  end if;

  if v_registration.checkout_url ~ '^https://checkout\.infinitepay\.(io|com\.br)(/|$)' then
    if v_registration.amount_cents is null
      or v_registration.pricing_type is null
      or v_registration.standard_price_cents is null
      or v_registration.registration_price_cents is null then
      raise exception 'Existing checkout snapshots are incomplete' using errcode = '23514';
    end if;

    insert into public.registration_superseded_checkouts (
      registration_id,
      order_nsu,
      checkout_url,
      amount_cents,
      pricing_type,
      standard_price_cents,
      registration_price_cents,
      remaining_price_cents
    ) values (
      v_registration.id,
      v_registration.order_nsu,
      v_registration.checkout_url,
      v_registration.amount_cents,
      v_registration.pricing_type,
      v_registration.standard_price_cents,
      v_registration.registration_price_cents,
      v_registration.remaining_price_cents
    );
  elsif v_registration.checkout_url like 'https://pending.invalid/creating/%' then
    null;
  else
    raise exception 'Existing checkout URL cannot be superseded' using errcode = '23514';
  end if;

  update public.registrations
  set
    name = btrim(p_name),
    badge_name = btrim(p_badge_name),
    cpf = p_cpf,
    photo_path = p_photo_path,
    musical_profile = p_musical_profile,
    voice_part = p_voice_part,
    phone = p_phone,
    birth_date = p_birth_date,
    choir_id = p_choir_id,
    choir_name = btrim(p_choir_name),
    other_choir_name = p_other_choir_name,
    diocese = p_diocese,
    email = lower(btrim(p_email)),
    pricing_type = p_pricing_type,
    standard_price_cents = p_standard_price_cents,
    registration_price_cents = p_registration_price_cents,
    remaining_price_cents = p_remaining_price_cents,
    amount_cents = p_amount_cents,
    order_nsu = p_new_order_nsu,
    checkout_url = p_checkout_claim,
    infinitepay_invoice_slug = null,
    infinitepay_transaction_nsu = null,
    payment_method = null,
    installments = null,
    paid_amount_cents = null,
    receipt_url = null,
    paid_at = null
  where id = p_registration_id;

  return true;
end;
$$;

revoke all on function public.replace_pending_registration_checkout(
  uuid, uuid, text, uuid, text, text, text, text, text, text, text, text,
  date, uuid, text, text, text, text, text, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.replace_pending_registration_checkout(
  uuid, uuid, text, uuid, text, text, text, text, text, text, text, text,
  date, uuid, text, text, text, text, text, integer, integer, integer, integer
) to service_role;
