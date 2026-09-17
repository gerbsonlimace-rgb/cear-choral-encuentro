begin;

alter table public.registrations
  add column if not exists exempted_at timestamptz,
  add column if not exists exempted_by uuid;

alter table public.registrations
  drop constraint if exists registrations_payment_origin_check,
  drop constraint if exists registrations_amount_check,
  drop constraint if exists registrations_order_required_check,
  drop constraint if exists registrations_paid_amount_check,
  drop constraint if exists registrations_paid_details_check,
  drop constraint if exists registrations_standard_price_check,
  drop constraint if exists registrations_registration_price_check,
  drop constraint if exists registrations_shirt_price_check,
  drop constraint if exists registrations_remaining_price_check,
  drop constraint if exists registrations_pricing_snapshot_check,
  drop constraint if exists registrations_shirt_price_snapshot_check;

alter table public.registrations
  add constraint registrations_payment_origin_check
    check (payment_origin in ('infinitepay', 'manual', 'exemption')),
  add constraint registrations_amount_check
    check (
      amount_cents is null
      or amount_cents > 0
      or (payment_origin = 'exemption' and amount_cents = 0)
    ),
  add constraint registrations_order_required_check
    check (
      (payment_status = 'legacy' and order_nsu is null and amount_cents is null)
      or (
        payment_status in ('pending', 'paid')
        and payment_origin <> 'exemption'
        and order_nsu is not null
        and amount_cents is not null
        and amount_cents > 0
      )
      or (
        payment_status = 'paid'
        and payment_origin = 'exemption'
        and order_nsu is null
        and amount_cents = 0
      )
    ),
  add constraint registrations_paid_amount_check
    check (
      paid_amount_cents is null
      or paid_amount_cents > 0
      or (payment_origin = 'exemption' and paid_amount_cents = 0)
    ),
  add constraint registrations_paid_details_check
    check (
      payment_status <> 'paid'
      or (
        payment_origin = 'manual'
        and manual_paid_by is not null
        and infinitepay_transaction_nsu is null
        and payment_method is null
        and installments is null
        and receipt_url is null
        and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
      or (
        payment_origin = 'infinitepay'
        and infinitepay_transaction_nsu is not null
        and payment_method is not null
        and installments is not null
        and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
      or (
        payment_origin = 'exemption'
        and exempted_by is not null
        and exempted_at is not null
        and amount_cents = 0
        and paid_amount_cents = 0
        and paid_at is null
        and payment_method is null
        and installments is null
        and checkout_url is null
        and infinitepay_invoice_slug is null
        and infinitepay_transaction_nsu is null
        and receipt_url is null
      )
    ),
  add constraint registrations_exemption_audit_check
    check (
      (payment_origin = 'exemption' and exempted_by is not null and exempted_at is not null)
      or (payment_origin <> 'exemption' and exempted_by is null and exempted_at is null)
    ),
  add constraint registrations_standard_price_check
    check (
      standard_price_cents is null
      or standard_price_cents > 0
      or (payment_origin = 'exemption' and standard_price_cents = 0)
    ),
  add constraint registrations_registration_price_check
    check (
      registration_price_cents is null
      or registration_price_cents > 0
      or (payment_origin = 'exemption' and registration_price_cents = 0)
    ),
  add constraint registrations_shirt_price_check
    check (
      shirt_price_cents is null
      or shirt_price_cents > 0
      or (payment_origin = 'exemption' and shirt_price_cents = 0)
    ),
  add constraint registrations_remaining_price_check
    check (
      remaining_price_cents is null
      or (payment_origin = 'exemption' and remaining_price_cents = 0)
      or (pricing_type = 'promotional' and remaining_price_cents >= 0)
    ),
  add constraint registrations_pricing_snapshot_check
    check (
      (
        payment_origin = 'exemption'
        and standard_price_cents = 0
        and registration_price_cents = 0
        and shirt_price_cents = 0
      )
      or (
        choir_id is null
        and other_choir_name is null
        and pricing_type is null
        and standard_price_cents is null
        and registration_price_cents is null
        and shirt_price_cents is null
      )
      or (
        (
          (choir_id is not null and other_choir_name is null)
          or (choir_id is null and other_choir_name is not null)
        )
        and pricing_type is not null
        and standard_price_cents is not null
        and registration_price_cents is not null
        and (
          (pricing_type = 'standard' and registration_price_cents = standard_price_cents)
          or (pricing_type = 'promotional' and registration_price_cents < standard_price_cents)
        )
      )
    ),
  add constraint registrations_shirt_price_snapshot_check
    check (
      payment_origin = 'exemption'
      or pricing_type is null
      or (include_shirt and shirt_price_cents is not null)
      or (not include_shirt and shirt_price_cents is null)
    );

comment on column public.registrations.exempted_at is
  'Momento em que uma inscrição pendente recebeu isenção administrativa.';
comment on column public.registrations.exempted_by is
  'Usuário administrador que concedeu a isenção.';

commit;
