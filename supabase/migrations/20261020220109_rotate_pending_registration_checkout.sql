create function public.rotate_pending_registration_checkout(
  p_registration_id uuid,
  p_expected_order_nsu uuid,
  p_expected_checkout_url text,
  p_expected_phone text,
  p_expected_cpf text,
  p_expected_birth_date date,
  p_new_order_nsu uuid,
  p_checkout_claim text,
  p_phone text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration public.registrations;
begin
  if p_registration_id is null
    or p_expected_order_nsu is null
    or p_new_order_nsu is null
    or p_new_order_nsu = p_expected_order_nsu
    or p_expected_phone is null
    or (p_expected_cpf is null) <> (p_expected_birth_date is null)
    or p_phone is null
    or char_length(btrim(p_phone)) not between 11 and 30
    or p_checkout_claim is null
    or p_checkout_claim !~ (
      '^https://pending[.]invalid/creating/' || p_new_order_nsu::text || '/[0-9]+$'
    ) then
    raise exception 'Invalid replacement checkout input' using errcode = '23514';
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
    or v_registration.checkout_url is distinct from p_expected_checkout_url
    or v_registration.phone is distinct from p_expected_phone
    or (p_expected_cpf is not null and v_registration.cpf is distinct from p_expected_cpf)
    or (p_expected_birth_date is not null and v_registration.birth_date is distinct from p_expected_birth_date) then
    return false;
  end if;

  if v_registration.checkout_url ~ '^https://checkout[.]infinitepay[.](io|com[.]br)(/|$)' then
    if v_registration.amount_cents is null then
      raise exception 'Existing checkout amount is missing' using errcode = '23514';
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
  elsif v_registration.checkout_url is null
    or v_registration.checkout_url like 'https://pending.invalid/creating/%' then
    null;
  else
    raise exception 'Existing checkout URL cannot be superseded' using errcode = '23514';
  end if;

  update public.registrations
  set phone = btrim(p_phone),
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

revoke all on function public.rotate_pending_registration_checkout(
  uuid, uuid, text, text, text, date, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.rotate_pending_registration_checkout(
  uuid, uuid, text, text, text, date, uuid, text, text
) to service_role;
