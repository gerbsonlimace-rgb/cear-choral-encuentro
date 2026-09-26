begin;

alter table public.choirs
  add column if not exists is_free boolean not null default false;

do $$
begin
  if (select count(*) from public.choirs where lower(btrim(name)) = lower('Coro Diocesano de Quixadá')) <> 1 then
    raise exception 'Coro Diocesano de Quixadá não foi encontrado de forma única';
  end if;
end;
$$;

update public.choirs
set is_free = true,
    uses_promotional_price = false,
    updated_at = now()
where lower(btrim(name)) = lower('Coro Diocesano de Quixadá');

alter table public.choirs
  drop constraint if exists choirs_free_or_promotional_check;

alter table public.choirs
  add constraint choirs_free_or_promotional_check check (not (is_free and uses_promotional_price));

alter table public.registrations
  add column if not exists is_free_registration boolean not null default false;

alter table public.registrations
  drop constraint if exists registrations_order_required_check,
  drop constraint if exists registrations_exemption_audit_check,
  drop constraint if exists registrations_free_pending_check,
  drop constraint if exists registrations_free_flag_check;

alter table public.registrations
  add constraint registrations_order_required_check check (
    (payment_status = 'legacy' and order_nsu is null and amount_cents is null)
    or (
      payment_status in ('pending', 'paid')
      and payment_origin <> 'exemption'
      and order_nsu is not null
      and amount_cents is not null
      and amount_cents > 0
    )
    or (
      payment_status in ('pending', 'paid')
      and payment_origin = 'exemption'
      and order_nsu is null
      and amount_cents = 0
      and checkout_url is null
    )
  ),
  add constraint registrations_exemption_audit_check check (
    (
      payment_origin = 'exemption'
      and payment_status = 'pending'
      and exempted_by is null
      and exempted_at is null
    )
    or (
      payment_origin = 'exemption'
      and payment_status = 'paid'
      and exempted_by is not null
      and exempted_at is not null
    )
    or (
      payment_origin <> 'exemption'
      and exempted_by is null
      and exempted_at is null
    )
  ),
  add constraint registrations_free_pending_check check (
    payment_status <> 'pending'
    or payment_origin <> 'exemption'
    or (
      choir_id is not null
      and other_choir_name is null
      and pricing_type = 'standard'
      and standard_price_cents = 0
      and registration_price_cents = 0
      and remaining_price_cents = 0
      and shirt_price_cents = 0
      and paid_amount_cents is null
      and checkout_url is null
      and infinitepay_transaction_nsu is null
      and paid_at is null
    )
  ),
  add constraint registrations_free_flag_check check (
    (not is_free_registration or (payment_origin = 'exemption' and amount_cents = 0))
    and (payment_status <> 'pending' or payment_origin <> 'exemption' or is_free_registration)
  );

commit;
